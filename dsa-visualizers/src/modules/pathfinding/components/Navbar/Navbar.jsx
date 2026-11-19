import React, { useState } from 'react';
import { ALGORITHM_INFO, SPEEDS } from '../../utils/constants';
import './Navbar.css';

export default function Navbar({
  algorithm,
  onAlgorithmChange,
  speed,
  onSpeedChange,
  onVisualize,
  onReset,
  onClearBoard,
  onClearWalls,
  onGenerateMaze,
  isRunning,
  isFinished,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const info = ALGORITHM_INFO[algorithm];

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="navbar-brand">
          <span className="brand-icon">⬡</span>
          <span className="brand-name">PathFinder</span>
        </div>

        <div className="navbar-divider" />

        <div className="control-group">
          <label className="control-label">Algorithm</label>
          <select
            className="control-select"
            value={algorithm}
            onChange={e => onAlgorithmChange(e.target.value)}
            disabled={isRunning}
          >
            {Object.entries(ALGORITHM_INFO).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label className="control-label">Speed</label>
          <select
            className="control-select"
            value={speed}
            onChange={e => onSpeedChange(e.target.value)}
            disabled={isRunning}
          >
            {Object.entries(SPEEDS).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>

        <div className="algo-badges">
          <span className={`badge ${info.guaranteed ? 'badge-green' : 'badge-red'}`}>
            {info.guaranteed ? '✓ Shortest Path' : '✗ No Guarantee'}
          </span>
          <span className={`badge ${info.weighted ? 'badge-blue' : 'badge-gray'}`}>
            {info.weighted ? 'Weighted' : 'Unweighted'}
          </span>
        </div>
      </div>

      <div className="navbar-right">
        <div className="btn-group">
          <button
            className="btn btn-ghost"
            onClick={onGenerateMaze}
            disabled={isRunning}
            title="Generate recursive division maze"
          >
            <span>⬡</span> Maze
          </button>
          <button
            className="btn btn-ghost"
            onClick={onClearWalls}
            disabled={isRunning}
          >
            Clear Walls
          </button>
          <button
            className="btn btn-ghost"
            onClick={onClearBoard}
            disabled={isRunning}
          >
            Clear Board
          </button>
        </div>

        <div className="navbar-divider" />

        {isRunning ? (
          <button className="btn btn-danger" onClick={onReset}>
            ■ Stop
          </button>
        ) : isFinished ? (
          <button className="btn btn-secondary" onClick={onReset}>
            ↺ Reset
          </button>
        ) : (
          <button className="btn btn-primary" onClick={onVisualize}>
            ▶ Visualize {info.label}
          </button>
        )}
      </div>
    </nav>
  );
}
