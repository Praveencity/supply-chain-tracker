import React, { useState, useEffect } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, CartesianGrid, Legend, Cell,
  PieChart, Pie, AreaChart, Area, LineChart, Line
} from 'recharts';
import {
  PackageSearch, BarChart2, AlertTriangle, Zap, Clock,
  TrendingDown, TrendingUp, ArrowLeft, RefreshCw, Download, MapPin
} from 'lucide-react';

const RISK_COLOR = (pct) => {
  if (pct >= 60) return '#ef4444';
  if (pct >= 30) return '#f97316';
  return '#10b981';
};

const SummaryCard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="glass-panel p-5 flex flex-col gap-2 border border-dark-700">
    <div className="flex justify-between items-start">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className={`p-2 rounded-lg ${color}`}><Icon size={16} /></div>
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
    {sub && <p className="text-xs text-slate-400">{sub}</p>}
  </div>
);

export default function RouteAnalytics({ onBack, onDeepDive }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortKey, setSortKey] = useState('total_shipments');
  const [sortDir, setSortDir] = useState('desc');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterDest, setFilterDest] = useState('');
  const [selectedRoute, setSelectedRoute] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('http://localhost:8000/api/analytics');
      if (!res.ok) throw new Error('Failed to load analytics data');
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const allOrigins = data ? [...new Set(data.routes.map(r => r.origin))].sort() : [];
  const allDests   = data ? [...new Set(data.routes.map(r => r.destination))].sort() : [];

  const filtered = data ? [...data.routes]
    .filter(r =>
      (!filterOrigin || r.origin === filterOrigin) &&
      (!filterDest   || r.destination === filterDest)
    )
    .sort((a, b) => sortDir === 'asc' ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey])
    : [];

  const topDelayed = data ? [...data.routes].sort((a, b) => b.delay_rate_pct - a.delay_rate_pct).slice(0, 8) : [];
  const topFastest = data ? [...data.routes].sort((a, b) => a.avg_eta_hours - b.avg_eta_hours).slice(0, 8) : [];

  const SortIcon = ({ k }) => {
    if (sortKey !== k) return <span className="text-slate-600 ml-1">⇅</span>;
    return <span className="text-brand-light ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="min-h-screen p-6 flex flex-col gap-6">
      {/* Header */}
      <header className="flex justify-between items-center glass-panel p-4 px-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-dark-700 rounded-lg transition-colors text-slate-400 hover:text-white cursor-pointer">
            <ArrowLeft size={20} />
          </button>
          <div className="bg-brand-DEFAULT p-2 rounded-lg text-white">
            <BarChart2 size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Route <span className="text-brand-light">Deep Analytics</span></h1>
            <p className="text-xs text-slate-400">AI Model Training Data · Live from historical_shipments.csv</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onDeepDive}
            className="flex items-center gap-2 text-xs font-bold text-violet-300 hover:text-white bg-violet-600/20 hover:bg-violet-600/40 px-3 py-2 rounded-lg transition-colors border border-violet-500/30 cursor-pointer"
          >
            <MapPin size={14} /> Route Deep Dive
          </button>
          <a
            href="http://localhost:8000/api/data/download"
            className="flex items-center gap-2 text-xs font-bold text-brand-light hover:text-white bg-brand-DEFAULT/20 hover:bg-brand-DEFAULT/40 px-3 py-2 rounded-lg transition-colors border border-brand-DEFAULT/30"
          >
            <Download size={14} /> Download CSV
          </a>
          <button onClick={fetchData} className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white bg-dark-900 px-3 py-2 rounded-lg transition-colors border border-dark-700 cursor-pointer">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </header>

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-brand-light border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400 font-bold">Loading analytics...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="glass-panel p-8 text-center border border-red-500/30">
          <AlertTriangle size={40} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-bold text-lg">{error}</p>
          <p className="text-slate-400 text-sm mt-1">Make sure the ML service is running and has data.</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <SummaryCard label="Total Records" value={data.summary.total_records.toLocaleString()} icon={PackageSearch} color="bg-brand-DEFAULT/20 text-brand-light" />
            <SummaryCard label="Unique Routes" value={data.summary.total_routes} icon={BarChart2} color="bg-violet-500/20 text-violet-400" />
            <SummaryCard label="Fleet Avg ETA" value={`${data.summary.fleet_avg_eta}h`} icon={Clock} color="bg-sky-500/20 text-sky-400" />
            <SummaryCard label="Fleet Delay Rate" value={`${data.summary.fleet_delay_rate}%`} icon={AlertTriangle} color="bg-orange-500/20 text-orange-400" />
            <SummaryCard label="Fleet Early Rate" value={`${data.summary.fleet_early_rate || 0}%`} sub="arrived early" icon={Zap} color="bg-cyan-500/20 text-cyan-400" />
            <SummaryCard label="Avg Delay Hours" value={`${data.summary.fleet_avg_delay_hours || 0}h`} sub="vs ideal time" icon={Clock} color="bg-yellow-500/20 text-yellow-400" />
            <SummaryCard label="Most Delayed" value={data.summary.most_delayed_route} icon={TrendingDown} color="bg-red-500/20 text-red-400" />
            <SummaryCard label="Fastest Route" value={data.summary.fastest_route} icon={TrendingUp} color="bg-emerald-500/20 text-emerald-400" />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Delayed Routes */}
            <div className="glass-panel p-6 border border-dark-700">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <AlertTriangle size={16} className="text-red-400" /> Top Routes by Delay Rate (%)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topDelayed} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={11} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="route" stroke="#64748b" fontSize={10} width={140} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: 12 }}
                    formatter={(v) => [`${v}%`, 'Delay Rate']}
                  />
                  <Bar dataKey="delay_rate_pct" radius={[0, 4, 4, 0]}>
                    {topDelayed.map((entry, i) => (
                      <Cell key={i} fill={RISK_COLOR(entry.delay_rate_pct)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Fastest Routes */}
            <div className="glass-panel p-6 border border-dark-700">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Zap size={16} className="text-emerald-400" /> Fastest Routes by Avg ETA (hours)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topFastest} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={v => `${v}h`} />
                  <YAxis type="category" dataKey="route" stroke="#64748b" fontSize={10} width={140} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: 12 }}
                    formatter={(v) => [`${v}h`, 'Avg ETA']}
                  />
                  <Bar dataKey="avg_eta_hours" radius={[0, 4, 4, 0]} fill="#38bdf8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Row 2: Scatter + Pie + Early Delivery + Delay Hours */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scatter: Distance vs ETA */}
            <div className="glass-panel p-6 border border-dark-700">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp size={16} className="text-violet-400" /> Distance vs Avg ETA (per route)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <ScatterChart margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" dataKey="avg_distance_miles" name="Distance" stroke="#64748b" fontSize={11} tickFormatter={v => `${v}mi`} />
                  <YAxis type="number" dataKey="avg_eta_hours" name="ETA" stroke="#64748b" fontSize={11} tickFormatter={v => `${v}h`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: 12 }}
                    formatter={(v, name) => [name === 'Distance' ? `${v} mi` : `${v}h`, name]}
                    labelFormatter={() => ''}
                  />
                  <Scatter data={data.routes} fill="#a78bfa">
                    {data.routes.map((r, i) => (
                      <Cell key={i} fill={RISK_COLOR(r.delay_rate_pct)} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-slate-500 mt-1">Each dot = one route. Color: 🟢 low delay · 🟠 medium · 🔴 high delay</p>
            </div>

            {/* Pie: Fleet Delivery Outcome */}
            <div className="glass-panel p-6 border border-dark-700">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Zap size={16} className="text-cyan-400" /> Fleet Delivery Outcome Split
              </h3>
              {(() => {
                const delayRate = data.summary.fleet_delay_rate || 0;
                const earlyRate = data.summary.fleet_early_rate || 0;
                const onTimeRate = Math.max(0, 100 - delayRate - earlyRate);
                const pieData = [
                  { name: 'Delayed', value: delayRate, fill: '#ef4444' },
                  { name: 'On-Time', value: onTimeRate, fill: '#10b981' },
                  { name: 'Early', value: earlyRate, fill: '#22d3ee' },
                ];
                return (
                  <div className="flex items-center gap-6">
                    <ResponsiveContainer width="50%" height={180}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value">
                          {pieData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: 12 }} formatter={v => `${v.toFixed(1)}%`} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-3">
                      {pieData.map(d => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ background: d.fill }} />
                          <span className="text-sm text-slate-300">{d.name}</span>
                          <span className="text-sm font-bold text-white">{d.value.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Row 3: Early Delivery % + Avg Delay Hours per route */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Early Delivery % by Route */}
            <div className="glass-panel p-6 border border-dark-700">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Zap size={16} className="text-cyan-400" /> Early Delivery Rate by Route (%)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...data.routes].sort((a, b) => (b.early_delivery_pct || 0) - (a.early_delivery_pct || 0)).slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={11} tickFormatter={v => `${v}%`} />
                  <YAxis type="category" dataKey="route" stroke="#64748b" fontSize={10} width={140} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: 12 }} formatter={v => [`${v}%`, 'Early %']} />
                  <Bar dataKey="early_delivery_pct" radius={[0, 4, 4, 0]} fill="#22d3ee" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Avg Delay Hours by Route */}
            <div className="glass-panel p-6 border border-dark-700">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Clock size={16} className="text-yellow-400" /> Avg Delay Hours by Route (vs ideal)
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={[...data.routes].sort((a, b) => (b.avg_delay_hours || 0) - (a.avg_delay_hours || 0)).slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis type="number" stroke="#64748b" fontSize={11} tickFormatter={v => `${v}h`} />
                  <YAxis type="category" dataKey="route" stroke="#64748b" fontSize={10} width={140} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: 'white', fontSize: 12 }} formatter={v => [`${v}h`, 'Avg Delay']} />
                  <Bar dataKey="avg_delay_hours" radius={[0, 4, 4, 0]}>
                    {[...data.routes].sort((a, b) => (b.avg_delay_hours || 0) - (a.avg_delay_hours || 0)).slice(0, 8).map((r, i) => (
                      <Cell key={i} fill={(r.avg_delay_hours || 0) > 0.5 ? '#ef4444' : (r.avg_delay_hours || 0) < -0.1 ? '#22d3ee' : '#10b981'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <p className="text-[10px] text-slate-500 mt-1">Positive = delayed vs ideal · Negative = faster than ideal · Color: 🔴 delayed · 🟢 on-time · 🔵 early</p>
            </div>
          </div>

          {/* Data Table */}
          <div className="glass-panel border border-dark-700">
            <div className="p-5 border-b border-dark-700 flex flex-wrap items-center justify-between gap-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BarChart2 size={16} className="text-brand-light" /> All Route Analysis ({filtered.length} routes)
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={filterOrigin}
                  onChange={e => setFilterOrigin(e.target.value)}
                  className="bg-dark-900 border border-dark-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-light cursor-pointer"
                >
                  <option value="">All Origins</option>
                  {allOrigins.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <span className="text-slate-500">→</span>
                <select
                  value={filterDest}
                  onChange={e => setFilterDest(e.target.value)}
                  className="bg-dark-900 border border-dark-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-brand-light cursor-pointer"
                >
                  <option value="">All Destinations</option>
                  {allDests.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(filterOrigin || filterDest) && (
                  <button onClick={() => { setFilterOrigin(''); setFilterDest(''); }} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-dark-700 cursor-pointer transition-colors">
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-dark-700 text-slate-400">
                    {[
                      ['route', 'Route'],
                      ['total_shipments', 'Shipments'],
                      ['avg_eta_hours', 'Avg ETA (h)'],
                      ['delay_rate_pct', 'Delay Rate'],
                      ['avg_distance_miles', 'Avg Miles'],
                      ['avg_speed', 'Avg Speed'],
                      ['avg_traffic', 'Avg Traffic'],
                      ['avg_weather', 'Avg Weather'],
                    ].map(([key, label]) => (
                      <th
                        key={key}
                        className="px-5 py-3 text-left font-semibold uppercase tracking-wider text-xs cursor-pointer hover:text-white select-none"
                        onClick={() => handleSort(key)}
                      >
                        {label}<SortIcon k={key} />
                      </th>
                    ))}
                    <th className="px-5 py-3 text-left font-semibold uppercase tracking-wider text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr
                      key={i}
                      onClick={() => setSelectedRoute(r === selectedRoute ? null : r)}
                      className={`border-b border-dark-700/50 cursor-pointer transition-colors ${selectedRoute === r ? 'bg-brand-DEFAULT/10' : 'hover:bg-dark-700/40'}`}
                    >
                      <td className="px-5 py-3 font-semibold text-white whitespace-nowrap">{r.route}</td>
                      <td className="px-5 py-3 text-slate-300">{r.total_shipments}</td>
                      <td className="px-5 py-3 text-sky-400 font-mono">{r.avg_eta_hours}h</td>
                      <td className="px-5 py-3">
                        <span className={`font-bold px-2 py-0.5 rounded text-xs ${r.delay_rate_pct >= 60 ? 'bg-red-900/40 text-red-400' : r.delay_rate_pct >= 30 ? 'bg-orange-900/40 text-orange-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                          {r.delay_rate_pct}%
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-300 font-mono">{r.avg_distance_miles}</td>
                      <td className="px-5 py-3 text-slate-300">{r.avg_speed} mph</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-dark-900 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-yellow-400" style={{ width: `${(r.avg_traffic / 10) * 100}%` }} />
                          </div>
                          <span className="text-slate-400 text-xs">{r.avg_traffic}/10</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-dark-900 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-blue-400" style={{ width: `${(r.avg_weather / 10) * 100}%` }} />
                          </div>
                          <span className="text-slate-400 text-xs">{r.avg_weather}/10</span>
                        </div>
                      </td>
                      <td className="px-5 py-3" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => onDeepDive(r.origin, r.destination)}
                          className="flex items-center gap-1 text-xs font-bold text-violet-300 hover:text-white bg-violet-600/20 hover:bg-violet-600/50 px-2 py-1 rounded transition-colors border border-violet-500/30 cursor-pointer whitespace-nowrap"
                        >
                          <MapPin size={11} /> Deep Dive
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Expanded Row Detail */}
              {selectedRoute && (
                <div className="p-6 bg-brand-DEFAULT/5 border-t border-brand-DEFAULT/20">
                  <h4 className="text-base font-bold text-brand-light mb-4">📍 Deep Dive: {selectedRoute.route}</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      ['Total Trips', selectedRoute.total_shipments],
                      ['Avg ETA', `${selectedRoute.avg_eta_hours}h`],
                      ['Delay Rate', `${selectedRoute.delay_rate_pct}%`],
                      ['Early Rate', `${selectedRoute.early_delivery_pct || 0}%`],
                      ['Avg Delay', `${selectedRoute.avg_delay_hours || 0}h`],
                      ['Avg Distance', `${selectedRoute.avg_distance_miles} mi`],
                      ['Avg Speed', `${selectedRoute.avg_speed} mph`],
                      ['Traffic (avg)', `${selectedRoute.avg_traffic} / 10`],
                    ].map(([label, value]) => (
                      <div key={label} className="bg-dark-900/60 rounded-lg p-4 border border-dark-700">
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">{label}</p>
                        <p className="text-lg font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div className="p-10 text-center text-slate-500">No routes match your search.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
