import React from 'react';
import './StepControls.css';

export default function StepControls({
  onBack, onForward, onPlay, onReset,
  isPlaying, currentStep, totalSteps, phase,
  parseSteps, evalSteps,
}) {
  const overallStep  = phase === 'parse' ? currentStep : parseSteps + currentStep;
  const overallTotal = totalSteps;
  const progress     = overallTotal > 0 ? ((overallStep + 1) / overallTotal) * 100 : 0;

  return (
    <div className="step-controls">
      <div className="sc-progress-bar">
        <div className="sc-phase-label parse-label">
          Shunting-Yard ({parseSteps} steps)
        </div>
        <div className="sc-progress-track">
          <div className="sc-progress-fill" style={{ width: `${progress}%` }} />
          <div
            className="sc-cursor"
            style={{ left: `${progress}%` }}
          />
        </div>
        <div className="sc-phase-label eval-label">
          Evaluation ({evalSteps} steps)
        </div>
      </div>

      <div className="sc-row">
        <div className="sc-phase-badge" data-phase={phase}>
          {phase === 'parse' ? '⇌ Shunting-Yard' : '= Evaluation'}
        </div>
        <div className="sc-step-counter">
          Step {currentStep >= 0 ? currentStep + 1 : 0} / {phase === 'parse' ? parseSteps : evalSteps}
        </div>
        <div className="sc-buttons">
          <button className="sc-btn" onClick={onReset} title="Reset">⟳</button>
          <button className="sc-btn" onClick={onBack}  title="Step back"  disabled={currentStep <= 0 && phase === 'parse'}>◀</button>
          <button className={`sc-btn sc-play ${isPlaying ? 'playing' : ''}`} onClick={onPlay}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="sc-btn" onClick={onForward} title="Step forward">▶▶</button>
        </div>
      </div>
    </div>
  );
}
