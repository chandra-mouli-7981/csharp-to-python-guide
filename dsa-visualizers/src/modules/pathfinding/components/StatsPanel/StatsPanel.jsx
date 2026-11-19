import React from 'react';
import './StatsPanel.css';

export default function StatsPanel({ stats, algorithm, isRunning }) {
  if (isRunning) {
    return (
      <div className="stats-panel stats-running">
        <div className="stats-spinner" />
        <span>Visualizing…</span>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className={`stats-panel ${stats.found ? 'stats-found' : 'stats-not-found'}`}>
      {stats.found ? (
        <>
          <div className="stat">
            <span className="stat-value">{stats.pathLength}</span>
            <span className="stat-label">Path Length</span>
          </div>
          <div className="stats-divider" />
          <div className="stat">
            <span className="stat-value">{stats.visited}</span>
            <span className="stat-label">Nodes Visited</span>
          </div>
          <div className="stats-divider" />
          <div className="stat">
            <span className="stat-value">{stats.time}s</span>
            <span className="stat-label">Time Elapsed</span>
          </div>
          <div className="stats-badge stats-badge-found">✓ Path Found</div>
        </>
      ) : (
        <>
          <div className="stat">
            <span className="stat-value">{stats.visited}</span>
            <span className="stat-label">Nodes Visited</span>
          </div>
          <div className="stats-badge stats-badge-not-found">✗ No Path Exists</div>
        </>
      )}
    </div>
  );
}
