import React from 'react';
import './App.css';
import JobForm from './components/JobForm/JobForm';
import JobTable from './components/JobTable/JobTable';
import GanttChart from './components/GanttChart/GanttChart';
import HeapTree from './components/HeapTree/HeapTree';
import StatsGrid from './components/StatsGrid/StatsGrid';
import { useScheduler } from './hooks/useScheduler';

const ALGORITHMS = [
  { key: 'FCFS',     label: 'FCFS',     desc: 'First Come First Served' },
  { key: 'SJF',      label: 'SJF',      desc: 'Shortest Job First' },
  { key: 'Priority', label: 'Priority', desc: 'Priority Scheduling' },
  { key: 'EDF',      label: 'EDF',      desc: 'Earliest Deadline First' },
  { key: 'RR',       label: 'Round Robin', desc: 'Time Quantum Based' },
];

export default function App() {
  const {
    jobs, algorithm, setAlgo, quantum, setQuantum,
    result, heapSnap,
    run, addJob, removeJob, clearJobs, reset,
  } = useScheduler();

  return (
    <div className="app">
      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="brand">
          <span className="brand-icon">⚙</span>
          <span className="brand-name">JobScheduler</span>
        </div>

        <div className="algo-tabs">
          {ALGORITHMS.map(a => (
            <button
              key={a.key}
              className={`algo-tab ${algorithm === a.key ? 'active' : ''}`}
              onClick={() => setAlgo(a.key)}
              title={a.desc}
            >
              {a.label}
            </button>
          ))}
        </div>

        {algorithm === 'RR' && (
          <div className="quantum-ctrl">
            <label>Quantum</label>
            <input
              type="number" min="1" max="10" value={quantum}
              onChange={e => setQuantum(+e.target.value)}
            />
          </div>
        )}

        <div className="navbar-actions">
          <button className="btn-ghost" onClick={reset}>Reset</button>
          <button className="btn-ghost danger" onClick={clearJobs}>Clear All</button>
          <button className="btn-run" onClick={run} disabled={!jobs.length}>
            ▶ Run {ALGORITHMS.find(a => a.key === algorithm)?.label}
          </button>
        </div>
      </nav>

      {/* ── Algorithm info bar ── */}
      <div className="info-bar">
        {ALGORITHMS.map(a => (
          <div key={a.key} className={`info-chip ${algorithm === a.key ? 'info-chip-active' : ''}`}>
            <span className="ic-key">{a.label}</span>
            <span className="ic-desc">{a.desc}</span>
          </div>
        ))}
      </div>

      <div className="main-layout">
        {/* ── Left: Job management ── */}
        <aside className="sidebar">
          <JobForm onAdd={addJob} />
          <div className="sidebar-section">
            <div className="section-title">
              Job Queue
              <span className="section-count">{jobs.length}</span>
            </div>
            <JobTable jobs={jobs} onRemove={removeJob} />
          </div>
          <HeapTree snapshot={heapSnap} jobs={jobs} />
        </aside>

        {/* ── Right: Results ── */}
        <div className="content">
          {result ? (
            <>
              <StatsGrid stats={result.stats} />
              <GanttChart timeline={result.timeline} />
              <div className="completion-order">
                <span className="co-label">Completion Order</span>
                {result.order.map((id, i) => {
                  const job = jobs.find(j => j.id === id);
                  return job ? (
                    <span key={i} className="co-chip" style={{ borderColor: job.color, color: job.color }}>
                      {job.name}
                    </span>
                  ) : null;
                })}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="es-icon">⚙</div>
              <div className="es-title">Ready to Schedule</div>
              <p className="es-sub">
                Add jobs on the left, select an algorithm above, then click <strong>Run</strong>.
              </p>
              <div className="es-algo-cards">
                {ALGORITHMS.map(a => (
                  <div key={a.key} className={`es-card ${algorithm === a.key ? 'es-card-active' : ''}`}
                    onClick={() => setAlgo(a.key)}>
                    <span className="es-card-key">{a.label}</span>
                    <span className="es-card-desc">{a.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
