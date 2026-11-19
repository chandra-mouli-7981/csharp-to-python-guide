import React from 'react';
import './App.css';
import SearchInput from './components/SearchInput/SearchInput';
import TextDisplay from './components/TextDisplay/TextDisplay';
import AlgoCard from './components/AlgoCard/AlgoCard';
import StepVisualizer from './components/StepVisualizer/StepVisualizer';
import { usePatternMatch } from './hooks/usePatternMatch';

const ALGOS = [
  { key: 'KMP',       name: 'KMP',        color: '#6c63ff', complexity: 'O(n + m)' },
  { key: 'RabinKarp', name: 'Rabin-Karp', color: '#48cfad', complexity: 'O(n + m) avg' },
  { key: 'ZAlgo',     name: 'Z-Algorithm',color: '#ffd166', complexity: 'O(n + m)' },
];

export default function App() {
  const {
    text, setText, pattern, setPattern,
    results, activeAlgo, setActiveAlgo,
    activeStep, setActiveStep,
    steps,
    run,
  } = usePatternMatch();

  const activeResult = results?.[activeAlgo];
  const activeColor  = ALGOS.find(a => a.key === activeAlgo)?.color ?? '#6c63ff';

  return (
    <div className="app">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="brand">
          <span className="brand-icon">⌕</span>
          <span className="brand-name">PatternMatch</span>
        </div>
        <div className="algo-complexity">
          {ALGOS.map(a => (
            <div key={a.key} className="cplx-item">
              <span className="cplx-name" style={{ color: a.color }}>{a.name}</span>
              <code className="cplx-val">{a.complexity}</code>
            </div>
          ))}
        </div>
        {results && (
          <div className="match-summary">
            {ALGOS.map(a => (
              <span key={a.key} className="ms-item" style={{ color: a.color }}>
                {results[a.key]?.matches.length ?? 0}
              </span>
            ))}
            <span className="ms-label">matches</span>
          </div>
        )}
      </nav>

      {/* ── Search Input ── */}
      <SearchInput
        text={text} pattern={pattern}
        onTextChange={setText}
        onPatternChange={setPattern}
        onRun={run}
      />

      <div className="main-layout">
        {/* ── Left: Text display + Step visualizer ── */}
        <div className="content">
          <TextDisplay
            text={text}
            pattern={pattern}
            matches={activeResult?.matches}
            color={activeColor}
            activeStep={activeStep}
            steps={activeResult?.steps}
          />

          {results && (
            <StepVisualizer
              steps={steps}
              activeStep={activeStep}
              onStepChange={setActiveStep}
              algoName={ALGOS.find(a => a.key === activeAlgo)?.name}
              color={activeColor}
            />
          )}

          {/* Comparison table */}
          {results && (
            <div className="compare-table">
              <div className="ct-header">Algorithm Comparison</div>
              <table>
                <thead>
                  <tr>
                    <th>Algorithm</th><th>Matches</th><th>Comparisons</th>
                    <th>Complexity</th><th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {ALGOS.map(a => {
                    const r = results[a.key];
                    return (
                      <tr key={a.key} className={activeAlgo === a.key ? 'ct-active' : ''}
                        onClick={() => setActiveAlgo(a.key)} style={{ cursor: 'pointer' }}>
                        <td><span className="ct-dot" style={{ background: a.color }} />{a.name}</td>
                        <td style={{ color: a.color, fontWeight: 700 }}>{r?.matches.length ?? 0}</td>
                        <td>{r?.comparisons ?? 0}</td>
                        <td><code>{a.complexity}</code></td>
                        <td className="ct-notes">
                          {a.key === 'KMP'       && 'Uses failure function for backtracking'}
                          {a.key === 'RabinKarp' && `Rolling hash · ${r?.hashCollisions ?? 0} collision(s)`}
                          {a.key === 'ZAlgo'     && 'Z-array prefix matching'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Right: Algorithm cards ── */}
        <aside className="sidebar">
          {ALGOS.map(a => (
            <AlgoCard
              key={a.key}
              name={a.name}
              color={a.color}
              result={results?.[a.key]}
              isActive={activeAlgo === a.key}
              onClick={() => setActiveAlgo(a.key)}
            />
          ))}

          {!results && (
            <div className="sidebar-hint">
              <p>Run a search to see algorithm details, failure functions, Z-arrays, and step-by-step traces.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
