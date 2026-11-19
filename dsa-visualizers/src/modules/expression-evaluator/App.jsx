import React from 'react';
import './App.css';
import ExprInput from './components/ExprInput/ExprInput';
import StackVisualizer from './components/StackVisualizer/StackVisualizer';
import EvalVisualizer from './components/EvalVisualizer/EvalVisualizer';
import StepControls from './components/StepControls/StepControls';
import { useEvaluator } from './hooks/useEvaluator';

export default function App() {
  const {
    expression, setExpression,
    tokens, postfix,
    parseSteps, evalSteps,
    currentStep, phase, activeStep,
    result, error,
    isPlaying,
    evaluate, stepForward, stepBack, play, reset,
  } = useEvaluator();

  const hasResult = result !== null && !error;

  return (
    <div className="app">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="brand">
          <span className="brand-icon">⇌</span>
          <span className="brand-name">ExprEval</span>
        </div>
        <div className="navbar-info">
          <span className="info-badge">Shunting-Yard</span>
          <span className="info-sep">+</span>
          <span className="info-badge green">Stack Evaluation</span>
        </div>
        {hasResult && (
          <div className="navbar-result">
            <span className="result-label">Result</span>
            <span className="result-value">
              {Number.isInteger(result) ? result : parseFloat(result.toFixed(8))}
            </span>
          </div>
        )}
      </nav>

      {/* ── Input ── */}
      <ExprInput
        expression={expression}
        onChange={setExpression}
        onEvaluate={evaluate}
        error={error}
      />

      {/* ── Token strip ── */}
      {tokens.length > 0 && (
        <div className="token-strip">
          <span className="ts-label">Tokens</span>
          {tokens.map((t, i) => (
            <span key={i} className={`ts-token tok-${t.type}`}>{t.value}</span>
          ))}
          <span className="ts-arrow">→</span>
          <span className="ts-label">Postfix</span>
          {postfix.map((t, i) => (
            <span key={i} className={`ts-token tok-${t.type} ts-postfix`}>{t.value}</span>
          ))}
        </div>
      )}

      {/* ── Main visualizers ── */}
      <div className="main-area">
        {parseSteps.length > 0 && (
          <div className="vis-panel">
            <div className="panel-header">
              <span className="panel-title">Shunting-Yard</span>
              <span className="panel-sub">Infix → Postfix conversion</span>
            </div>
            <StackVisualizer
              step={phase === 'parse' ? parseSteps[currentStep] : parseSteps[parseSteps.length - 1]}
              phase={phase}
            />
          </div>
        )}

        {evalSteps.length > 0 && (
          <div className="vis-panel">
            <div className="panel-header green-header">
              <span className="panel-title">Stack Evaluation</span>
              <span className="panel-sub">Postfix → Result</span>
            </div>
            <EvalVisualizer step={phase === 'eval' ? evalSteps[currentStep] : null} />
          </div>
        )}
      </div>

      {/* ── Step controls ── */}
      {parseSteps.length > 0 && (
        <StepControls
          onBack={stepBack}
          onForward={stepForward}
          onPlay={play}
          onReset={reset}
          isPlaying={isPlaying}
          currentStep={currentStep}
          totalSteps={parseSteps.length + evalSteps.length}
          phase={phase}
          parseSteps={parseSteps.length}
          evalSteps={evalSteps.length}
        />
      )}
    </div>
  );
}
