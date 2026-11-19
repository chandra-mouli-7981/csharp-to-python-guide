import React from 'react';
import './Legend.css';

const ITEMS = [
  { className: 'legend-start',   label: 'Start Node' },
  { className: 'legend-end',     label: 'End Node' },
  { className: 'legend-wall',    label: 'Wall' },
  { className: 'legend-visited', label: 'Visited' },
  { className: 'legend-path',    label: 'Shortest Path' },
  { className: 'legend-empty',   label: 'Unvisited' },
];

export default function Legend() {
  return (
    <div className="legend">
      {ITEMS.map(item => (
        <div key={item.label} className="legend-item">
          <div className={`legend-swatch ${item.className}`} />
          <span>{item.label}</span>
        </div>
      ))}
      <div className="legend-hint">
        <span>💡</span>
        <span>Click &amp; drag to draw walls · Drag ▶ / ◆ to move</span>
      </div>
    </div>
  );
}
