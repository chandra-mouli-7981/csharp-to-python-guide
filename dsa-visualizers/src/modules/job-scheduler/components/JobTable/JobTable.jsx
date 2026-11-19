import React from 'react';
import './JobTable.css';

export default function JobTable({ jobs, onRemove }) {
  if (!jobs.length) return <div className="jt-empty">No jobs. Add one above.</div>;

  return (
    <div className="job-table-wrap">
      <table className="job-table">
        <thead>
          <tr>
            <th>Job</th><th>Arrival</th><th>Burst</th><th>Priority</th><th>Deadline</th><th></th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(j => (
            <tr key={j.id}>
              <td>
                <span className="jt-dot" style={{ background: j.color }} />
                <span className="jt-name">{j.name}</span>
              </td>
              <td>{j.arrivalTime}</td>
              <td>{j.burstTime}</td>
              <td>{j.priority}</td>
              <td>{j.deadline}</td>
              <td>
                <button className="jt-remove" onClick={() => onRemove(j.id)} title="Remove">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
