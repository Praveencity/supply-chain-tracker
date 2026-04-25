import React, { useState, useEffect } from 'react';
import { Brain, Database, RefreshCw, Trash2, AlertTriangle } from 'lucide-react';

export default function TrainModelPanel() {
  const [stats, setStats]         = useState(null);
  const [loading, setLoading]     = useState(false);
  const [purging, setPurging]     = useState(false);
  const [purgeResult, setPurgeResult] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/dataset-stats'); // fast, no retraining
      if (res.ok) {
        const d = await res.json();
        setStats(d);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch {}
    setLoading(false);
  };

  const purgeBaseline = async () => {
    if (!window.confirm(`Remove all ${stats?.baseline_records ?? '?'} synthetic baseline rows and retrain on real data only?\n\nThis cannot be undone.`)) return;
    setPurging(true);
    setPurgeResult(null);
    try {
      const res = await fetch('http://localhost:8000/api/purge-baseline', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail);
      setPurgeResult({ ok: true, msg: d.message });
      await fetchStats(); // refresh stats
    } catch (e) {
      setPurgeResult({ ok: false, msg: e.message });
    }
    setPurging(false);
  };

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 30000);
    return () => clearInterval(t);
  }, []);

  const hasBaseline = stats && stats.baseline_records > 0;

  return (
    <div className="glass-panel border border-dark-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="bg-violet-600/20 p-1.5 rounded-lg">
            <Brain size={14} className="text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">Model Dataset</p>
            <p className="text-xs text-slate-500">Auto-retrains on each delivery</p>
          </div>
        </div>
        <button onClick={fetchStats} disabled={loading} className="p-1.5 text-slate-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors cursor-pointer" title="Refresh">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {stats ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { label: 'Total',    value: stats.total_records,         color: 'text-white' },
            { label: 'Real',     value: stats.real_delivery_records,  color: 'text-emerald-400' },
            { label: 'Baseline', value: stats.baseline_records,       color: hasBaseline ? 'text-orange-400' : 'text-slate-500' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-dark-900/60 rounded-lg px-2 py-2 border border-dark-700 text-center">
              <p className="text-xs text-slate-500 font-bold uppercase">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-1 mb-3">
          <Database size={12} /> Loading...
        </div>
      )}

      {/* Purge baseline button — only shown while synthetic rows still exist */}
      {hasBaseline && (
        <button
          onClick={purgeBaseline}
          disabled={purging}
          className="w-full flex items-center justify-center gap-2 text-xs font-bold text-orange-300 bg-orange-900/20 hover:bg-orange-900/40 border border-orange-500/30 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          {purging ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
          {purging ? 'Purging & Retraining...' : `Remove ${stats.baseline_records} synthetic baseline rows`}
        </button>
      )}

      {purgeResult && (
        <div className={`mt-2 text-xs font-bold px-3 py-2 rounded-lg border ${purgeResult.ok ? 'text-emerald-400 bg-emerald-900/20 border-emerald-500/20' : 'text-red-400 bg-red-900/20 border-red-500/20'}`}>
          {purgeResult.ok ? '✅' : '⚠'} {purgeResult.msg}
        </div>
      )}

      {!hasBaseline && stats && (
        <p className="text-xs text-emerald-500 font-bold text-center">✅ Training on real data only</p>
      )}

      {lastUpdated && <p className="text-xs text-slate-600 mt-2 text-right">Updated {lastUpdated}</p>}
    </div>
  );
}
