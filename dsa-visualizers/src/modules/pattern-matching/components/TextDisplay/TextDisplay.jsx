import React from 'react';
import './TextDisplay.css';

export default function TextDisplay({ text, pattern, matches, color, activeStep, steps }) {
  if (!text) return null;

  // Build a set of highlighted positions from confirmed matches
  const matchSet = new Set();
  matches?.forEach(start => {
    for (let i = 0; i < pattern.length; i++) matchSet.add(start + i);
  });

  // Current step window (window of m chars being compared)
  const step = steps?.[activeStep];
  const windowStart = step?.windowStart ?? step?.textIdx ?? -1;
  const windowEnd   = windowStart >= 0 ? windowStart + pattern.length - 1 : -1;

  return (
    <div className="text-display">
      <div className="td-header">
        <span className="td-label">Text</span>
        {matches && (
          <span className="td-matches" style={{ color }}>
            {matches.length} match{matches.length !== 1 ? 'es' : ''}
          </span>
        )}
      </div>
      <div className="td-text">
        {text.split('').map((ch, i) => {
          const isMatch  = matchSet.has(i);
          const inWindow = i >= windowStart && i <= windowEnd;
          return (
            <span
              key={i}
              className={`td-char ${isMatch ? 'td-match' : ''} ${inWindow && !isMatch ? 'td-window' : ''}`}
              style={isMatch ? { background: color + '33', color, borderColor: color } : {}}
            >
              {ch === ' ' ? '\u00A0' : ch}
            </span>
          );
        })}
      </div>
    </div>
  );
}
