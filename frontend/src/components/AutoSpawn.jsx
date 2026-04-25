import React, { useState, useEffect, useRef } from 'react';
import { Zap, Square, Play, RefreshCw, Shuffle } from 'lucide-react';

const CITIES = [
  "New York", "Chicago", "Miami", "Dallas",
  "Denver", "Los Angeles", "San Francisco", "Seattle",
  "Atlanta", "Phoenix", "Minneapolis", "Boston",
  "Houston", "Philadelphia", "San Diego", "Detroit",
  "Portland", "Las Vegas", "Salt Lake City", "Charlotte",
  "Kansas City", "Indianapolis", "Nashville", "New Orleans", "Washington, DC"
];

const pickRandom = (arr, exclude = []) => {
  const pool = arr.filter(c => !exclude.includes(c));
  return pool[Math.floor(Math.random() * pool.length)];
};

const spawnTruck = async () => {
  const origin = pickRandom(CITIES);
  const dest   = pickRandom(CITIES, [origin]);
  const speed  = 45 + Math.floor(Math.random() * 35); // 45–80 mph
  await fetch('http://localhost:3001/api/simulate-shipment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destinations: [dest], speed })
  });
  return { origin, dest, speed };
};

export default function AutoSpawn() {
  const [running, setRunning]       = useState(false);
  const [interval, setIntervalSec]  = useState(8);   // seconds between spawns
  const [maxTrucks, setMaxTrucks]   = useState(10);
  const [spawned, setSpawned]       = useState(0);
  const [log, setLog]               = useState([]);
  const [activeShipments, setActive]= useState(0);
  const timerRef = useRef(null);

  // Fetch live count from backend
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const r = await fetch('http://localhost:3001/api/shipments');
        const d = await r.json();
        setActive(d.filter(s => !s.status.includes('Delivered')).length);
      } catch {}
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  const start = () => {
    if (running) return;
    setRunning(true);
    setSpawned(0);
    setLog([]);

    const fire = async () => {
      // Check live count before spawning
      let live = 0;
      try {
        const r = await fetch('http://localhost:3001/api/shipments');
        const d = await r.json();
        live = d.filter(s => !s.status.includes('Delivered')).length;
      } catch {}

      if (live >= maxTrucks) {
        // Skip this tick — map is full, wait for deliveries
        addLog(`⏸ Skipped — ${live}/${maxTrucks} trucks active`);
        return;
      }

      try {
        const { origin, dest, speed } = await spawnTruck();
        setSpawned(n => n + 1);
        addLog(`🚛 ${origin} → ${dest} @ ${speed}mph`);
      } catch (e) {
        addLog(`⚠ Spawn failed: ${e.message}`);
      }
    };

    fire(); // immediate first spawn
    timerRef.current = setInterval(fire, interval * 1000);
  };

  const stop = () => {
    setRunning(false);
    clearInterval(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  const addLog = (msg) =>
    setLog(prev => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev].slice(0, 20));

  return (
    <div className="glass-panel border border-dark-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-dark-700">
        <div className={`p-1.5 rounded-lg ${running ? 'bg-emerald-600/20' : 'bg-slate-700/40'}`}>
          <Zap size={16} className={running ? 'text-emerald-400' : 'text-slate-400'} />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Auto-Spawn Mode</p>
          <p className="text-xs text-slate-500">Generate training data automatically</p>
        </div>
        {running && (
          <span className="ml-auto flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Controls */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Spawn Every (sec)
            </label>
            <input
              type="number" min={3} max={60} value={interval}
              onChange={e => setIntervalSec(Number(e.target.value))}
              disabled={running}
              className="w-full bg-dark-900 border border-dark-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Max Concurrent
            </label>
            <input
              type="number" min={1} max={25} value={maxTrucks}
              onChange={e => setMaxTrucks(Number(e.target.value))}
              disabled={running}
              className="w-full bg-dark-900 border border-dark-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-400 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-dark-900/60 rounded-lg px-3 py-2 border border-dark-700">
            <p className="text-xs text-slate-500 font-bold uppercase">Spawned</p>
            <p className="text-xl font-bold text-emerald-400">{spawned}</p>
          </div>
          <div className="bg-dark-900/60 rounded-lg px-3 py-2 border border-dark-700">
            <p className="text-xs text-slate-500 font-bold uppercase">Active Now</p>
            <p className="text-xl font-bold text-sky-400">{activeShipments}</p>
          </div>
        </div>

        {/* Start / Stop */}
        <div className="flex gap-2">
          <button
            onClick={start} disabled={running}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-colors text-sm cursor-pointer"
          >
            <Play size={14} /> Start
          </button>
          <button
            onClick={stop} disabled={!running}
            className="flex-1 flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-2.5 rounded-lg transition-colors text-sm cursor-pointer"
          >
            <Square size={14} /> Stop
          </button>
        </div>

        {/* Live Log */}
        {log.length > 0 && (
          <div className="bg-dark-900/80 rounded-lg border border-dark-700 max-h-36 overflow-y-auto p-2">
            {log.map((entry, i) => (
              <p key={i} className="text-xs text-slate-400 font-mono leading-5">{entry}</p>
            ))}
          </div>
        )}

        <p className="text-xs text-slate-600 text-center">
          Each delivered truck auto-retrains the AI model
        </p>
      </div>
    </div>
  );
}
