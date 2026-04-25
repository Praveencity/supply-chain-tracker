import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, LineChart, Line, AreaChart, Area
} from 'recharts';
import {
  ArrowLeft, Search, Zap, AlertTriangle, Clock, TrendingUp,
  TrendingDown, BarChart2, MapPin, Gauge, Wind, Activity
} from 'lucide-react';

const CITIES = [
  "New York","Chicago","Miami","Dallas","Denver","Los Angeles",
  "San Francisco","Seattle","Atlanta","Phoenix","Boston","Houston",
  "Philadelphia","San Diego","Detroit","Portland","Las Vegas",
  "Salt Lake City","Charlotte","Kansas City","Indianapolis","Nashville",
  "New Orleans","Washington, DC","Minneapolis"
];

const Chip = ({ label, value, icon: Icon, color = 'text-white', bg = 'bg-dark-900/60' }) => (
  <div className={`${bg} rounded-xl p-4 border border-dark-700 flex flex-col gap-1`}>
    <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
      {Icon && <Icon size={12} />}{label}
    </div>
    <p className={`text-xl font-bold ${color}`}>{value}</p>
  </div>
);

const vsFleet = (val, fleetVal, lowerIsBetter = true) => {
  const diff = val - fleetVal;
  const better = lowerIsBetter ? diff < 0 : diff > 0;
  if (Math.abs(diff) < 0.1) return null;
  return (
    <span className={`text-xs font-bold ml-1 ${better ? 'text-emerald-400' : 'text-red-400'}`}>
      {better ? '▼' : '▲'} {Math.abs(diff).toFixed(1)} vs fleet avg
    </span>
  );
};

export default function RouteDeepDive({ onBack, initialOrigin = '', initialDestination = '' }) {
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runAnalysis = async (o, d) => {
    if (!o || !d || o === d) return;
    setLoading(true); setError(null); setData(null);
    try {
      const res = await fetch(`http://localhost:8000/api/analytics/route?origin=${encodeURIComponent(o)}&destination=${encodeURIComponent(d)}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to load data');
      }
      setData(await res.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // Auto-run analysis if opened with a pre-selected route
  useEffect(() => {
    if (initialOrigin && initialDestination) runAnalysis(initialOrigin, initialDestination);
  }, [initialOrigin, initialDestination]);

  const analyze = () => runAnalysis(origin, destination);

  const tripChartData = data?.recent_trips?.map(t => ({
    name: `T${t.trip_no}`,
    eta: t.eta_hours,
    delay_hrs: t.delay_hrs || 0,
  })) || [];

  return (
    <div className="min-h-screen p-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex justify-between items-center glass-panel p-4 px-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-slate-400 hover:text-white cursor-pointer">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-violet-600 p-2 rounded-lg text-white"><MapPin size={22} /></div>
          <div>
            <h1 className="text-xl font-bold text-white">Route <span className="text-violet-400">Deep Dive</span></h1>
            <p className="text-xs text-slate-400">Corridor-level analysis from historical delivery data</p>
          </div>
        </div>
      </header>

      {/* Selector */}
      <div className="glass-panel p-5 border border-dark-700">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Origin City</label>
            <select
              value={origin}
              onChange={e => setOrigin(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-400 cursor-pointer"
            >
              <option value="">— Select Origin —</option>
              {CITIES.filter(c => c !== destination).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="text-slate-500 text-xl pb-1">→</div>
          <div className="flex-1 min-w-48">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Destination City</label>
            <select
              value={destination}
              onChange={e => setDestination(e.target.value)}
              className="w-full bg-dark-900 border border-dark-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-violet-400 cursor-pointer"
            >
              <option value="">— Select Destination —</option>
              {CITIES.filter(c => c !== origin).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button
            onClick={analyze}
            disabled={!origin || !destination || origin === destination || loading}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-lg transition-colors cursor-pointer text-sm"
          >
            <Search size={16} /> {loading ? 'Analyzing...' : 'Analyze Route'}
          </button>
        </div>
        {error && <p className="text-red-400 text-sm mt-3 font-bold">⚠ {error}</p>}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48">
          <div className="w-10 h-10 border-4 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {data && (
        <>
          {/* Route Title */}
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white">{data.origin}</h2>
            <div className="flex-1 h-px bg-gradient-to-r from-violet-500 to-transparent" />
            <span className="text-violet-400 font-bold text-lg">→</span>
            <div className="flex-1 h-px bg-gradient-to-l from-violet-500 to-transparent" />
            <h2 className="text-2xl font-bold text-white">{data.destination}</h2>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <Chip label="Total Trips" value={data.total_trips} icon={Activity} />
            <Chip label="Avg ETA" value={`${data.avg_eta}h`} icon={Clock} color="text-sky-400" />
            <Chip label="Best ETA" value={`${data.best_eta}h`} icon={Zap} color="text-emerald-400" />
            <Chip label="Worst ETA" value={`${data.worst_eta}h`} icon={TrendingDown} color="text-red-400" />
            <Chip label="Delay Rate" value={`${data.delay_rate_pct}%`} icon={AlertTriangle} color={data.delay_rate_pct > 30 ? 'text-red-400' : 'text-emerald-400'} />
            <Chip label="Early Rate" value={`${data.early_delivery_pct || 0}%`} icon={Zap} color="text-cyan-400" />
            <Chip label="Avg Delay" value={`${data.avg_delay_hours || 0}h`} icon={Clock} color={(data.avg_delay_hours || 0) > 0 ? 'text-red-400' : 'text-emerald-400'} />
            <Chip label="Avg Speed" value={`${data.avg_speed} mph`} icon={Gauge} color="text-amber-400" />
          </div>

          {/* Fleet Comparison Banner */}
          <div className="glass-panel p-4 border border-violet-500/20 bg-violet-900/10">
            <p className="text-sm font-bold text-violet-300 mb-2 flex items-center gap-2"><BarChart2 size={14} /> vs Fleet Average</p>
            <div className="flex flex-wrap gap-6 text-sm">
              <span className="text-slate-300">
                Avg ETA: <strong className="text-white">{data.avg_eta}h</strong>
                {vsFleet(data.avg_eta, data.fleet_avg_eta, true)}
              </span>
              <span className="text-slate-300">
                Delay Rate: <strong className="text-white">{data.delay_rate_pct}%</strong>
                {vsFleet(data.delay_rate_pct, data.fleet_delay_rate, true)}
              </span>
              <span className="text-slate-300">Fleet Avg ETA: <strong className="text-slate-400">{data.fleet_avg_eta}h</strong></span>
              <span className="text-slate-300">Fleet Delay Rate: <strong className="text-slate-400">{data.fleet_delay_rate}%</strong></span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ETA Distribution */}
            <div className="glass-panel p-6 border border-dark-700">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <BarChart2 size={16} className="text-violet-400" /> ETA Distribution
              </h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.eta_distribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="range" stroke="#64748b" fontSize={10} angle={-20} textAnchor="end" height={40} />
                  <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: 12 }} />
                  <Bar dataKey="count" fill="#7c3aed" radius={[4, 4, 0, 0]} name="Trips" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ETA Percentiles */}
            <div className="glass-panel p-6 border border-dark-700">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-violet-400" /> ETA Percentile Breakdown
              </h3>
              <div className="flex flex-col gap-4 mt-2">
                {[
                  { label: 'Best 25% arrive within', val: data.percentiles.p25, color: 'bg-emerald-500' },
                  { label: 'Median (50th percentile)', val: data.percentiles.p50, color: 'bg-sky-400' },
                  { label: '75th percentile', val: data.percentiles.p75, color: 'bg-orange-400' },
                  { label: 'Worst 5% can take up to', val: data.percentiles.p95, color: 'bg-red-500' },
                ].map(({ label, val, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">{label}</span>
                      <span className="text-white font-bold">{val}h</span>
                    </div>
                    <div className="w-full h-1.5 bg-dark-900 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, (val / data.percentiles.p95) * 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Trips Chart */}
          <div className="glass-panel p-6 border border-dark-700">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Activity size={16} className="text-violet-400" /> Recent Trip History (last {data.recent_trips.length} trips)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={tripChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis yAxisId="left" stroke="#64748b" fontSize={11} tickFormatter={v => `${v}h`} />
                <YAxis yAxisId="right" orientation="right" stroke="#64748b" fontSize={11} tickFormatter={v => `${v}%`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: 12 }} />
                <ReferenceLine yAxisId="left" y={data.avg_eta} stroke="#7c3aed" strokeDasharray="4 4" label={{ value: 'Avg ETA', fill: '#a78bfa', fontSize: 11 }} />
                <Line yAxisId="left" type="monotone" dataKey="eta" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} name="ETA (hours)" />
                <Line yAxisId="right" type="monotone" dataKey="delay_hrs" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="Delay Hours" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Delay Hours Area Chart */}
          <div className="glass-panel p-6 border border-dark-700">
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Clock size={16} className="text-yellow-400" /> Delay Hours Trend (recent trips)
            </h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={tripChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} tickFormatter={v => `${v}h`} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: 12 }} formatter={v => [`${v}h`, 'Delay']} />
                <ReferenceLine y={0} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'On-Time', fill: '#10b981', fontSize: 10 }} />
                <Area type="monotone" dataKey="delay_hrs" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2} name="Delay Hours" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-slate-500 mt-1">Above 0 = late vs ideal · Below 0 = early vs ideal</p>
          </div>

          {/* Trip Details Table */}
          <div className="glass-panel border border-dark-700">
            <div className="p-5 border-b border-dark-700">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Clock size={16} className="text-violet-400" /> Individual Trip Records
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700 text-slate-500 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3 text-left">Trip #</th>
                    <th className="px-5 py-3 text-left">ETA (hours)</th>
                    <th className="px-5 py-3 text-left">vs Avg</th>
                    <th className="px-5 py-3 text-left">Delay Hours</th>
                    <th className="px-5 py-3 text-left">Speed (mph)</th>
                    <th className="px-5 py-3 text-left">Traffic</th>
                    <th className="px-5 py-3 text-left">Weather</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_trips.map((t, i) => {
                    const diff = t.eta_hours - data.avg_eta;
                    const delayHrs = t.delay_hrs || 0;
                    return (
                      <tr key={i} className="border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors">
                        <td className="px-5 py-3 text-slate-400 font-mono">T{t.trip_no}</td>
                        <td className="px-5 py-3 font-bold text-sky-400">{t.eta_hours}h</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-bold ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {diff > 0 ? '+' : ''}{diff.toFixed(1)}h
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${delayHrs > 0.5 ? 'bg-red-900/40 text-red-400' : delayHrs < -0.1 ? 'bg-cyan-900/40 text-cyan-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                            {delayHrs > 0 ? '+' : ''}{delayHrs.toFixed(1)}h
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-300">{t.speed}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-dark-900 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${t.traffic * 10}%` }} />
                            </div>
                            <span className="text-slate-400 text-xs">{t.traffic}/10</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-dark-900 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-400 rounded-full" style={{ width: `${t.weather * 10}%` }} />
                            </div>
                            <span className="text-slate-400 text-xs">{t.weather}/10</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
