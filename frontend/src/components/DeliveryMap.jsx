import React from 'react';
import { MapContainer, Marker, Popup, Circle, Polyline, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const createTruckIcon = (status, isSelected = false) => {
  const isDelayed = status.includes('Late');
  const isDelivered = status.includes('Delivered');
  const isEarly = status.includes('Early');
  const inEventZone = status.includes('Zone');
  const color = isDelayed ? '#ef4444' : isEarly ? '#22d3ee' : isDelivered ? '#10b981' : inEventZone ? '#f59e0b' : '#38bdf8';
  const size = isSelected ? 44 : 36;
  const inner = size - 4;
  const pulseAnim = !isDelivered ? `animation: truckPulse 2s ease-in-out infinite;` : '';
  const html = `
    <div style="position:relative;width:${size}px;height:${size}px;">
      <style>@keyframes truckPulse{0%,100%{box-shadow:0 0 6px 0 ${color}66}50%{box-shadow:0 0 18px 6px ${color}88}}</style>
      <div style="
        position:absolute;top:2px;left:2px;
        width:${inner}px;height:${inner}px;border-radius:50%;
        background:${isSelected ? color + '22' : '#0f172a'};
        border:${isSelected ? 3 : 2}px solid ${color};
        display:flex;align-items:center;justify-content:center;
        ${pulseAnim}
        color:white;font-size:${isSelected ? 18 : 14}px;
      ">🚛</div>
      ${!isDelivered ? `<div style="
        position:absolute;top:-3px;left:-3px;width:${size + 6}px;height:${size + 6}px;
        border-radius:50%;border:2px solid ${color}33;
      "></div>` : ''}
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2], popupAnchor: [0, -size / 2] });
};

const createFlagIcon = (label, color) => {
  const lines = label.split('\n');
  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
      <div style="
        background:${color};color:white;font-size:10px;font-weight:bold;
        padding:3px 8px;border-radius:6px;white-space:nowrap;
        box-shadow:0 2px 10px ${color}88,0 1px 3px rgba(0,0,0,0.5);
        text-align:center;line-height:1.4;border:1px solid ${color}88;
      ">${lines.join('<br/>')}</div>
      <div style="width:2px;height:14px;background:${color};box-shadow:0 0 4px ${color};"></div>
      <div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};"></div>
    </div>`;
  return L.divIcon({ html, className: '', iconSize: [110, 55], iconAnchor: [55, 55], popupAnchor: [0, -55] });
};

const createCityLabel = (name) => {
  const html = `<div style="
    color:#94a3b8;font-size:9px;font-weight:600;letter-spacing:0.5px;
    text-shadow:0 0 6px #0f172a, 0 0 12px #0f172a, 0 1px 2px #000;
    white-space:nowrap;pointer-events:none;
  ">${name}</div>`;
  return L.divIcon({ html, className: '', iconSize: [100, 16], iconAnchor: [50, -12] });
};

const createEventLabel = (ev) => {
  const icons = { Storm: '🌩️', Accident: '💥', Breakdown: '🔧', Traffic: '🚦' };
  const colors = { Storm: '#38bdf8', Accident: '#ef4444', Breakdown: '#f97316', Traffic: '#eab308' };
  const c = colors[ev.type] || '#eab308';
  const timeLeft = Math.max(0, Math.ceil((ev.expiresAt - Date.now()) / 1000));
  const html = `<div style="
    background:rgba(15,23,42,0.92);border:1px solid ${c}55;border-radius:8px;
    padding:4px 8px;font-size:10px;font-weight:bold;color:${c};
    box-shadow:0 2px 12px ${c}33;white-space:nowrap;text-align:center;
    backdrop-filter:blur(4px);
  ">${icons[ev.type] || '⚠'} ${ev.type}<br/><span style="color:#94a3b8;font-weight:400;font-size:9px">near ${ev.city}</span></div>`;
  return L.divIcon({ html, className: '', iconSize: [120, 40], iconAnchor: [60, 50] });
};

const CITIES = [
  { name: "New York", coords: [40.7128, -74.0060] },
  { name: "Chicago", coords: [41.8781, -87.6298] },
  { name: "Miami", coords: [25.7617, -80.1918] },
  { name: "Dallas", coords: [32.7767, -96.7970] },
  { name: "Denver", coords: [39.7392, -104.9903] },
  { name: "Los Angeles", coords: [34.0522, -118.2437] },
  { name: "San Francisco", coords: [37.7749, -122.4194] },
  { name: "Seattle", coords: [47.6062, -122.3321] },
  { name: "Atlanta", coords: [33.7490, -84.3880] },
  { name: "Phoenix", coords: [33.4484, -112.0740] },
  { name: "Minneapolis", coords: [44.9778, -93.2650] },
  { name: "Boston", coords: [42.3601, -71.0589] },
  { name: "Houston", coords: [29.7604, -95.3698] },
  { name: "Philadelphia", coords: [39.9526, -75.1652] },
  { name: "San Diego", coords: [32.7157, -117.1611] },
  { name: "Detroit", coords: [42.3314, -83.0458] },
  { name: "Portland", coords: [45.5152, -122.6784] },
  { name: "Las Vegas", coords: [36.1699, -115.1398] },
  { name: "Salt Lake City", coords: [40.7608, -111.8910] },
  { name: "Charlotte", coords: [35.2271, -80.8431] },
  { name: "Kansas City", coords: [39.0997, -94.5786] },
  { name: "Indianapolis", coords: [39.7684, -86.1581] },
  { name: "Nashville", coords: [36.1627, -86.7816] },
  { name: "New Orleans", coords: [29.9511, -90.0715] },
  { name: "Washington, DC", coords: [38.9072, -77.0369] }
];

const EDGES = [
  [[40.7128, -74.0060], [42.3601, -71.0589]], [[40.7128, -74.0060], [41.8781, -87.6298]], [[40.7128, -74.0060], [33.7490, -84.3880]],
  [[41.8781, -87.6298], [44.9778, -93.2650]], [[41.8781, -87.6298], [39.7392, -104.9903]], [[41.8781, -87.6298], [33.7490, -84.3880]],
  [[33.7490, -84.3880], [25.7617, -80.1918]], [[33.7490, -84.3880], [32.7767, -96.7970]],
  [[32.7767, -96.7970], [33.4484, -112.0740]], [[32.7767, -96.7970], [39.7392, -104.9903]],
  [[44.9778, -93.2650], [39.7392, -104.9903]], [[44.9778, -93.2650], [47.6062, -122.3321]],
  [[39.7392, -104.9903], [33.4484, -112.0740]], [[39.7392, -104.9903], [37.7749, -122.4194]],
  [[33.4484, -112.0740], [34.0522, -118.2437]], [[34.0522, -118.2437], [37.7749, -122.4194]],
  [[37.7749, -122.4194], [47.6062, -122.3321]],
  [[38.9072, -77.0369], [40.7128, -74.0060]], [[38.9072, -77.0369], [39.9526, -75.1652]], [[38.9072, -77.0369], [35.2271, -80.8431]],
  [[39.9526, -75.1652], [40.7128, -74.0060]],
  [[35.2271, -80.8431], [33.7490, -84.3880]], [[35.2271, -80.8431], [36.1627, -86.7816]],
  [[36.1627, -86.7816], [33.7490, -84.3880]], [[36.1627, -86.7816], [39.7684, -86.1581]],
  [[39.7684, -86.1581], [41.8781, -87.6298]], [[39.7684, -86.1581], [42.3314, -83.0458]],
  [[42.3314, -83.0458], [41.8781, -87.6298]],
  [[39.0997, -94.5786], [41.8781, -87.6298]], [[39.0997, -94.5786], [39.7392, -104.9903]], [[39.0997, -94.5786], [32.7767, -96.7970]],
  [[29.7604, -95.3698], [32.7767, -96.7970]], [[29.7604, -95.3698], [29.9511, -90.0715]],
  [[29.9511, -90.0715], [33.7490, -84.3880]],
  [[40.7608, -111.8910], [39.7392, -104.9903]], [[40.7608, -111.8910], [36.1699, -115.1398]], [[40.7608, -111.8910], [37.7749, -122.4194]],
  [[36.1699, -115.1398], [34.0522, -118.2437]], [[36.1699, -115.1398], [33.4484, -112.0740]],
  [[32.7157, -117.1611], [34.0522, -118.2437]], [[32.7157, -117.1611], [33.4484, -112.0740]],
  [[45.5152, -122.6784], [47.6062, -122.3321]], [[45.5152, -122.6784], [37.7749, -122.4194]]
];

const getEventColor = (type) => {
  if (type === 'Storm') return '#38bdf8';
  if (type === 'Accident') return '#ef4444';
  if (type === 'Breakdown') return '#f97316';
  return '#eab308';
};

const getTrafficChunks = (trafficEvents) => {
  const chunks = [];
  trafficEvents.forEach(ev => {
    const radiusDeg = ev.radius || 2;
    EDGES.forEach(([[ay, ax], [by, bx]]) => {
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return;
      let t = ((ev.lat - ay) * dy + (ev.long - ax) * dx) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const nearY = ay + t * dy, nearX = ax + t * dx;
      const dist = Math.sqrt((ev.lat - nearY) ** 2 + (ev.long - nearX) ** 2);
      if (dist > radiusDeg) return;
      const halfChunk = radiusDeg * 0.8;
      const segLen = Math.sqrt(lenSq);
      const tStart = Math.max(0, t - halfChunk / segLen);
      const tEnd = Math.min(1, t + halfChunk / segLen);
      chunks.push([
        [ay + tStart * dy, ax + tStart * dx],
        [ay + tEnd * dy, ax + tEnd * dx],
      ]);
    });
  });
  return chunks;
};

export default function DeliveryMap({ shipments, worldEvents = [], onSelectTruck, selectedTruckId }) {
  const center = [39.8283, -98.5795];
  const selectedTruck = selectedTruckId ? shipments.find(s => s.id === selectedTruckId) : null;
  const originCity = selectedTruck ? CITIES.find(c => c.name === selectedTruck.origin) : null;
  const destCity = selectedTruck ? CITIES.find(c => c.name === selectedTruck.destination) : null;
  const trafficEvents = worldEvents.filter(ev => ev.type === 'Traffic');
  const trafficEdges = getTrafficChunks(trafficEvents);

  // Completed portion of path (trail behind truck)
  const completedPath = selectedTruck?.path?.length > 1 && selectedTruck.pathIndex > 0
    ? selectedTruck.path.slice(0, selectedTruck.pathIndex + 1).map(p => [p.lat, p.long])
    : null;
  // Remaining path ahead
  const remainingPath = selectedTruck?.path?.length > 1
    ? selectedTruck.path.slice(selectedTruck.pathIndex).map(p => [p.lat, p.long])
    : null;

  // Stats overlay data
  const activeCount = shipments.filter(s => !s.status.includes('Delivered')).length;
  const eventCount = worldEvents.length;
  const inEventCount = shipments.filter(s => s.status.includes('Zone')).length;

  return (
    <div className="w-full h-full rounded-xl overflow-hidden shadow-2xl relative z-0 border border-dark-700 bg-slate-900">
      <MapContainer center={center} zoom={4} style={{ width: '100%', height: '100%', zIndex: 0 }}>
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CartoDB</a>'
        />

        {/* Highway network */}
        {EDGES.map((positions, idx) => (
          <Polyline key={idx} positions={positions} color="#1e40af" weight={2} opacity={0.4} />
        ))}
        {EDGES.map((positions, idx) => (
          <Polyline key={`glow-${idx}`} positions={positions} color="#38bdf8" weight={1} opacity={0.12} dashArray="4, 8" />
        ))}

        {/* Traffic congestion overlays */}
        {trafficEdges.map((positions, idx) => (
          <Polyline key={`traffic-${idx}`} positions={positions} color="#ef4444" weight={7} opacity={0.85}>
            <Popup>
              <div style={{ color: '#1e293b', fontWeight: 'bold' }}>🚨 Heavy Traffic Congestion</div>
            </Popup>
          </Polyline>
        ))}

        {/* City nodes */}
        {CITIES.map((city, idx) => (
          <React.Fragment key={`city-${idx}`}>
            <Circle
              center={city.coords}
              radius={22000}
              pathOptions={{ color: '#38bdf8', fillColor: '#0ea5e9', fillOpacity: 0.9, weight: 1.5 }}
            >
              <Popup>
                <div style={{ background: '#0f172a', color: '#38bdf8', fontWeight: 'bold', fontSize: '13px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #38bdf855' }}>
                  📍 {city.name}
                </div>
              </Popup>
            </Circle>
            {/* City name labels */}
            <Marker position={city.coords} icon={createCityLabel(city.name)} interactive={false} />
          </React.Fragment>
        ))}

        {/* Selected route — completed trail (solid green) */}
        {completedPath && completedPath.length > 1 && (
          <>
            <Polyline positions={completedPath} color="#10b981" weight={5} opacity={0.4} />
            <Polyline positions={completedPath} color="#34d399" weight={2} opacity={0.9} />
          </>
        )}

        {/* Selected route — remaining path (dashed violet) */}
        {remainingPath && remainingPath.length > 1 && (
          <>
            <Polyline positions={remainingPath} color="#7c3aed" weight={8} opacity={0.2} />
            <Polyline positions={remainingPath} color="#a78bfa" weight={3} dashArray="10, 6" opacity={0.9} />
          </>
        )}

        {/* Origin Flag */}
        {originCity && (
          <>
            <Circle center={originCity.coords} radius={60000} color="#10b981" fillColor="#10b981" fillOpacity={0.12} weight={2} dashArray="4" />
            <Marker position={originCity.coords} icon={createFlagIcon(`🟢 FROM\n${selectedTruck.origin}`, '#10b981')}>
              <Popup><div style={{ color: '#1e293b', fontWeight: 'bold' }}>Origin: {selectedTruck.origin}</div></Popup>
            </Marker>
          </>
        )}

        {/* Destination Flag */}
        {destCity && (
          <>
            <Circle center={destCity.coords} radius={60000} color="#f59e0b" fillColor="#f59e0b" fillOpacity={0.12} weight={2} dashArray="4" />
            <Marker position={destCity.coords} icon={createFlagIcon(`🏁 TO\n${selectedTruck.destination}`, '#f59e0b')}>
              <Popup><div style={{ color: '#1e293b', fontWeight: 'bold' }}>Destination: {selectedTruck.destination}</div></Popup>
            </Marker>
          </>
        )}

        {/* World Events with labels */}
        {worldEvents.map(ev => (
          <React.Fragment key={ev.id}>
            {/* Outer glow ring */}
            <Circle
              center={[ev.lat, ev.long]}
              pathOptions={{ color: getEventColor(ev.type), fillColor: getEventColor(ev.type), fillOpacity: 0.08, weight: 1, dashArray: '6' }}
              radius={ev.radius * 111000 * 1.3}
            />
            {/* Inner zone */}
            <Circle
              center={[ev.lat, ev.long]}
              pathOptions={{ color: getEventColor(ev.type), fillColor: getEventColor(ev.type), fillOpacity: 0.18, weight: 2, dashArray: '4' }}
              radius={ev.radius * 111000}
            >
              <Popup>
                <div style={{ background: '#0f172a', color: '#f1f5f9', fontWeight: 'bold', fontSize: '12px', padding: '6px 10px', borderRadius: '8px', border: `1px solid ${getEventColor(ev.type)}55` }}>
                  <p style={{ margin: 0, textTransform: 'uppercase', color: getEventColor(ev.type) }}>{ev.type} WARNING</p>
                  <p style={{ margin: '2px 0 0', fontWeight: 'normal', color: '#94a3b8', fontSize: '11px' }}>Near {ev.city}</p>
                </div>
              </Popup>
            </Circle>
            {/* Floating event label */}
            <Marker position={[ev.lat, ev.long]} icon={createEventLabel(ev)} interactive={false} />
          </React.Fragment>
        ))}

        {/* Trucks */}
        {shipments.map(shipment => {
          const isDelayed = shipment.status.includes('Late');
          const isDelivered = shipment.status.includes('Delivered');
          const isEarly = shipment.status.includes('Early');
          const inEventZone = shipment.status.includes('Zone');
          const accentColor = isDelayed ? '#ef4444' : isEarly ? '#22d3ee' : isDelivered ? '#10b981' : inEventZone ? '#f59e0b' : '#38bdf8';
          const elapsedH = shipment.startTime ? ((Date.now() - shipment.startTime) / 3600000).toFixed(1) : '—';
          return (
            <Marker
              key={shipment.id}
              position={[shipment.lat, shipment.long]}
              icon={createTruckIcon(shipment.status, shipment.id === selectedTruckId)}
              eventHandlers={onSelectTruck ? { click: () => onSelectTruck(shipment.id) } : {}}
            >
              <Popup>
                <div style={{ background: '#0f172a', color: '#f1f5f9', fontWeight: 'bold', fontSize: '12px', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${accentColor}55`, minWidth: '190px', boxShadow: `0 4px 20px ${accentColor}22` }}>
                  <p style={{ margin: 0, color: accentColor, fontSize: '14px' }}>🚛 {shipment.id}</p>
                  <p style={{ margin: '4px 0 0', fontWeight: 'normal', color: '#94a3b8', fontSize: '11px' }}>{shipment.status}</p>
                  {shipment.origin && <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#64748b' }}>{shipment.origin} → {shipment.destination}</p>}
                  <div style={{ margin: '6px 0 0', display: 'flex', gap: '8px', fontSize: '10px', color: '#64748b' }}>
                    <span>ETA: <b style={{ color: '#38bdf8' }}>{shipment.eta?.toFixed(1)}h</b></span>
                    <span>Elapsed: <b style={{ color: '#e2e8f0' }}>{elapsedH}h</b></span>
                  </div>
                  {shipment.predictedDelayHours != null && (
                    <div style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b' }}>
                      ML Delay: <b style={{ color: shipment.predictedDelayHours > 0.5 ? '#ef4444' : '#10b981' }}>{shipment.predictedDelayHours > 0 ? '+' : ''}{shipment.predictedDelayHours.toFixed(1)}h</b>
                      {' · '}Early: <b style={{ color: '#22d3ee' }}>{(shipment.earlyDeliveryProb || 0).toFixed(0)}%</b>
                    </div>
                  )}
                  {shipment.delayCauses?.length > 0 && (
                    <div style={{ margin: '6px 0 0', padding: '4px 6px', background: '#1e293b', borderRadius: '6px', fontSize: '10px', color: '#f59e0b' }}>
                      ⚠ {shipment.delayCauses.length} event{shipment.delayCauses.length > 1 ? 's' : ''} · +{shipment.delayAccumulated.toFixed(1)}h impact
                    </div>
                  )}
                  <p style={{ margin: '6px 0 0', fontSize: '9px', color: '#475569', fontStyle: 'italic' }}>Click to open telemetry ▸</p>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Live Stats Overlay — top right */}
      <div style={{
        position: 'absolute', top: '10px', right: '10px', zIndex: 999,
        background: 'rgba(15,23,42,0.92)', border: '1px solid #334155',
        borderRadius: '12px', padding: '10px 14px', fontSize: '11px',
        backdropFilter: 'blur(10px)', color: '#94a3b8',
        display: 'flex', gap: '14px', alignItems: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8' }}>{activeCount}</div>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active</div>
        </div>
        <div style={{ width: '1px', height: '28px', background: '#334155' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#f59e0b' }}>{eventCount}</div>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Events</div>
        </div>
        <div style={{ width: '1px', height: '28px', background: '#334155' }} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: inEventCount > 0 ? '#ef4444' : '#10b981' }}>{inEventCount}</div>
          <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Affected</div>
        </div>
      </div>

      {/* Legend — bottom left */}
      <div style={{
        position: 'absolute', bottom: '28px', left: '10px', zIndex: 999,
        background: 'rgba(15,23,42,0.92)', border: '1px solid #1e40af44',
        borderRadius: '10px', padding: '10px 14px', fontSize: '11px',
        backdropFilter: 'blur(8px)', color: '#94a3b8', lineHeight: '1.8'
      }}>
        <p style={{ margin: '0 0 6px', fontWeight: 'bold', color: '#38bdf8', fontSize: '12px' }}>LEGEND</p>
        {[['🚛', '#38bdf8', 'In Transit'], ['🚛', '#f59e0b', 'In Event Zone'], ['🚛', '#22d3ee', 'Early Delivery'], ['🚛', '#10b981', 'Delivered'], ['🚛', '#ef4444', 'Delivered Late'], ['🔴', '#ef4444', 'Traffic jam'], ['🌩', '#38bdf8', 'Storm zone'], ['💥', '#ef4444', 'Accident'], ['🟢', '#34d399', 'Completed path'], ['🟣', '#a78bfa', 'Remaining path']].map(([icon, color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>{icon}</span>
            <span style={{ color, fontWeight: 'bold', fontSize: '10px' }}>●</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
