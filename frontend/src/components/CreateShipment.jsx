import React, { useState } from 'react';
import { Plus, Activity } from 'lucide-react';

const CITIES = [
  "New York", "Chicago", "Miami", "Dallas", 
  "Denver", "Los Angeles", "San Francisco", "Seattle", 
  "Atlanta", "Phoenix", "Minneapolis", "Boston",
  "Houston", "Philadelphia", "San Diego", "Detroit",
  "Portland", "Las Vegas", "Salt Lake City", "Charlotte",
  "Kansas City", "Indianapolis", "Nashville", "New Orleans", "Washington, DC"
];

export default function CreateShipment({ onCreated }) {
  const [loading, setLoading] = useState(false);
  const [origin, setOrigin] = useState('New York');
  const [destinations, setDestinations] = useState(['Los Angeles']);

  const handleSimulate = async (e) => {
    e.preventDefault();
    if (destinations.includes(origin) || new Set(destinations).size !== destinations.length) {
      return alert("Origin and destinations must all be unique!");
    }
    setLoading(true);
    
    try {
      const res = await fetch('http://localhost:3001/api/simulate-shipment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin, destinations, speed: 60 })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      onCreated(data);
    } catch (err) {
      console.error(err);
      alert(err.message);
    }
    setLoading(false);
  };

  const updateDestination = (index, value) => {
    const newDest = [...destinations];
    newDest[index] = value;
    setDestinations(newDest);
  };
  const addDestination = () => setDestinations([...destinations, CITIES[0]]);
  const removeDestination = (index) => setDestinations(destinations.filter((_, i) => i !== index));

  const [simMultiplier, setSimMultiplier] = useState(1.0);
  const handleSpeedChange = async (e) => {
    const val = parseFloat(e.target.value);
    setSimMultiplier(val);
    try {
      await fetch('http://localhost:3001/api/sim-speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier: val })
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="glass-panel p-6 mt-6 border border-dark-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold flex items-center gap-2 text-white">
          <Activity className="text-brand-light" size={20} /> Simulate Live Route
        </h3>
        
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-bold uppercase">Sim Speed ({simMultiplier}x)</label>
          <input 
            type="range" min="0.1" max="5.0" step="0.1" 
            value={simMultiplier} 
            onChange={handleSpeedChange} 
            className="w-24 accent-brand-DEFAULT"
          />
        </div>
      </div>
      
      <form onSubmit={handleSimulate} className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Origin</label>
            <select className="w-full bg-dark-900 border border-dark-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-brand-DEFAULT" value={origin} onChange={e => setOrigin(e.target.value)}>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-slate-400 font-bold uppercase mb-1 block">Destinations</label>
            {destinations.map((dest, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <select className="flex-1 bg-dark-900 border border-dark-700 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-brand-DEFAULT" value={dest} onChange={e => updateDestination(idx, e.target.value)}>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {destinations.length > 1 && (
                  <button type="button" onClick={() => removeDestination(idx)} className="bg-red-900/50 text-red-400 px-2 rounded-lg font-bold border border-red-500/50 hover:bg-red-500/50 transition-colors">-</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addDestination} className="text-xs text-brand-light font-bold mt-1 hover:underline">+ Add Stop</button>
          </div>
        </div>
        <button 
          type="submit" disabled={loading}
          className="w-full bg-brand-DEFAULT hover:bg-brand-light text-white font-bold py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {loading ? 'Routing...' : <><Plus size={18} /> Spawn Dummy Truck</>}
        </button>
      </form>
    </div>
  );
}
