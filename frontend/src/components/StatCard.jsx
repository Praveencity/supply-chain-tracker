import React from 'react';

export default function StatCard({ title, value, icon: Icon, trend, colorClass }) {
  return (
    <div className="glass-panel p-6 flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-white">{value}</h3>
        </div>
        <div className={`p-3 rounded-lg ${colorClass}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
