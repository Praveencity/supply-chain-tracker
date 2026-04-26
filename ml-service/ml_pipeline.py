import random
import pandas as pd
import numpy as np
import joblib
import os
from sklearn.ensemble import GradientBoostingRegressor

MODEL_DIR = "models"
os.makedirs(MODEL_DIR, exist_ok=True)

DELAY_MODEL_PATH = os.path.join(MODEL_DIR, "gb_delay_model.pkl")
ETA_MODEL_PATH = os.path.join(MODEL_DIR, "gb_eta_model.pkl")
DELAY_HOURS_MODEL_PATH = os.path.join(MODEL_DIR, "gb_delay_hours_model.pkl")
ETA_MODEL_VERSION_PATH = os.path.join(MODEL_DIR, "gb_eta_model.version")
HISTORICAL_DATA_PATH = "historical_shipments.csv"
ETA_MODEL_VERSION = "eta_added_delay_v1"

def generate_synthetic_data(num_samples=500):
    """Generate IDEAL baseline data — perfect conditions, no delays.
    This represents the best possible delivery times the model should learn as its baseline.
    Real-world completed trips (with delays) are appended on top via record_actual_shipment().
    """
    print("Generating ideal baseline shipment data...")
    cities = ["New York", "Chicago", "Miami", "Dallas", "Denver", "Los Angeles", "San Francisco", "Seattle", "Atlanta", "Phoenix", "Boston", "Houston"]
    data = []
    for _ in range(num_samples):
        orig = random.choice(cities)
        dest = random.choice(cities)
        while dest == orig: dest = random.choice(cities)

        distance = random.uniform(50, 3000)    # miles
        speed    = random.uniform(55, 75)       # optimal highway speed
        traffic_level     = random.randint(1, 2)  # near-zero congestion
        weather_severity  = random.randint(1, 2)  # clear skies
        carrier_rating    = random.uniform(4.5, 5.0)  # top-rated carrier

        # Ideal ETA: pure distance / speed, no penalties
        actual_hours = distance / speed

        delay_prob = random.uniform(0.0, 0.05)  # near-zero delay chance

        data.append({
            'origin':           orig,
            'destination':      dest,
            'distance':         distance,
            'speed':            speed,
            'traffic_level':    traffic_level,
            'weather_severity': weather_severity,
            'carrier_rating':   carrier_rating,
            'actual_eta_hours': actual_hours,
            'delay_probability': delay_prob
        })
    return pd.DataFrame(data)


def train_models(df=None):
    if df is None:
        if os.path.exists(HISTORICAL_DATA_PATH):
            df = pd.read_csv(HISTORICAL_DATA_PATH)
        else:
            df = generate_synthetic_data(500)
            df.to_csv(HISTORICAL_DATA_PATH, index=False)
            
    features = ['distance', 'speed', 'traffic_level', 'weather_severity', 'carrier_rating']
    # Drop rows with any NaN values to prevent training errors
    df = df.dropna(subset=features + ['actual_eta_hours', 'delay_probability'])
    # Compute delay_hours: how much longer than ideal (distance/speed) did the delivery take
    # Positive = delayed, Negative = early (faster than ideal)
    df['ideal_eta'] = df['distance'] / df['speed'].clip(lower=1)
    df['delay_hours'] = df['actual_eta_hours'] - df['ideal_eta']
    X = df[features]
    # ETA is predicted as ideal time + non-negative added delay. This keeps the
    # model from learning physically impossible below-ideal travel times.
    y_eta_added_delay = df['delay_hours'].clip(lower=0)
    y_delay = df['delay_probability']
    y_delay_hours = df['delay_hours']
    
    print("Training ETA Added Delay Model (Gradient Boosting)...")
    global eta_model, delay_model, delay_hours_model
    eta_model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42)
    eta_model.fit(X, y_eta_added_delay)
    eta_model.target_semantics = ETA_MODEL_VERSION
    joblib.dump(eta_model, ETA_MODEL_PATH)
    with open(ETA_MODEL_VERSION_PATH, "w") as f:
        f.write(ETA_MODEL_VERSION)
    
    print("Training Delay Probability Model (Gradient Boosting)...")
    delay_model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42)
    delay_model.fit(X, y_delay)
    joblib.dump(delay_model, DELAY_MODEL_PATH)
    
    print("Training Delay Hours Model (Gradient Boosting)...")
    delay_hours_model = GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=4, random_state=42)
    delay_hours_model.fit(X, y_delay_hours)
    joblib.dump(delay_hours_model, DELAY_HOURS_MODEL_PATH)
    
    print("All models trained and saved successfully!")

_record_count = 0  # Track deliveries since last retrain

def record_actual_shipment(origin, destination, distance, speed, traffic_level, weather_severity, carrier_rating, actual_eta_hours, delay_prob):
    global _record_count
    
    # Append new row efficiently (avoids reading entire CSV)
    new_row = {
        'origin': origin,
        'destination': destination,
        'distance': distance,
        'speed': speed,
        'traffic_level': traffic_level,
        'weather_severity': weather_severity,
        'carrier_rating': carrier_rating,
        'actual_eta_hours': actual_eta_hours,
        'delay_probability': delay_prob
    }
    
    if os.path.exists(HISTORICAL_DATA_PATH):
        new_data = pd.DataFrame([new_row])
        new_data.to_csv(HISTORICAL_DATA_PATH, mode='a', header=False, index=False)
    else:
        df = generate_synthetic_data(100)
        df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
        df.to_csv(HISTORICAL_DATA_PATH, index=False)
    
    # Retrain every 10 deliveries instead of every single one
    # (prevents Windows "too many file descriptors" crash)
    _record_count += 1
    if _record_count >= 10:
        _record_count = 0
        print(f"Auto-retraining after 10 new deliveries...")
        df = pd.read_csv(HISTORICAL_DATA_PATH)
        train_models(df)

def get_route_stats(origin=None, destination=None):
    """Get historical statistics for a route or overall fleet.
    Returns: dict with avg_eta, total_trips, early_pct, delayed_pct, avg_delay_hours
    """
    if not os.path.exists(HISTORICAL_DATA_PATH):
        return {"avg_eta": 0, "total_trips": 0, "early_pct": 0, "delayed_pct": 0, "avg_delay_hours": 0}
    
    df = pd.read_csv(HISTORICAL_DATA_PATH)
    df = df.dropna(subset=["distance", "speed", "actual_eta_hours"])
    
    # Compute delay hours for each record
    df['ideal_eta'] = df['distance'] / df['speed'].clip(lower=1)
    df['delay_hours'] = df['actual_eta_hours'] - df['ideal_eta']
    
    # Filter to specific route if provided
    if origin and destination:
        route_df = df[(df['origin'] == origin) & (df['destination'] == destination)]
        if len(route_df) < 3:
            route_df = df  # Fallback to fleet-wide stats if route data is sparse
    else:
        route_df = df
    
    total = len(route_df)
    if total == 0:
        return {"avg_eta": 0, "total_trips": 0, "early_pct": 0, "delayed_pct": 0, "avg_delay_hours": 0}
    
    early_count = int((route_df['delay_hours'] < -0.1).sum())    # arrived >6min early
    delayed_count = int((route_df['delay_hours'] > 0.5).sum())   # arrived >30min late
    
    return {
        "avg_eta": round(float(route_df['actual_eta_hours'].mean()), 2),
        "total_trips": total,
        "early_pct": round((early_count / total) * 100, 1),
        "delayed_pct": round((delayed_count / total) * 100, 1),
        "avg_delay_hours": round(float(route_df['delay_hours'].mean()), 2),
    }


# Ensure dataset exists
if not os.path.exists(HISTORICAL_DATA_PATH):
    print("Historical data not found. Generating initial dataset...")
    init_df = generate_synthetic_data(500)
    init_df.to_csv(HISTORICAL_DATA_PATH, index=False)

# Load models into memory
try:
    eta_model = joblib.load(ETA_MODEL_PATH)
    delay_model = joblib.load(DELAY_MODEL_PATH)
    try:
        delay_hours_model = joblib.load(DELAY_HOURS_MODEL_PATH)
    except FileNotFoundError:
        print("Delay Hours model not found. Training all models now...")
        train_models()
except FileNotFoundError:
    print("Models not found. Training them now...")
    train_models()

def _get_distance_miles(data):
    """Helper: get distance in miles from data, using road distance or lat/lon fallback."""
    if hasattr(data, 'distance_miles') and data.distance_miles:
        return data.distance_miles
    dist = ((data.destination_lat - data.current_lat)**2 + (data.destination_long - data.current_long)**2)**0.5
    return dist * 69.0

def predict_delay(data, traffic_level=1, weather_severity=1):
    # Use real road distance if passed directly, else fall back to lat/lon estimate
    dist_miles = _get_distance_miles(data)
    
    X_pred = pd.DataFrame([{
        'distance': dist_miles,
        'speed': data.speed,
        'traffic_level': traffic_level,
        'weather_severity': weather_severity,
        'carrier_rating': data.carrier_rating
    }])
    
    prob = delay_model.predict(X_pred)[0]
    return min(max(prob, 0.0), 1.0)

def predict_eta(data, traffic_level=1, weather_severity=1):
    # Use real road distance if passed directly, else fall back to lat/lon estimate
    dist_miles = _get_distance_miles(data)
    ideal_eta = dist_miles / max(data.speed, 1)
    
    X_pred = pd.DataFrame([{
        'distance': dist_miles,
        'speed': data.speed,
        'traffic_level': traffic_level,
        'weather_severity': weather_severity,
        'carrier_rating': data.carrier_rating
    }])
    
    raw_added_delay = eta_model.predict(X_pred)[0]
    return ideal_eta + raw_added_delay

def predict_delay_hours(data, traffic_level=1, weather_severity=1):
    """Predict how many hours of delay (positive) or early arrival (negative) to expect.
    This is the MODEL-DRIVEN delay/early classification — not event-based.
    """
    dist_miles = _get_distance_miles(data)
    ideal_eta = dist_miles / max(data.speed, 1)
    
    X_pred = pd.DataFrame([{
        'distance': dist_miles,
        'speed': data.speed,
        'traffic_level': traffic_level,
        'weather_severity': weather_severity,
        'carrier_rating': data.carrier_rating
    }])
    
    raw_delay_hours = delay_hours_model.predict(X_pred)[0]
    # Delay hours are relative to ideal ETA. Early arrival cannot reasonably exceed
    # 25% of ideal travel time, and delays are capped to avoid unstable UI values.
    return float(np.clip(raw_delay_hours, -ideal_eta * 0.25, ideal_eta * 3.0))
