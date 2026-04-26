import { Activity, Clock, MapPin, Zap, TrendingUp, AlertTriangle } from 'lucide-react';

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

export default function AnalyticsPanel({ selectedTruck, clearSelection }) {
  if (!selectedTruck) return null;

    const elapsedHours = selectedTruck.elapsedHours || 0;
    
    const isDelivered = selectedTruck.status?.includes('Delivered');
    const initialMlEtaHours = selectedTruck.mlPredictedEtaHours ?? selectedTruck.eta ?? 0;
    const liveEtaHours = selectedTruck.liveEtaHours ?? selectedTruck.remainingEtaHours ?? 0;
    const finalDelayHours = isDelivered ? elapsedHours - initialMlEtaHours : (selectedTruck.liveDelayHours ?? Math.max(0, liveEtaHours - initialMlEtaHours));
    const isDelayed = selectedTruck.status?.includes('Late');
    const isEarly = selectedTruck.status?.includes('Early');
    const inEventZone = selectedTruck.currentEvent != null;

    const formatHours = (hours) => `${Math.max(0, hours).toFixed(1)}h`;
    const formatMiles = (miles) => `${Math.max(0, miles).toFixed(1)} mi`;

    // Path progress
    const pathTotal = selectedTruck.path?.length || 1;
    const pathDone = Math.min(selectedTruck.pathIndex || 0, pathTotal);
    const pathPct = Math.round((pathDone / Math.max(pathTotal - 1, 1)) * 100);
    const progressPct = isDelivered ? 100 : pathPct;

    const statusClasses = isEarly
      ? { bg: 'bg-cyan-900/40', text: 'text-cyan-400', border: 'border-cyan-500/20' }
      : isDelayed
        ? { bg: 'bg-red-900/40', text: 'text-red-400', border: 'border-red-500/20' }
        : isDelivered
          ? { bg: 'bg-emerald-900/40', text: 'text-emerald-400', border: 'border-emerald-500/20' }
          : inEventZone
            ? { bg: 'bg-yellow-900/40', text: 'text-yellow-400', border: 'border-yellow-500/20' }
            : { bg: 'bg-sky-900/40', text: 'text-sky-400', border: 'border-sky-500/20' };

    // Event timing calculations
    const events = selectedTruck.delayCauses || [];
    const totalEventHours = selectedTruck.delayAccumulated || 0;
    const distanceLeftMiles = selectedTruck.distanceLeftMiles ?? 0;

    return (
      <div className="glass-panel p-5 border border-dark-700">

        {/* Title Row */}
        <div className="flex items-start gap-3 mb-4">
          <div className={`p-1.5 rounded-lg ${statusClasses.bg}`}>
            <Activity className={statusClasses.text} size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-white">{selectedTruck.id} — Live Telemetry</h3>
            {selectedTruck.origin && (
              <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                <MapPin size={10} /> {selectedTruck.origin} → {selectedTruck.destination}
              </p>
            )}
          </div>
          <span className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg ${statusClasses.bg} ${statusClasses.text} border ${statusClasses.border}`}>
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
            <span className="font-mono">{progressPct.toFixed(1)}% · Node {pathDone}/{pathTotal - 1}</span>
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
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-600 mt-1">
            <span>{selectedTruck.origin}</span>
            <span>{selectedTruck.destination}</span>
          </div>
        </div>

        {/* Primary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
          <MetricCell
            label="Distance Left"
            value={isDelivered ? '0.0 mi' : formatMiles(distanceLeftMiles)}
            sub="remaining route"
            valueClass="text-violet-300"
            icon={MapPin}
          />
          <MetricCell
            label="Time Elapsed"
            value={formatHours(elapsedHours)}
            sub="since departure"
            icon={Clock}
          />
          <MetricCell
            label="Added Delay"
            value={totalEventHours > 0 ? `+${totalEventHours.toFixed(1)}h` : '0.0h'}
            sub={events.length > 0 ? `${events.length} event${events.length > 1 ? 's' : ''}` : 'no route delays'}
            valueClass={totalEventHours > 0 ? 'text-yellow-400' : 'text-emerald-400'}
            icon={Zap}
          />
          <MetricCell
            label="ML Predicted ETA"
            value={initialMlEtaHours ? formatHours(initialMlEtaHours) : 'Calculating...'}
            sub="fixed at trip start"
            valueClass="text-sky-400"
            icon={TrendingUp}
          />
          <MetricCell
            label="Live ETA"
            value={isDelivered ? '0.0h' : formatHours(liveEtaHours)}
            sub={selectedTruck.etaRevisionCount ? `refreshed ${selectedTruck.etaRevisionCount}x by events` : 'same model, live inputs'}
            valueClass={totalEventHours > 0 ? 'text-orange-400' : 'text-white'}
            icon={TrendingUp}
          />
          <MetricCell
            label="Final Delay"
            value={isDelivered ? (finalDelayHours > 0 ? `+${finalDelayHours.toFixed(1)}h` : `${finalDelayHours.toFixed(1)}h`) : (finalDelayHours > 0 ? `+${finalDelayHours.toFixed(1)}h` : '0.0h')}
            sub={isDelivered ? 'actual - ML predicted' : 'live ETA - ML predicted'}
            valueClass={finalDelayHours > 0.5 ? 'text-red-400' : finalDelayHours > 0 ? 'text-yellow-400' : 'text-emerald-400'}
            icon={AlertTriangle}
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
              <p className="text-[10px] text-slate-500">Live ETA is recalculated with the <b className="text-yellow-400">ML model</b> when route events are encountered</p>
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
              <p className="text-[10px] text-slate-400 mt-0.5">The same ML model recalculates live ETA with current route conditions.</p>
            </div>
          </div>
        )}
      </div>
    );
}
