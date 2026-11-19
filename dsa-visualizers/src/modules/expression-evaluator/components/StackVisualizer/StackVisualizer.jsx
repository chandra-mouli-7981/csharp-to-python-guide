import React from 'react';
import './StackVisualizer.css';

const TOKEN_COLOR = {
  number:   'tok-number',
  operator: 'tok-operator',
  function: 'tok-function',
  lparen:   'tok-paren',
  rparen:   'tok-paren',
  unary:    'tok-unary',
};

function Token({ token, small }) {
  if (!token) return null;
  return (
    <span className={`token ${TOKEN_COLOR[token.type] || ''} ${small ? 'token-sm' : ''}`}>
      {token.value}
    </span>
  );
}

export default function StackVisualizer({ step, phase }) {
  if (!step) return (
    <div className="sv-container">
      <div className="sv-placeholder">Run an expression, then step through the algorithm.</div>
    </div>
  );

  const { operatorStack, outputQueue, action, token } = step;

  return (
    <div className="sv-container">
      <div className="sv-action">
        <span className="sv-action-badge">Step</span>
        <span className="sv-action-text">{action}</span>
        {token && <Token token={token} />}
      </div>

      <div className="sv-columns">
        {/* Operator Stack */}
        <div className="sv-col">
          <div className="sv-col-header">
            <span>Operator Stack</span>
            <span className="sv-count">{operatorStack?.length ?? 0}</span>
          </div>
          <div className="sv-stack">
            {operatorStack?.length === 0 && <div className="sv-empty">empty</div>}
            {[...( operatorStack ?? [])].reverse().map((t, i) => (
              <div key={i} className={`sv-item ${i === 0 ? 'sv-top' : ''}`}>
                <Token token={t} small />
                {i === 0 && <span className="sv-tag">TOP</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Output Queue */}
        <div className="sv-col">
          <div className="sv-col-header">
            <span>Output Queue (Postfix)</span>
            <span className="sv-count">{outputQueue?.length ?? 0}</span>
          </div>
          <div className="sv-queue">
            {outputQueue?.length === 0 && <div className="sv-empty">empty</div>}
            <div className="sv-queue-items">
              {(outputQueue ?? []).map((t, i) => (
                <div key={i} className={`sv-item ${i === outputQueue.length - 1 ? 'sv-top' : ''}`}>
                  <Token token={t} small />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
