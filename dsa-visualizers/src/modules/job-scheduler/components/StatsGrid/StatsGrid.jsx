import React from 'react';
import './StatsGrid.css';

export default function StatsGrid({ stats }) {
  if (!stats) return null;
  const items = [
    { label: 'Avg Waiting',     value: `${stats.avgWaiting} u`,   color: 'var(--red)' },
    { label: 'Avg Turnaround',  value: `${stats.avgTurnaround} u`, color: 'var(--yellow)' },
    { label: 'Avg Response',    value: `${stats.avgResponse} u`,   color: 'var(--blue)' },
    { label: 'CPU Utilization', value: `${stats.cpuUtil}%`,        color: 'var(--green)' },
    { label: 'Throughput',      value: `${stats.throughput} j/u`,  color: 'var(--accent)' },
    { label: 'Makespan',        value: `${stats.makespan} u`,      color: 'var(--orange)' },
  ];

  return (
    <div className="stats-grid">
      {items.map(it => (
        <div key={it.label} className="sg-card">
          <span className="sg-value" style={{ color: it.color }}>{it.value}</span>
          <span className="sg-label">{it.label}</span>
        </div>
      ))}
    </div>
  );
}
