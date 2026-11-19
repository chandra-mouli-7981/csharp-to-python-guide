import React from 'react';
import './ExprInput.css';

const EXAMPLES = [
  '3 + 4 * 2',
  '(2 + 3) ^ 2 - 1',
  '10 / (2 + 3) * 4',
  'sqrt(16) + 2 ^ 3',
  'sin(pi / 6) * 2',
  '2 ^ 10 - 1024',
];

export default function ExprInput({ expression, onChange, onEvaluate, error }) {
  const handleKey = e => { if (e.key === 'Enter') onEvaluate(expression); };

  return (
    <div className="expr-input-section">
      <div className="expr-bar">
        <span className="expr-prefix">f(x) =</span>
        <input
          className={`expr-field ${error ? 'has-error' : ''}`}
          value={expression}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder="e.g.  3 + 4 * 2  or  sqrt(16) + 2^3"
          spellCheck={false}
          autoComplete="off"
        />
        <button className="btn-eval" onClick={() => onEvaluate(expression)}>
          Evaluate
        </button>
      </div>

      {error && <div className="expr-error">⚠ {error}</div>}

      <div className="examples">
        <span className="examples-label">Try:</span>
        {EXAMPLES.map(ex => (
          <button key={ex} className="example-chip" onClick={() => { onChange(ex); onEvaluate(ex); }}>
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
