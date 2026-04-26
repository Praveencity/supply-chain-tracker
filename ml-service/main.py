from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from ml_pipeline import predict_delay, predict_eta, predict_delay_hours, record_actual_shipment, train_models, get_route_stats
from pathfinder import dijkstra, CITIES
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
import os
from openai import OpenAI
from fastapi.responses import FileResponse

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", "dummy_key"))
app = FastAPI(title="Supply Chain ML Service", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/data/download")
def download_csv():
    file_path = "historical_shipments.csv"
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="text/csv", filename="historical_shipments.csv")
    raise HTTPException(status_code=404, detail="Dataset not found")

@app.get("/api/dataset-stats")
def dataset_stats():
    """Lightweight stats — just reads the CSV, no retraining."""
    import pandas as pd
    file_path = "historical_shipments.csv"
    if not os.path.exists(file_path):
        return {"total_records": 0, "real_delivery_records": 0, "baseline_records": 0}
    df = pd.read_csv(file_path)
    total_rows    = len(df)
    real_rows     = int((df["traffic_level"] > 2).sum())
    baseline_rows = total_rows - real_rows
    return {
        "total_records": total_rows,
        "real_delivery_records": real_rows,
        "baseline_records": baseline_rows,
    }

@app.post("/api/retrain")
def manual_retrain():
    """Manually trigger model retraining on current historical data."""
    import pandas as pd, time
    file_path = "historical_shipments.csv"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="No training data found yet. Complete some deliveries first.")
    df = pd.read_csv(file_path)
    total_rows    = len(df)
    real_rows     = int((df["traffic_level"] > 2).sum())
    baseline_rows = total_rows - real_rows
    t0 = time.time()
    train_models(df)
    elapsed = round(time.time() - t0, 2)
    return {
        "success": True,
        "total_records": total_rows,
        "baseline_records": baseline_rows,
        "real_delivery_records": real_rows,
        "training_time_sec": elapsed,
        "message": f"Models retrained on {total_rows} records ({real_rows} real deliveries + {baseline_rows} baseline) in {elapsed}s"
    }

@app.post("/api/purge-baseline")
def purge_baseline():
    """Remove synthetic ideal-condition rows. Keep only real delivery records."""
    import pandas as pd, time
    file_path = "historical_shipments.csv"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="No data file found.")

    df = pd.read_csv(file_path)
    total_before = len(df)

    # Baseline rows: low traffic (synthetic ideal conditions) — matches dataset-stats definition
    is_baseline = (df["traffic_level"] <= 2)
    df_real = df[~is_baseline].copy()
    real_count = len(df_real)
    removed = total_before - real_count

    if real_count == 0:
        raise HTTPException(status_code=400, detail="No real delivery data found. Run some simulations first before purging baseline.")

    df_real.to_csv(file_path, index=False)

    # Retrain on real data only
    t0 = time.time()
    train_models(df_real)
    elapsed = round(time.time() - t0, 2)

    return {
        "success": True,
        "removed_baseline_rows": removed,
        "remaining_real_rows": real_count,
        "training_time_sec": elapsed,
        "message": f"Purged {removed} synthetic rows. Model retrained on {real_count} real deliveries only."
    }

@app.get("/api/analytics")
def get_analytics():
    import pandas as pd
    file_path = "historical_shipments.csv"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="No data yet")
    
    df = pd.read_csv(file_path)
    # Drop rows with missing critical fields to prevent NaN in JSON
    df = df.dropna(subset=["origin", "destination", "distance", "actual_eta_hours", "speed"])
    df = df[df["origin"].str.len() > 1]  # Filter out garbage rows
    
    # Model-driven delay classification: compare actual time vs ideal time (distance/speed)
    df["ideal_eta"] = df["distance"] / df["speed"].clip(lower=1)
    df["delay_hours"] = df["actual_eta_hours"] - df["ideal_eta"]
    
    # --- Per-Route Analysis ---
    route_stats = []
    grouped = df.groupby(["origin", "destination"])
    for (orig, dest), group in grouped:
        total = len(group)
        delayed = int((group["delay_hours"] > 0.5).sum())    # >30min late vs ideal
        early = int((group["delay_hours"] < -0.1).sum())      # arrived early vs ideal
        route_stats.append({
            "route": f"{orig} \u2192 {dest}",
            "origin": orig,
            "destination": dest,
            "total_shipments": total,
            "avg_eta_hours": round(float(group["actual_eta_hours"].mean()), 2),
            "avg_delay_hours": round(float(group["delay_hours"].mean()), 2),
            "delay_rate_pct": round((delayed / total) * 100, 1),
            "early_delivery_pct": round((early / total) * 100, 1),
            "avg_distance_miles": round(float(group["distance"].mean()), 1),
            "avg_speed": round(float(group["speed"].mean()), 1),
            "avg_traffic": round(float(group["traffic_level"].mean()), 1),
            "avg_weather": round(float(group["weather_severity"].mean()), 1),
        })
    
    route_stats.sort(key=lambda x: x["total_shipments"], reverse=True)

    # --- Overall Fleet Summary ---
    total_fleet = len(df)
    fleet_delayed = int((df["delay_hours"] > 0.5).sum())
    fleet_early = int((df["delay_hours"] < -0.1).sum())
    summary = {
        "total_records": total_fleet,
        "total_routes": len(route_stats),
        "fleet_avg_eta": round(float(df["actual_eta_hours"].mean()), 2),
        "fleet_delay_rate": round((fleet_delayed / max(total_fleet, 1)) * 100, 1),
        "fleet_early_rate": round((fleet_early / max(total_fleet, 1)) * 100, 1),
        "fleet_avg_delay_hours": round(float(df["delay_hours"].mean()), 2),
        "most_delayed_route": max(route_stats, key=lambda x: x["delay_rate_pct"])["route"] if route_stats else "N/A",
        "fastest_route": min(route_stats, key=lambda x: x["avg_eta_hours"])["route"] if route_stats else "N/A",
    }

    return {"summary": summary, "routes": route_stats}

@app.get("/api/analytics/route")
def get_route_deep(origin: str, destination: str):
    import pandas as pd
    import numpy as np
    file_path = "historical_shipments.csv"
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="No data yet")

    df = pd.read_csv(file_path)
    df = df.dropna(subset=["origin", "destination", "distance", "actual_eta_hours", "speed"])
    route_df = df[(df["origin"] == origin) & (df["destination"] == destination)].copy()

    if route_df.empty:
        raise HTTPException(status_code=404, detail=f"No data found for {origin} \u2192 {destination}")

    # Model-driven delay: compare actual vs ideal (distance/speed)
    route_df["ideal_eta"] = route_df["distance"] / route_df["speed"].clip(lower=1)
    route_df["delay_hours"] = route_df["actual_eta_hours"] - route_df["ideal_eta"]
    df["ideal_eta"] = df["distance"] / df["speed"].clip(lower=1)
    df["delay_hours"] = df["actual_eta_hours"] - df["ideal_eta"]

    total = len(route_df)
    delayed = int((route_df["delay_hours"] > 0.5).sum())
    early = int((route_df["delay_hours"] < -0.1).sum())

    # ETA distribution buckets
    min_eta = float(route_df["actual_eta_hours"].min())
    max_eta = float(route_df["actual_eta_hours"].max())
    bucket_size = max(1.0, round((max_eta - min_eta) / 8, 1))
    buckets = []
    b = min_eta
    while b < max_eta:
        count = int(((route_df["actual_eta_hours"] >= b) & (route_df["actual_eta_hours"] < b + bucket_size)).sum())
        buckets.append({"range": f"{b:.1f}\u2013{b+bucket_size:.1f}h", "count": count})
        b = round(b + bucket_size, 1)

    # Fleet average for comparison
    fleet_avg_eta = round(float(df["actual_eta_hours"].mean()), 2)
    fleet_delayed = int((df["delay_hours"] > 0.5).sum())
    fleet_delay_rate = round((fleet_delayed / max(len(df), 1)) * 100, 1)

    # Percentiles
    p25 = round(float(route_df["actual_eta_hours"].quantile(0.25)), 2)
    p50 = round(float(route_df["actual_eta_hours"].quantile(0.50)), 2)
    p75 = round(float(route_df["actual_eta_hours"].quantile(0.75)), 2)
    p95 = round(float(route_df["actual_eta_hours"].quantile(0.95)), 2)

    # Last 20 individual trips
    trips = route_df.tail(20)[["actual_eta_hours", "delay_hours", "speed", "traffic_level", "weather_severity"]].copy()
    trips["trip_no"] = range(1, len(trips) + 1)
    trips_list = trips.rename(columns={
        "actual_eta_hours": "eta_hours",
        "delay_hours": "delay_hrs",
        "traffic_level": "traffic",
        "weather_severity": "weather"
    }).round(2).to_dict(orient="records")

    return {
        "origin": origin,
        "destination": destination,
        "total_trips": total,
        "delay_rate_pct": round((delayed / total) * 100, 1),
        "early_delivery_pct": round((early / total) * 100, 1),
        "avg_delay_hours": round(float(route_df["delay_hours"].mean()), 2),
        "avg_eta": round(float(route_df["actual_eta_hours"].mean()), 2),
        "best_eta": round(min_eta, 2),
        "worst_eta": round(max_eta, 2),
        "avg_speed": round(float(route_df["speed"].mean()), 1),
        "avg_distance": round(float(route_df["distance"].mean()), 1),
        "avg_traffic": round(float(route_df["traffic_level"].mean()), 1),
        "avg_weather": round(float(route_df["weather_severity"].mean()), 1),
        "percentiles": {"p25": p25, "p50": p50, "p75": p75, "p95": p95},
        "eta_distribution": buckets,
        "fleet_avg_eta": fleet_avg_eta,
        "fleet_delay_rate": fleet_delay_rate,
        "recent_trips": trips_list
    }

class ShipmentData(BaseModel):
    priority_level: str
    cargo_type: str
    carrier_rating: float
    current_lat: float
    current_long: float
    destination_lat: float
    destination_long: float
    distance_miles: float = 0.0   # real road distance from pathfinder (0 = compute from lat/lon)
    speed: float
    is_weekend: bool
    hour_of_day: int
    traffic_level: int = 1
    weather_severity: int = 1

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "ml-service"}

@app.post("/api/predict")
def get_predictions(data: ShipmentData):
    try:
        # Pass to ML Pipeline — model-driven predictions
        delay_prob = predict_delay(data, data.traffic_level, data.weather_severity)
        eta_hours = predict_eta(data, data.traffic_level, data.weather_severity)
        delay_hrs = predict_delay_hours(data, data.traffic_level, data.weather_severity)
        
        # Get historical route stats for early delivery probability
        route_stats = get_route_stats()
        early_prob = route_stats["early_pct"]
        
        # Risk level based on MODEL-PREDICTED delay hours (not events)
        if delay_hrs > 2.0:
            risk_level = "High"
        elif delay_hrs > 0.5:
            risk_level = "Medium"
        elif delay_hrs < -0.5:
            risk_level = "Early"
        else:
            risk_level = "Low"
        
        return {
            "delay_probability": round(delay_prob, 2),
            "predicted_eta_hours": round(eta_hours, 2),
            "predicted_delay_hours": round(delay_hrs, 2),
            "early_delivery_probability": round(early_prob, 1),
            "risk_level": risk_level,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TrainRequest(BaseModel):
    origin: str
    destination: str
    distance: float
    speed: float
    traffic_level: int
    weather_severity: int
    carrier_rating: float
    actual_eta_hours: float
    delay_probability: float

@app.post("/api/train")
def train_model(req: TrainRequest):
    try:
        record_actual_shipment(
            req.origin, req.destination,
            req.distance, req.speed, req.traffic_level, 
            req.weather_severity, req.carrier_rating, 
            req.actual_eta_hours, req.delay_probability
        )
        return {"status": "success", "message": "Model retrained with new data"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

import itertools

class RouteRequest(BaseModel):
    origin: str
    destinations: list[str]

@app.post("/api/route")
def get_route(req: RouteRequest):
    # 1. OPTIMIZE ROUTE (Traveling Salesman)
    best_cost = float('inf')
    best_waypoints = []
    
    # Try all permutations of destinations to find shortest path
    for perm in itertools.permutations(req.destinations):
        current_cost = 0
        current_waypoints = [req.origin] + list(perm)
        valid = True
        
        for i in range(len(current_waypoints) - 1):
            c, p = dijkstra(current_waypoints[i], current_waypoints[i+1])
            if not p:
                valid = False
                break
            current_cost += c
            
        if valid and current_cost < best_cost:
            best_cost = current_cost
            best_waypoints = current_waypoints
            
    if best_cost == float('inf'):
         raise HTTPException(status_code=404, detail="No valid route found connecting these cities.")
         
    # 2. BUILD FULL PATH WITH WAYPOINTS
    coordinates = []
    full_path_nodes = []
    
    for i in range(len(best_waypoints) - 1):
        start = best_waypoints[i]
        end = best_waypoints[i+1]
        cost, path = dijkstra(start, end)
        
        for j, node in enumerate(path):
            if i > 0 and j == 0:
                continue # Skip duplicate overlapping start node
                
            full_path_nodes.append(node)
            # Mark as waypoint if it's the end of a leg (but not the final delivery)
            is_waypoint = (j == len(path) - 1) and (i < len(best_waypoints) - 2)
            
            coordinates.append({
                "lat": CITIES[node][0], 
                "long": CITIES[node][1], 
                "city": node,
                "isWaypoint": is_waypoint
            })
            
    return {
        "cost": best_cost,
        "path_nodes": full_path_nodes,
        "coordinates": coordinates
    }

import re

class ChatRequest(BaseModel):
    message: str

@app.post("/api/chat")
def chat_with_bot(req: ChatRequest):
    msg = req.message.lower()
    
    # 1. Extract shipment ID (e.g. shp-1001)
    match = re.search(r'shp-\d+', msg)
    shipment_id = match.group(0).upper() if match else None
    
    # 2. Mock database retrieval
    db = {
        "SHP-1001": {"status": "In Transit", "delay_probability": "12%", "eta": "2:00 PM Today", "location": "Chicago, IL"},
        "SHP-1002": {"status": "Delayed", "delay_probability": "78%", "eta": "5:00 PM Today", "location": "Los Angeles, CA"},
        "SHP-1003": {"status": "In Transit", "delay_probability": "5%", "eta": "Tomorrow 10:00 AM", "location": "New York, NY"}
    }
    
    if shipment_id:
        if shipment_id not in db:
            return {"reply": f"Sorry, I couldn't find any records for {shipment_id}."}
            
        shipment_data = db[shipment_id]
        
        if os.getenv("OPENAI_API_KEY") and os.getenv("OPENAI_API_KEY") != "dummy_key":
            try:
                prompt = f"You are a logistics assistant. Based on this data for {shipment_id}: {shipment_data}, concisely explain to the customer their status."
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a helpful supply chain assistant."},
                        {"role": "user", "content": prompt}
                    ]
                )
                return {"reply": response.choices[0].message.content}
            except Exception as e:
                return {"reply": f"AI Error: {str(e)}"}
        else:
            return {"reply": f"Your package {shipment_id} is currently in {shipment_data['location']}. Status: {shipment_data['status']}. Delay Probability: {shipment_data['delay_probability']}. ETA: {shipment_data['eta']}."}
            
    return {"reply": "Hello! I am your AI Control Tower assistant. Please provide a shipment ID like 'Where is my package SHP-1001?'"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
