import React, { useState, useEffect } from 'react';
import { PackageSearch, Clock, BarChart2, Trash2 } from 'lucide-react';
import DeliveryMap from './components/DeliveryMap';
import StatCard from './components/StatCard';
import Chatbot from './components/Chatbot';
import CreateShipment from './components/CreateShipment';
import AnalyticsPanel from './components/AnalyticsPanel';
import TrainModelPanel from './components/TrainModelPanel';
import AutoSpawn from './components/AutoSpawn';

import RouteAnalytics from './components/RouteAnalytics';
import RouteDeepDive from './components/RouteDeepDive';
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001');

function App() {
  const [shipments, setShipments] = useState([]);
  const [worldEvents, setWorldEvents] = useState([]);
  const [selectedTruckId, setSelectedTruckId] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [page, setPage] = useState('dashboard');
  const [deepDiveRoute, setDeepDiveRoute] = useState({ origin: '', destination: '' });

  const clearDelivered = async () => {
    const res = await fetch('http://localhost:3001/api/shipments/delivered', { method: 'DELETE' });
    const d = await res.json();
    if (d.removed > 0) setSelectedTruckId(null); // deselect if selected truck was delivered
  };

  useEffect(() => {
    socket.on('shipment_updates', (data) => setShipments(data));
    socket.on('world_events', (data) => setWorldEvents(data));

    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);

    return () => {
      socket.off('shipment_updates');
      socket.off('world_events');
      clearInterval(clockTimer);
    };
  }, []);

  const activeShipments = shipments.filter(s => !s.status.includes('Delivered'));
  const totalShipments = activeShipments.length;

  return (
    <div className="min-h-screen p-6 flex flex-col gap-6">
      {page === 'analytics' && <RouteAnalytics onBack={() => setPage('dashboard')} onDeepDive={(o, d) => { setDeepDiveRoute({ origin: o, destination: d }); setPage('deepdive'); }} />}
      {page === 'deepdive' && <RouteDeepDive onBack={() => setPage('analytics')} initialOrigin={deepDiveRoute.origin} initialDestination={deepDiveRoute.destination} />}
      {page === 'dashboard' && (<>
      {/* Header */}
      <header className="flex justify-between items-center glass-panel p-4 px-6">
        <div className="flex items-center gap-3">
          <div className="bg-brand-DEFAULT p-2 rounded-lg text-white">
            <PackageSearch size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Supply Chain <span className="text-brand-light">Control Tower</span></h1>
        </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPage('analytics')}
              className="flex items-center gap-2 text-sm font-bold text-brand-light hover:text-white bg-brand-DEFAULT/20 hover:bg-brand-DEFAULT/40 px-3 py-1.5 rounded-lg transition-colors border border-brand-DEFAULT/30 cursor-pointer"
            >
              <BarChart2 size={16} /> Route Analytics
            </button>
          <div className="flex items-center gap-2 text-sm text-brand-light font-mono bg-dark-900/50 px-3 py-1.5 rounded-lg border border-dark-700">
            <Clock size={16} />
            {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} 
            <span className="text-white ml-2">{currentTime.toLocaleTimeString()}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            System Operational
          </div>
          <img src="https://ui-avatars.com/api/?name=Admin+User&background=334155&color=fff" alt="User" className="w-10 h-10 rounded-full border border-dark-700" />
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-12 gap-6 flex-1 h-[calc(100vh-140px)]">
        
        {/* Left Sidebar - Stats & Alerts */}
        <div className="col-span-12 lg:col-span-3 flex flex-col gap-6 overflow-y-auto pr-2">
          <StatCard
            title="Total Active Shipments"
            value={totalShipments}
            icon={PackageSearch}
            trend={totalShipments > 0 ? 1 : 0}
            colorClass="bg-brand-DEFAULT/20 text-brand-light"
          />

          {/* Clear Delivered Button */}
          {shipments.some(s => s.status.includes('Delivered')) && (
            <button
              onClick={clearDelivered}
              className="flex items-center justify-center gap-2 w-full text-sm font-bold text-red-300 bg-red-900/20 hover:bg-red-900/40 border border-red-500/30 py-2.5 rounded-xl transition-colors cursor-pointer"
            >
              <Trash2 size={15} />
              Clear {shipments.filter(s => s.status.includes('Delivered')).length} Delivered Truck{shipments.filter(s => s.status.includes('Delivered')).length > 1 ? 's' : ''}
            </button>
          )}

          <CreateShipment onCreated={(newShipment) => {
            console.log("New dummy vehicle added:", newShipment);
          }} />

          {/* AI Insights Panel */}
          <div className="glass-panel p-6">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <Clock className="text-brand-light" size={20} /> AI Risk Alerts
            </h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {shipments.filter(s => s.currentEvent || s.predictedDelayHours > 0.5 || s.status.includes('Late')).length === 0 ? (
                <p className="text-sm text-slate-400 italic">No active risk alerts at this time. All systems nominal.</p>
              ) : (
                shipments.filter(s => s.currentEvent || s.predictedDelayHours > 0.5 || s.status.includes('Late')).map(ship => (
                  <div key={ship.id} className={`p-3 rounded-lg border ${ship.currentEvent ? 'bg-yellow-900/30 border-yellow-500/30' : ship.status.includes('Late') ? 'bg-red-900/30 border-red-500/30' : 'bg-orange-900/30 border-orange-500/30'}`}>
                    <p className={`text-sm font-bold ${ship.currentEvent ? 'text-yellow-400' : ship.status.includes('Late') ? 'text-red-400' : 'text-orange-400'}`}>
                      {ship.id} ({ship.status})
                    </p>
                    <p className="text-xs text-slate-300 mt-1">
                      ML Predicted Delay: <span className="font-bold">{(ship.predictedDelayHours || 0).toFixed(1)}h</span>
                      {' · '}Early Chance: <span className="font-bold">{(ship.earlyDeliveryProb || 0).toFixed(0)}%</span>
                      {ship.currentEvent && ` · Currently in ${ship.currentEvent} zone (speed affected, ML will judge final status)`}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Auto-Spawn Training Panel */}
          <AutoSpawn />

          {/* Model Training Panel */}
          <TrainModelPanel />

        </div>

        {/* Right Side - Map + Truck Telemetry */}
        <div className="col-span-12 lg:col-span-9 h-full min-h-[500px] flex flex-col gap-4">
          <div className={selectedTruckId ? 'flex-1 min-h-[300px]' : 'h-full'}>
            <DeliveryMap shipments={shipments} worldEvents={worldEvents} onSelectTruck={setSelectedTruckId} selectedTruckId={selectedTruckId} />
          </div>
          {selectedTruckId && (
            <AnalyticsPanel
              shipments={shipments}
              selectedTruck={shipments.find(s => s.id === selectedTruckId)}
              clearSelection={() => setSelectedTruckId(null)}
            />
          )}
        </div>
      </div>
      
      {/* Floating AI Chatbot */}
      <Chatbot />
    </>)}
    </div>
  );
}

export default App;
