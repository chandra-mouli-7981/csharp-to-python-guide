import React from 'react';
import './GanttChart.css';

export default function GanttChart({ timeline }) {
  if (!timeline?.length) return <div className="gc-empty">Run the scheduler to see the Gantt chart.</div>;

  const makespan = timeline.at(-1).end;
  const scale    = 100 / makespan;

  // Group segments by job for the row-based view
  const jobRows = [];
  const seen    = new Map();
  timeline.forEach(seg => {
    if (!seen.has(seg.jobId)) { seen.set(seg.jobId, jobRows.length); jobRows.push({ jobId: seg.jobId, jobName: seg.jobName, color: seg.color, segs: [] }); }
    jobRows[seen.get(seg.jobId)].segs.push(seg);
  });

  // Time ticks
  const ticks = Array.from({ length: makespan + 1 }, (_, i) => i);

  return (
    <div className="gantt-chart">
      <div className="gc-header">
        <span className="gc-title">Gantt Chart</span>
        <span className="gc-makespan">Makespan: <strong>{makespan}</strong> units</span>
      </div>

      {/* Timeline bar */}
      <div className="gc-timeline-wrap">
        <div className="gc-labels">
          {jobRows.map(row => (
            <div key={row.jobId} className="gc-row-label">
              <span className="gc-dot" style={{ background: row.color }} />
              {row.jobName}
            </div>
          ))}
        </div>

        <div className="gc-rows">
          {jobRows.map(row => (
            <div key={row.jobId} className="gc-row">
              {row.segs.map((seg, i) => (
                <div
                  key={i}
                  className="gc-seg"
                  style={{
                    left:    `${seg.start * scale}%`,
                    width:   `${(seg.end - seg.start) * scale}%`,
                    background: row.color,
                  }}
                  title={`${seg.jobName}: [${seg.start} – ${seg.end}]`}
                >
                  <span className="gc-seg-label">{seg.jobName}</span>
                </div>
              ))}
            </div>
          ))}

          {/* Tick marks */}
          <div className="gc-ticks">
            {ticks.map(t => (
              <div key={t} className="gc-tick" style={{ left: `${t * scale}%` }}>
                <span className="gc-tick-label">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
