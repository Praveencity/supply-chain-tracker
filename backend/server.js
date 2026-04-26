import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';
import pkg from '@prisma/client';
const { PrismaClient } = pkg;

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // We'll restrict this in production
    methods: ['GET', 'POST']
  }
});

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

app.use(cors());
app.use(express.json());

// API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', service: 'control-tower-backend' });
});

// Shipments CRUD
app.get('/api/shipments', async (req, res) => {
  try {
    const shipments = await prisma.shipments.findMany({
      include: {
        carrier: true
      }
    });
    res.json(shipments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/shipments', async (req, res) => {
  try {
    const shipment = await prisma.shipments.create({
      data: req.body
    });
    res.json(shipment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

let simSpeedMultiplier = 1.0;
const SIM_HOURS_PER_TICK = 1;
let appConfig = {
  onTheFlyModelTraining: true
};

const EVENT_CONDITIONS = {
  Traffic: { trafficLevel: 8, weatherSeverity: 1 },
  Accident: { trafficLevel: 10, weatherSeverity: 1 },
  Storm: { trafficLevel: 5, weatherSeverity: 9 },
  Breakdown: { trafficLevel: 6, weatherSeverity: 2 }
};

const getRouteDistanceBetween = (a, b) => {
  if (!a || !b) return 0;
  return Math.sqrt(Math.pow(b.lat - a.lat, 2) + Math.pow(b.long - a.long, 2));
};

const getRouteMapDistance = (path = []) => {
  return path.slice(0, -1).reduce((sum, point, index) => {
    return sum + getRouteDistanceBetween(point, path[index + 1]);
  }, 0);
};

const getRemainingMapDistance = (ship) => {
  if (!ship.path?.length) return 0;

  const currentIndex = Math.min(ship.pathIndex || 0, ship.path.length - 1);
  const currentPoint = { lat: ship.lat, long: ship.long };
  const targetPoint = ship.path[currentIndex + 1];
  let remainingMapDistance = targetPoint ? getRouteDistanceBetween(currentPoint, targetPoint) : 0;

  for (let i = currentIndex + 1; i < ship.path.length - 1; i++) {
    remainingMapDistance += getRouteDistanceBetween(ship.path[i], ship.path[i + 1]);
  }

  return remainingMapDistance;
};

const getRemainingRoadDistanceMiles = (ship) => {
  if (!ship.path?.length || !ship.roadDistanceMiles) return 0;

  const totalMapDistance = getRouteMapDistance(ship.path);
  if (totalMapDistance <= 0) return ship.roadDistanceMiles;
  const remainingMapDistance = getRemainingMapDistance(ship);

  return Math.max(0, ship.roadDistanceMiles * (remainingMapDistance / totalMapDistance));
};

const getIdealHours = (distanceMiles, speed) => distanceMiles / Math.max(speed || 50.0, 1);

const clampPrediction = (value, min, max) => Math.min(Math.max(value, min), max);

const normalizePrediction = (mlData, distanceMiles, speed) => {
  const idealHours = getIdealHours(distanceMiles, speed);
  return {
    etaHours: clampPrediction(mlData.predicted_eta_hours || idealHours, idealHours, idealHours * 4.0),
    delayHours: clampPrediction(mlData.predicted_delay_hours || 0, -idealHours * 0.25, idealHours * 3.0),
    idealHours
  };
};

const getPredictionConditions = (event) => {
  return EVENT_CONDITIONS[event?.type] || {
    trafficLevel: new Date().getHours() > 8 && new Date().getHours() < 18 ? 3 : 1,
    weatherSeverity: 1
  };
};

const updateLiveTelemetry = (ship) => {
  const distanceLeftMiles = getRemainingRoadDistanceMiles(ship);
  const timeLeftHours = getIdealHours(distanceLeftMiles, ship.speedLimit || 50.0);
  const scheduledLiveEtaHours = Math.max(0, (ship.liveExpectedArrivalHours || ship.expectedArrivalHours || ship.eta || 0) - (ship.elapsedHours || 0));
  const liveEtaHours = Math.max(scheduledLiveEtaHours, timeLeftHours);

  ship.distanceLeftMiles = parseFloat(distanceLeftMiles.toFixed(1));
  ship.timeLeftHours = parseFloat(timeLeftHours.toFixed(2));
  ship.idealRemainingHours = ship.timeLeftHours;
  ship.liveEtaHours = parseFloat(liveEtaHours.toFixed(2));
  ship.remainingEtaHours = ship.liveEtaHours;
  ship.liveDelayHours = parseFloat(Math.max(0, ship.liveEtaHours - ship.timeLeftHours).toFixed(2));
  ship.eta = ship.liveExpectedArrivalHours || ship.expectedArrivalHours || ship.eta;
};

const refreshShipmentPrediction = async (ship, event) => {
  if (ship.predictionInFlight || ship.status?.includes('Delivered')) return;

  const remainingDistanceMiles = getRemainingRoadDistanceMiles(ship);
  if (remainingDistanceMiles <= 0) return;

  ship.predictionInFlight = true;
  try {
    const conditions = getPredictionConditions(event);
    const mlResponse = await fetch('http://localhost:8000/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priority_level: 'Standard',
        cargo_type: 'Standard',
        carrier_rating: 4.0,
        current_lat: ship.lat,
        current_long: ship.long,
        destination_lat: ship.path[ship.path.length - 1].lat,
        destination_long: ship.path[ship.path.length - 1].long,
        distance_miles: remainingDistanceMiles,
        speed: ship.speedLimit || 50.0,
        is_weekend: false,
        hour_of_day: new Date().getHours(),
        traffic_level: conditions.trafficLevel,
        weather_severity: conditions.weatherSeverity
      })
    });

    const mlData = await mlResponse.json();
    if (!mlResponse.ok || mlData.error) throw new Error(mlData.error || mlData.detail || 'Prediction failed');
    if (ship.status?.includes('Delivered')) return;

    const elapsedHours = ship.elapsedHours || 0;
    const prediction = normalizePrediction(mlData, remainingDistanceMiles, ship.speedLimit || 50.0);
    const remainingEtaHours = Math.max(0, prediction.etaHours);
    ship.liveExpectedArrivalHours = parseFloat((elapsedHours + remainingEtaHours).toFixed(2));
    ship.liveEtaHours = parseFloat(remainingEtaHours.toFixed(2));
    ship.remainingEtaHours = ship.liveEtaHours;
    ship.timeLeftHours = parseFloat(prediction.idealHours.toFixed(2));
    ship.idealRemainingHours = ship.timeLeftHours;
    ship.liveDelayHours = parseFloat(Math.max(0, ship.liveEtaHours - ship.timeLeftHours).toFixed(2));
    ship.delayProb = mlData.delay_probability || 0;
    ship.predictedDelayHours = parseFloat(prediction.delayHours.toFixed(2));
    ship.earlyDeliveryProb = mlData.early_delivery_probability || 0;
    ship.expectedArrivalHours = ship.liveExpectedArrivalHours;
    ship.eta = ship.liveExpectedArrivalHours;
    ship.etaUpdatedAt = Date.now();
    ship.etaRevisionCount = (ship.etaRevisionCount || 0) + 1;
    ship.lastPredictionEventId = event?.id || null;
    ship.lastPredictionTrafficLevel = conditions.trafficLevel;
    ship.lastPredictionWeatherSeverity = conditions.weatherSeverity;
    updateLiveTelemetry(ship);
  } catch (err) {
    console.error(`ML prediction refresh error for ${ship.id}:`, err);
  } finally {
    ship.predictionInFlight = false;
  }
};

app.post('/api/sim-speed', (req, res) => {
  simSpeedMultiplier = parseFloat(req.body.multiplier) || 1.0;
  res.json({ success: true, multiplier: simSpeedMultiplier });
});

app.get('/api/config', (req, res) => {
  res.json(appConfig);
});

app.patch('/api/config', (req, res) => {
  if (typeof req.body.onTheFlyModelTraining === 'boolean') {
    appConfig.onTheFlyModelTraining = req.body.onTheFlyModelTraining;
  }
  res.json({ success: true, config: appConfig });
});

app.get('/api/shipments', (req, res) => {
  res.json(activeShipments);
});

app.delete('/api/shipments/delivered', (req, res) => {
  const before = activeShipments.length;
  activeShipments = activeShipments.filter(s => !s.status.includes('Delivered'));
  const removed = before - activeShipments.length;
  io.emit('shipments', activeShipments); // push updated list to all clients
  res.json({ success: true, removed });
});

app.post('/api/simulate-shipment', async (req, res) => {
  const { origin, destinations, speed } = req.body;
  
  try {
    // 0. Pathfinding: Get shortest path from Python
    const routeRes = await fetch('http://localhost:8000/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destinations })
    });
    const routeData = await routeRes.json();
    if (routeData.error) throw new Error(routeData.error);
    const pathCoords = routeData.coordinates;
    
    // 1. Ask ML Service for live conditions/predictions
    const mlResponse = await fetch('http://localhost:8000/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        priority_level: "Standard",
        cargo_type: "Standard",
        carrier_rating: 4.0,
        current_lat: pathCoords[0].lat,
        current_long: pathCoords[0].long,
        destination_lat: pathCoords[pathCoords.length - 1].lat,
        destination_long: pathCoords[pathCoords.length - 1].long,
        distance_miles: routeData.cost * 69.0,
        speed: parseFloat(speed) || 50.0,
        is_weekend: false,
        hour_of_day: new Date().getHours()
      })
    });
    
    const mlData = await mlResponse.json();
    // Real road distance in miles (graph cost converted: 1 unit ≈ 69 miles)
    const roadDistanceMiles = routeData.cost * 69.0;
    const speedLimit = parseFloat(speed) || 50.0;
    const prediction = normalizePrediction(mlData, roadDistanceMiles, speedLimit);
    
    // 2. Create Dummy Vehicle with Path
    const newId = `SHP-${Math.floor(Math.random() * 1000) + 2000}`;
    const newShipment = {
      id: newId,
      origin: origin,
      destination: Array.isArray(destinations) ? destinations[destinations.length - 1] : destinations,
      roadDistanceMiles: roadDistanceMiles,
      path: pathCoords,
      pathIndex: 0,
      lat: pathCoords[0].lat,
      long: pathCoords[0].long,
      targetLat: pathCoords[1].lat,
      targetLong: pathCoords[1].long,
      status: 'In Transit',
      speedLimit,
      delayProb: mlData.delay_probability || 0,
      mlPredictedEtaHours: prediction.etaHours,
      liveExpectedArrivalHours: prediction.etaHours,
      liveEtaHours: prediction.etaHours,
      eta: prediction.etaHours,
      remainingEtaHours: prediction.etaHours,
      timeLeftHours: prediction.idealHours,
      idealRemainingHours: prediction.idealHours,
      liveDelayHours: Math.max(0, prediction.etaHours - prediction.idealHours),
      predictedDelayHours: prediction.delayHours,
      earlyDeliveryProb: mlData.early_delivery_probability || 0,
      stopTimer: 0, // Used for unloading at waypoints
      delayAccumulated: 0,
      delayCauses: [],      // e.g. [{type:'Storm', addedHours:2.5}]
      currentEvent: null,   // Current event affecting the truck (informational)
      startTime: Date.now(),
      elapsedHours: 0,
      distanceLeftMiles: roadDistanceMiles,
      expectedArrivalHours: prediction.etaHours,
      etaRevisionCount: 0
    };
    
    // 3. Inject into live simulation loop
    activeShipments.push(newShipment);
    res.json(newShipment);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/shipment/:id', (req, res) => {
  const { id } = req.params;
  const before = activeShipments.length;
  activeShipments = activeShipments.filter(s => s.id !== id);
  if (activeShipments.length < before) {
    res.json({ success: true, message: `Shipment ${id} removed.` });
  } else {
    res.status(404).json({ error: 'Shipment not found' });
  }
});


// Real-time WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Real-Time Simulation Loop
let activeShipments = [];

const completeShipment = (ship) => {
  const destinationPoint = ship.path?.[ship.path.length - 1];
  if (destinationPoint) {
    ship.lat = destinationPoint.lat;
    ship.long = destinationPoint.long;
    ship.pathIndex = ship.path.length - 1;
  }

  const actualElapsedHours = ship.elapsedHours || 0;
  const predictedEta = ship.mlPredictedEtaHours || ship.eta || 0;
  const difference = actualElapsedHours - predictedEta;

  if (difference > 0.1) {
    ship.status = `Delivered Late (by ${difference.toFixed(1)}h)`;
    ship.earlyBy = 0;
  } else if (difference < -0.1) {
    const earlyBy = Math.abs(difference);
    ship.status = `Delivered Early (by ${earlyBy.toFixed(1)}h)`;
    ship.earlyBy = parseFloat(earlyBy.toFixed(1));
  } else {
    ship.status = 'Delivered On-Time';
    ship.earlyBy = 0;
  }

  ship.currentEvent = null;
  ship.stopTimer = 0;
  ship.predictionInFlight = false;
  ship.distanceLeftMiles = 0;
  ship.timeLeftHours = 0;
  ship.idealRemainingHours = 0;
  ship.liveEtaHours = 0;
  ship.remainingEtaHours = 0;
  ship.liveDelayHours = 0;
  ship.liveExpectedArrivalHours = actualElapsedHours;
  ship.expectedArrivalHours = actualElapsedHours;

  if (!appConfig.onTheFlyModelTraining) return;

  const dist = ship.roadDistanceMiles || (Math.sqrt(Math.pow(ship.path[ship.path.length - 1].lat - ship.path[0].lat, 2) + Math.pow(ship.path[ship.path.length - 1].long - ship.path[0].long, 2)) * 69.0);
  const idealHours = dist / Math.max(ship.speedLimit || 50.0, 1);
  const actualDelayRatio = (actualElapsedHours - idealHours) / Math.max(idealHours, 0.1);

  fetch('http://localhost:8000/api/train', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin: ship.origin || 'Unknown',
      destination: ship.destination || 'Unknown',
      distance: dist,
      speed: ship.speedLimit || 50.0,
      traffic_level: new Date().getHours() > 8 && new Date().getHours() < 18 ? 8 : 3,
      weather_severity: ship.delayAccumulated > 2 ? 8 : 2,
      carrier_rating: 4.5,
      actual_eta_hours: actualElapsedHours,
      delay_probability: Math.min(Math.max(actualDelayRatio, 0.0), 1.0)
    })
  }).catch(err => console.error('ML Training error:', err));
};

// GTA-Style Dynamic World Events Engine
let activeEvents = [];
const CITIES_ARRAY = [
  { name: "New York", lat: 40.7128, long: -74.0060 },
  { name: "Chicago", lat: 41.8781, long: -87.6298 },
  { name: "Miami", lat: 25.7617, long: -80.1918 },
  { name: "Dallas", lat: 32.7767, long: -96.7970 },
  { name: "Denver", lat: 39.7392, long: -104.9903 },
  { name: "Los Angeles", lat: 34.0522, long: -118.2437 },
  { name: "San Francisco", lat: 37.7749, long: -122.4194 },
  { name: "Seattle", lat: 47.6062, long: -122.3321 },
  { name: "Atlanta", lat: 33.7490, long: -84.3880 },
  { name: "Phoenix", lat: 33.4484, long: -112.0740 },
  { name: "Minneapolis", lat: 44.9778, long: -93.2650 },
  { name: "Boston", lat: 42.3601, long: -71.0589 },
  { name: "Houston", lat: 29.7604, long: -95.3698 },
  { name: "Philadelphia", lat: 39.9526, long: -75.1652 },
  { name: "San Diego", lat: 32.7157, long: -117.1611 },
  { name: "Detroit", lat: 42.3314, long: -83.0458 },
  { name: "Portland", lat: 45.5152, long: -122.6784 },
  { name: "Las Vegas", lat: 36.1699, long: -115.1398 },
  { name: "Salt Lake City", lat: 40.7608, long: -111.8910 },
  { name: "Charlotte", lat: 35.2271, long: -80.8431 },
  { name: "Kansas City", lat: 39.0997, long: -94.5786 },
  { name: "Indianapolis", lat: 39.7684, long: -86.1581 },
  { name: "Nashville", lat: 36.1627, long: -86.7816 },
  { name: "New Orleans", lat: 29.9511, long: -90.0715 },
  { name: "Washington, DC", lat: 38.9072, long: -77.0369 }
];

setInterval(() => {
  if (activeEvents.length < 5 && Math.random() > 0.3) {
    const city = CITIES_ARRAY[Math.floor(Math.random() * CITIES_ARRAY.length)];
    
    const rand = Math.random();
    let type = 'Traffic';
    let radius = 2.0; // Degrees
    let duration = 30000;
    
    if (rand < 0.10) { type = 'Accident'; radius = 0.5; duration = 45000; } 
    else if (rand < 0.25) { type = 'Storm'; radius = 4.0; duration = 60000; } 
    else if (rand < 0.45) { type = 'Breakdown'; radius = 0.5; duration = 20000; } 
    
    activeEvents.push({
      id: `EVT-${Date.now()}`,
      type,
      city: city.name,
      lat: city.lat + (Math.random() - 0.5) * 4, // Offset in degrees
      long: city.long + (Math.random() - 0.5) * 4,
      radius,
      expiresAt: Date.now() + duration
    });
  }
  
  const now = Date.now();
  activeEvents = activeEvents.filter(e => e.expiresAt > now);
  io.emit('world_events', activeEvents);
}, 5000);

setInterval(() => {
  activeShipments = activeShipments.map(ship => {
    if (ship.status?.includes('Delivered')) return ship;
    const tickHours = SIM_HOURS_PER_TICK * simSpeedMultiplier;
    ship.elapsedHours = parseFloat(((ship.elapsedHours || 0) + tickHours).toFixed(2));
    updateLiveTelemetry(ship);
    
    // Check if stopped at a waypoint for unloading
    if (ship.stopTimer > 0) {
      ship.stopTimer = Math.max(0, ship.stopTimer - tickHours);
      ship.status = `Unloading (${ship.stopTimer.toFixed(1)}h)`;
      if (ship.stopTimer <= 0) ship.status = 'In Transit';
      return ship;
    }
    
    // Check if inside event zone
    let inEvent = null;
    for (let ev of activeEvents) {
      const distToEv = Math.sqrt(Math.pow(ev.lat - ship.lat, 2) + Math.pow(ev.long - ship.long, 2));
      if (distToEv < ev.radius) {
        inEvent = ev;
        break;
      }
    }
    
    const latDiff = ship.targetLat - ship.lat;
    const longDiff = ship.targetLong - ship.long;
    const distToTarget = Math.sqrt(latDiff * latDiff + longDiff * longDiff);
    
    const remainingMapDistance = getRemainingMapDistance(ship);
    const scheduledArrivalHours = ship.liveExpectedArrivalHours || ship.expectedArrivalHours || ship.eta || 0;
    const remainingEtaHours = Math.max(scheduledArrivalHours - (ship.elapsedHours || 0), tickHours);
    let baseSpeed = remainingMapDistance > 0 ? (remainingMapDistance / remainingEtaHours) * tickHours : 0;
    
    if (inEvent) {
      const eventSpeedFactor = inEvent.type === 'Accident' ? 0.05 : inEvent.type === 'Storm' ? 0.20 : inEvent.type === 'Breakdown' ? 0 : 0.50;
      const hoursLost = tickHours * (1 - eventSpeedFactor);
      baseSpeed *= eventSpeedFactor;
      ship.delayAccumulated += hoursLost;

      // Record cause (merge with last entry if same type)
      const last = ship.delayCauses[ship.delayCauses.length - 1];
      if (last && last.type === inEvent.type) {
        last.addedHours = parseFloat((last.addedHours + hoursLost).toFixed(1));
      } else {
        ship.delayCauses.push({ type: inEvent.type, addedHours: parseFloat(hoursLost.toFixed(1)) });
      }

      // Informational: track what event is affecting the truck (NOT a status change)
      ship.currentEvent = inEvent.type;
      if (ship.lastPredictionEventId !== inEvent.id) refreshShipmentPrediction(ship, inEvent);
      ship.status = `In Transit (${inEvent.type} Zone)`;
    } else {
      ship.currentEvent = null;
      ship.status = 'In Transit';
    }
    updateLiveTelemetry(ship);
    
    if (distToTarget <= Math.max(baseSpeed, 0.000001)) {
      if (ship.path && ship.pathIndex < ship.path.length - 2) {
        ship.pathIndex++;
        ship.lat = ship.targetLat;
        ship.long = ship.targetLong;
        ship.targetLat = ship.path[ship.pathIndex + 1].lat;
        ship.targetLong = ship.path[ship.pathIndex + 1].long;
        
        // Stop at intermediate destinations
        if (ship.path[ship.pathIndex].isWaypoint) {
            ship.stopTimer = 0.25; // 15 model minutes unloading at each intermediate stop
         }
      } else {
        completeShipment(ship);
      }
    } else if (distToTarget > 0 && baseSpeed > 0) {
      ship.lat += (latDiff / distToTarget) * baseSpeed;
      ship.long += (longDiff / distToTarget) * baseSpeed;
      ship.lat += (Math.random() - 0.5) * 0.005; 
      ship.long += (Math.random() - 0.5) * 0.005;
    }
    
    return ship;
  });
  
  io.emit('shipment_updates', activeShipments);
}, 1000);

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Control Tower Backend running on http://localhost:${PORT}`);
});
