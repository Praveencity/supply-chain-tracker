import React from 'react';
import { Activity, Clock, MapPin, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

export default function AnalyticsPanel({ shipments, selectedTruck, clearSelection }) {
  if (!selectedTruck) return null;

    const now = Date.now();
    const elapsedMs = selectedTruck.startTime ? now - selectedTruck.startTime : 0;
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const totalEtaHours = selectedTruck.eta + selectedTruck.delayAccumulated;
    const remainingHours = Math.max(0, totalEtaHours - elapsedHours);
    const progressPct = Math.min(100, (elapsedHours / totalEtaHours) * 100);
    const isDelivered = selectedTruck.status.includes('Delivered');
    const isDelayed = selectedTruck.status.includes('Late');
    const isEarly = selectedTruck.status.includes('Early');
    const inEventZone = selectedTruck.currentEvent != null;

    const toSimTime = (hours) => {
      const totalSec = Math.round(Math.abs(hours) * 3600);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    };

    // Path progress
    const pathTotal = selectedTruck.path?.length || 1;
    const pathDone = Math.min(selectedTruck.pathIndex || 0, pathTotal);
    const pathPct = Math.round((pathDone / Math.max(pathTotal - 1, 1)) * 100);

    // Status color
    const statusColor = isEarly ? 'cyan' : isDelayed ? 'red' : isDelivered ? 'emerald' : inEventZone ? 'yellow' : 'sky';
    const statusBg = `bg-${statusColor}-900/40`;
    const statusText = `text-${statusColor}-400`;

    const MetricCell = ({ label, value, sub, valueClass = 'text-white', icon: Icon }) => (
      <div className="bg-dark-900/60 rounded-xl p-3 border border-dark-700 hover:border-dark-700/80 transition-colors">
        <div className="flex items-center gap-1.5 mb-1">
          {Icon && <Icon size={11} className="text-slate-600" />}
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</p>
        </div>
        <p className={`text-lg font-bold leading-tight ${valueClass}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
      </div>
    );

    // Event timing calculations
    const events = selectedTruck.delayCauses || [];
    const totalEventHours = selectedTruck.delayAccumulated || 0;

    return (
      <div className="glass-panel p-5 border border-dark-700">

        {/* Title Row */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-1.5 rounded-lg ${statusBg}`}>
            <Activity className={statusText} size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white">{selectedTruck.id} — Live Telemetry</h3>
            {selectedTruck.origin && (
              <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                <MapPin size={10} /> {selectedTruck.origin} → {selectedTruck.destination}
              </p>
            )}
          </div>
          <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${statusBg} ${statusText} border border-${statusColor}-500/20`}>
            {selectedTruck.status}
          </span>
          {isDelivered && (
            <button
              onClick={async () => {
                await fetch(`http://localhost:3001/api/shipment/${selectedTruck.id}`, { method: 'DELETE' });
                clearSelection();
              }}
              className="shrink-0 text-xs font-bold text-red-400 hover:text-white hover:bg-red-600 bg-red-900/30 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-red-500/40"
            >
              🗑 Remove
            </button>
          )}
          <button onClick={clearSelection} className="shrink-0 text-xs font-bold text-slate-300 hover:text-white hover:bg-dark-700 bg-dark-900 px-3 py-1.5 rounded-lg transition-colors cursor-pointer border border-dark-700">
            × Close
          </button>
        </div>

        {/* Enhanced Progress Bar */}
        <div className="mb-5">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span className="flex items-center gap-1"><MapPin size={10} /> Journey Progress</span>
            <span className="font-mono">{isDelivered ? '100' : progressPct.toFixed(1)}% · Node {pathDone}/{pathTotal - 1}</span>
          </div>
          <div className="w-full h-3 bg-dark-900 rounded-full overflow-hidden relative">
            {/* Event zone markers on progress bar */}
            {events.map((c, i) => {
              const pos = Math.min(95, (i + 1) / Math.max(events.length + 1, 2) * 100);
              const evColors = { Storm: '#38bdf8', Traffic: '#eab308', Accident: '#ef4444', Breakdown: '#f97316' };
              return (
                <div key={i} style={{ position: 'absolute', left: `${pos}%`, top: 0, bottom: 0, width: '3px', background: evColors[c.type] || '#eab308', opacity: 0.7, zIndex: 2, borderRadius: '2px' }}
                  title={`${c.type} +${c.addedHours.toFixed(1)}h`}
                />
              );
            })}
            <div
              className={`h-full rounded-full transition-all duration-700 relative z-[1] ${isDelayed ? 'bg-gradient-to-r from-red-600 to-red-400' : isEarly ? 'bg-gradient-to-r from-cyan-600 to-cyan-400' : 'bg-gradient-to-r from-brand-dark to-brand-light'}`}
              style={{ width: `${isDelivered ? 100 : progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>{selectedTruck.origin}</span>
            <span>{selectedTruck.destination}</span>
          </div>
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5 mb-4">
          <MetricCell
            label="ML Predicted ETA"
            value={`${selectedTruck.eta?.toFixed(1)}h`}
            sub="Gradient Boosting model"
            valueClass="text-sky-400"
            icon={TrendingUp}
          />
          <MetricCell
            label={isDelivered ? 'Total Time' : 'Time Left'}
            value={isDelivered ? toSimTime(elapsedHours) : toSimTime(remainingHours)}
            sub={isDelivered ? `actual: ${elapsedHours.toFixed(1)}h` : `${remainingHours.toFixed(1)}h remaining`}
            valueClass={isDelayed ? 'text-red-400' : 'text-emerald-400'}
            icon={Clock}
          />
          <MetricCell
            label="Elapsed"
            value={toSimTime(elapsedHours)}
            sub={`${elapsedHours.toFixed(1)}h since departure`}
            icon={Clock}
          />
          <MetricCell
            label="ML Delay Prediction"
            value={`${selectedTruck.predictedDelayHours > 0 ? '+' : ''}${(selectedTruck.predictedDelayHours || 0).toFixed(1)}h`}
            sub={selectedTruck.predictedDelayHours > 0.5 ? 'delay expected' : selectedTruck.predictedDelayHours < -0.5 ? 'early expected' : 'on-time expected'}
            valueClass={selectedTruck.predictedDelayHours > 0.5 ? 'text-red-400' : selectedTruck.predictedDelayHours < -0.5 ? 'text-cyan-400' : 'text-emerald-400'}
            icon={Zap}
          />
          <MetricCell
            label="Early Chance"
            value={`${(selectedTruck.earlyDeliveryProb || 0).toFixed(0)}%`}
            sub="historical probability"
            valueClass={selectedTruck.earlyDeliveryProb > 50 ? 'text-cyan-400' : 'text-slate-300'}
            icon={TrendingUp}
          />
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-4 gap-2.5 mb-4">
          <MetricCell label="Departure" value="T+0" sub="simulation start" />
          <MetricCell
            label="Event Impact"
            value={totalEventHours > 0 ? `+${totalEventHours.toFixed(1)}h` : 'None'}
            sub={events.length > 0 ? `${events.length} event${events.length > 1 ? 's' : ''} hit` : 'clear journey'}
            valueClass={totalEventHours > 0 ? 'text-yellow-400' : 'text-emerald-400'}
            icon={AlertTriangle}
          />
          <MetricCell
            label={isDelivered ? 'Arrived' : 'ETA Clock'}
            value={toSimTime(totalEtaHours)}
            sub={isDelayed ? 'behind schedule' : isEarly ? 'ahead of schedule' : 'on schedule'}
            valueClass={isDelayed ? 'text-orange-400' : isEarly ? 'text-cyan-400' : 'text-white'}
          />
          <MetricCell
            label="Outcome"
            value={isDelivered ? (isEarly ? '⚡ Early' : isDelayed ? '🔴 Late' : '✅ On-Time') : '⏳ In Progress'}
            sub={isDelivered ? (isEarly ? `${selectedTruck.earlyBy}h ahead` : isDelayed ? 'ML vs actual' : 'delivered') : 'awaiting'}
            valueClass={isEarly ? 'text-cyan-400' : isDelivered && !isDelayed ? 'text-emerald-400' : isDelayed ? 'text-red-400' : 'text-brand-light'}
          />
        </div>

        {/* Event Timeline */}
        {events.length > 0 && (
          <div className="mt-1 border border-yellow-500/15 bg-yellow-950/20 rounded-xl p-4">
            <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <AlertTriangle size={12} /> Event Timeline — {events.length} encounter{events.length > 1 ? 's' : ''} · {totalEventHours.toFixed(1)}h total impact
            </p>

            {/* Visual timeline bar */}
            <div className="relative mb-4">
              <div className="h-2 bg-dark-900 rounded-full overflow-hidden flex">
                {events.map((c, i) => {
                  const pct = totalEventHours > 0 ? (c.addedHours / totalEventHours) * 100 : 100 / events.length;
                  const bgColors = { Storm: 'bg-sky-500', Traffic: 'bg-yellow-500', Accident: 'bg-red-500', Breakdown: 'bg-orange-500' };
                  return (
                    <div key={i} className={`h-full ${bgColors[c.type] || 'bg-slate-500'} transition-all`} style={{ width: `${pct}%` }} title={`${c.type}: +${c.addedHours.toFixed(1)}h`} />
                  );
                })}
              </div>
            </div>

            {/* Event cards */}
            <div className="space-y-2">
              {events.map((c, i) => {
                const icons = { Storm: '🌩️', Traffic: '🚦', Accident: '💥', Breakdown: '🔧' };
                const colors = { Storm: 'border-sky-500/30 bg-sky-950/40', Traffic: 'border-yellow-500/30 bg-yellow-950/40', Accident: 'border-red-500/30 bg-red-950/40', Breakdown: 'border-orange-500/30 bg-orange-950/40' };
                const textColors = { Storm: 'text-sky-300', Traffic: 'text-yellow-300', Accident: 'text-red-300', Breakdown: 'text-orange-300' };
                const speedImpact = { Storm: '80% slower', Traffic: '50% slower', Accident: '95% slower', Breakdown: 'Stopped' };
                const style = colors[c.type] || 'border-slate-500/30 bg-slate-950/40';
                const pct = totalEventHours > 0 ? ((c.addedHours / totalEventHours) * 100).toFixed(0) : '—';
                return (
                  <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${style}`}>
                    <span className="text-lg">{icons[c.type] || '⚠'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${textColors[c.type] || 'text-slate-300'}`}>{c.type}</span>
                        <span className="text-[10px] text-slate-500">· {speedImpact[c.type]}</span>
                      </div>
                      {/* Mini impact bar */}
                      <div className="mt-1 h-1 bg-dark-900 rounded-full overflow-hidden w-full max-w-[120px]">
                        <div className={`h-full rounded-full ${c.type === 'Storm' ? 'bg-sky-400' : c.type === 'Accident' ? 'bg-red-400' : c.type === 'Breakdown' ? 'bg-orange-400' : 'bg-yellow-400'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-white">+{c.addedHours.toFixed(1)}h</p>
                      <p className="text-[10px] text-slate-500">{pct}% of impact</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-2 border-t border-yellow-500/10 flex items-center justify-between">
              <p className="text-[10px] text-slate-500">Events slowed the truck but <b className="text-yellow-400">ML model</b> judges final delay/early status</p>
              <p className="text-xs font-bold text-yellow-400">Σ +{totalEventHours.toFixed(1)}h</p>
            </div>
          </div>
        )}

        {/* Status Banners */}
        {isEarly && isDelivered && (
          <div className="mt-4 border border-cyan-500/20 bg-cyan-950/20 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-cyan-400 flex items-center gap-2">
              ⚡ Early Delivery — Arrived {selectedTruck.earlyBy}h ahead of ML-predicted ETA
            </p>
            <p className="text-xs text-slate-400 mt-1">Clear conditions and optimal routing allowed faster-than-expected delivery.</p>
          </div>
        )}

        {!isDelayed && !isDelivered && !isEarly && !inEventZone && events.length === 0 && (
          <div className="mt-4 border border-emerald-500/20 bg-emerald-950/20 rounded-xl px-4 py-3">
            <p className="text-xs font-bold text-emerald-400 flex items-center gap-2">✅ No events encountered — running on schedule</p>
          </div>
        )}

        {inEventZone && !isDelivered && (
          <div className="mt-4 border border-yellow-500/20 bg-yellow-950/20 rounded-xl px-4 py-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-yellow-400">
                Passing through {selectedTruck.currentEvent} zone — speed reduced
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">ML model will evaluate final delivery status at destination. Events affect speed but not the delay/early classification.</p>
            </div>
          </div>
        )}
      </div>
    );
}
