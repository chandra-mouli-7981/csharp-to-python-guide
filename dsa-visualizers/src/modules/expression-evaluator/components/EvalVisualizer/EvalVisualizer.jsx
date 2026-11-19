import React from 'react';
import './EvalVisualizer.css';

export default function EvalVisualizer({ step }) {
  if (!step) return null;

  const { stack, action } = step;

  return (
    <div className="ev-container">
      <div className="ev-action">
        <span className="ev-badge">Eval</span>
        <span className="ev-text">{action}</span>
      </div>
      <div className="ev-col-header">
        <span>Evaluation Stack</span>
        <span className="ev-count">{stack.length}</span>
      </div>
      <div className="ev-stack">
        {stack.length === 0 && <div className="ev-empty">empty</div>}
        {[...stack].reverse().map((val, i) => (
          <div key={i} className={`ev-item ${i === 0 ? 'ev-top' : ''}`}>
            <span className="ev-val">{typeof val === 'number' && !Number.isInteger(val)
              ? val.toFixed(6) : val}</span>
            {i === 0 && <span className="ev-tag">TOP</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
