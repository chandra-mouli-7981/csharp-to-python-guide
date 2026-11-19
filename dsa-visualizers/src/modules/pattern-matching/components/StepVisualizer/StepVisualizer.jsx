import React from 'react';
import './StepVisualizer.css';

export default function StepVisualizer({ steps, activeStep, onStepChange, algoName, color }) {
  if (!steps?.length) return null;

  const step = steps[activeStep];

  return (
    <div className="step-vis">
      <div className="sv-header">
        <span className="sv-title">{algoName} — Step-by-Step</span>
        <div className="sv-nav">
          <button className="sv-btn" disabled={activeStep <= 0}
            onClick={() => onStepChange(Math.max(0, activeStep - 1))}>◀</button>
          <span className="sv-counter">
            {activeStep >= 0 ? activeStep + 1 : 0} / {steps.length}
          </span>
          <button className="sv-btn" disabled={activeStep >= steps.length - 1}
            onClick={() => onStepChange(Math.min(steps.length - 1, activeStep + 1))}>▶</button>
        </div>
      </div>

      <div className="sv-progress">
        <div className="sv-prog-fill" style={{ width: `${((activeStep + 1) / steps.length) * 100}%`, background: color }} />
      </div>

      {step && (
        <div className={`sv-step ${step.match || step.found || step.verified ? 'sv-step-match' : ''}`}
          style={step.match || step.found || step.verified ? { borderColor: color } : {}}>
          <span className="sv-action">{step.action}</span>
          {step.zVal !== undefined && (
            <span className="sv-detail">Z-value: <code>{step.zVal}</code></span>
          )}
          {step.hash !== undefined && (
            <span className="sv-detail">Window hash: <code>{step.hash.slice(0, 10)}</code></span>
          )}
        </div>
      )}

      <div className="sv-timeline">
        {steps.slice(Math.max(0, activeStep - 5), activeStep + 6).map((s, i) => {
          const realIdx = Math.max(0, activeStep - 5) + i;
          return (
            <div
              key={realIdx}
              className={`sv-tick ${realIdx === activeStep ? 'sv-tick-active' : ''} ${s.match || s.found || s.verified ? 'sv-tick-match' : ''}`}
              style={realIdx === activeStep ? { borderColor: color, background: color + '22' } : {}}
              onClick={() => onStepChange(realIdx)}
              title={s.action}
            />
          );
        })}
      </div>
    </div>
  );
}
