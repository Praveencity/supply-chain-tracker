import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

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

app.post('/api/sim-speed', (req, res) => {
  simSpeedMultiplier = parseFloat(req.body.multiplier) || 1.0;
  res.json({ success: true, multiplier: simSpeedMultiplier });
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
      delayProb: mlData.delay_probability,
      eta: mlData.predicted_eta_hours,
      predictedDelayHours: mlData.predicted_delay_hours || 0,
      earlyDeliveryProb: mlData.early_delivery_probability || 0,
      stopTimer: 0, // Used for unloading at waypoints
      delayAccumulated: 0,
      delayCauses: [],      // e.g. [{type:'Storm', addedHours:2.5}]
      currentEvent: null,   // Current event affecting the truck (informational)
      startTime: Date.now(),
      expectedArrival: Date.now() + (mlData.predicted_eta_hours * 60 * 60 * 1000)
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
    if (ship.status === 'Delivered') return ship;
    
    // Check if stopped at a waypoint for unloading
    if (ship.stopTimer > 0) {
      ship.stopTimer -= 1000 * simSpeedMultiplier; 
      ship.status = `Unloading (${Math.ceil(ship.stopTimer/1000)}s)`;
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
    
    // Convert speed back to map degrees per tick (Accelerated 6x)
    let baseSpeed = (ship.speedLimit ? ship.speedLimit / 500 : 0.1) * simSpeedMultiplier; 
    
    if (inEvent) {
      // Events still physically slow the truck, but DON'T set "Delayed" status
      if (inEvent.type === 'Accident') baseSpeed *= 0.05;
      else if (inEvent.type === 'Storm') baseSpeed *= 0.20;
      else if (inEvent.type === 'Breakdown') baseSpeed = 0;
      else baseSpeed *= 0.50;

      const hoursLost = 0.5 * simSpeedMultiplier;
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
      ship.status = `In Transit (${inEvent.type} Zone)`;
    } else {
      ship.currentEvent = null;
      ship.status = 'In Transit';
    }
    
    if (distToTarget < baseSpeed) {
      if (ship.path && ship.pathIndex < ship.path.length - 2) {
        ship.pathIndex++;
        ship.lat = ship.targetLat;
        ship.long = ship.targetLong;
        ship.targetLat = ship.path[ship.pathIndex + 1].lat;
        ship.targetLong = ship.path[ship.pathIndex + 1].long;
        
        // Stop at intermediate destinations
        if (ship.path[ship.pathIndex].isWaypoint) {
           ship.stopTimer = 5000; // Stop for 5 seconds
        }
      } else {
        if (!ship.status.includes('Delivered')) {
          // ML-DRIVEN DELIVERY CLASSIFICATION
          // Compare actual delivery time vs ML-predicted ETA
          const actualElapsedHours = (Date.now() - ship.startTime) / (1000 * 60 * 60);
          const predictedEta = ship.eta; // ML model's prediction
          const difference = actualElapsedHours - predictedEta;
          
          if (difference > 0.1) {
            // Took longer than ML predicted → Delivered Late
            ship.status = `Delivered Late (by ${difference.toFixed(1)}h)`;
            ship.earlyBy = 0;
          } else if (difference < -0.1) {
            // Arrived faster than ML predicted → Delivered Early
            const earlyBy = Math.abs(difference);
            ship.status = `Delivered Early (by ${earlyBy.toFixed(1)}h)`;
            ship.earlyBy = parseFloat(earlyBy.toFixed(1));
          } else {
            ship.status = 'Delivered On-Time';
            ship.earlyBy = 0;
          }
          
          // Continuous ML Learning: Report actual delivery data back to Python
          // The model learns from ACTUAL delivery times to improve future predictions
          const dist = ship.roadDistanceMiles || (Math.sqrt(Math.pow(ship.path[ship.path.length-1].lat - ship.path[0].lat, 2) + Math.pow(ship.path[ship.path.length-1].long - ship.path[0].long, 2)) * 69.0);
          const idealHours = dist / Math.max(ship.speedLimit || 50.0, 1);
          const actualDelayRatio = (actualElapsedHours - idealHours) / Math.max(idealHours, 0.1);
          
          fetch('http://localhost:8000/api/train', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              origin: ship.origin || "Unknown",
              destination: ship.destination || "Unknown",
              distance: dist,
              speed: ship.speedLimit || 50.0,
              traffic_level: new Date().getHours() > 8 && new Date().getHours() < 18 ? 8 : 3,
              weather_severity: ship.delayAccumulated > 2 ? 8 : 2, 
              carrier_rating: 4.5,
              actual_eta_hours: actualElapsedHours,
              delay_probability: Math.min(Math.max(actualDelayRatio, 0.0), 1.0)
            })
          }).catch(err => console.error("ML Training error:", err));
        }
      }
    } else {
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
