import React from 'react';
import './AlgoCard.css';

export default function AlgoCard({ name, color, result, isActive, onClick }) {
  const { matches = [], comparisons = 0, hashCollisions, failureFunction, zArray } = result || {};

  return (
    <div className={`algo-card ${isActive ? 'algo-card-active' : ''}`}
      style={{ '--algo-color': color }}
      onClick={onClick}
    >
      <div className="ac-header">
        <div className="ac-dot" style={{ background: color }} />
        <span className="ac-name">{name}</span>
        {isActive && <span className="ac-active-badge">Selected</span>}
      </div>

      <div className="ac-stats">
        <div className="ac-stat">
          <span className="ac-val" style={{ color }}>{matches.length}</span>
          <span className="ac-lbl">Matches</span>
        </div>
        <div className="ac-stat">
          <span className="ac-val">{comparisons}</span>
          <span className="ac-lbl">Comparisons</span>
        </div>
        {hashCollisions !== undefined && (
          <div className="ac-stat">
            <span className="ac-val" style={{ color: hashCollisions ? 'var(--red)' : 'var(--green)' }}>
              {hashCollisions}
            </span>
            <span className="ac-lbl">Collisions</span>
          </div>
        )}
      </div>

      {/* Failure function (KMP) */}
      {failureFunction?.length > 0 && (
        <div className="ac-array">
          <span className="ac-array-label">Failure Function</span>
          <div className="ac-cells">
            {failureFunction.map((v, i) => (
              <div key={i} className="ac-cell">
                <span className="ac-cell-idx">{i}</span>
                <span className="ac-cell-val" style={{ color }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Z-array */}
      {zArray?.length > 0 && (
        <div className="ac-array">
          <span className="ac-array-label">Z-Array (text portion)</span>
          <div className="ac-cells">
            {zArray.slice(0, 20).map((v, i) => (
              <div key={i} className={`ac-cell ${v > 0 ? 'ac-cell-nonzero' : ''}`}>
                <span className="ac-cell-idx">{i}</span>
                <span className="ac-cell-val" style={{ color: v > 0 ? color : undefined }}>{v}</span>
              </div>
            ))}
            {zArray.length > 20 && <span className="ac-more">+{zArray.length - 20}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
