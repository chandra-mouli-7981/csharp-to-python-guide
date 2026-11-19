import React, { useState } from 'react';
import './JobForm.css';

export default function JobForm({ onAdd }) {
  const [form, setForm] = useState({ name: '', arrivalTime: 0, burstTime: 3, priority: 1, deadline: 10 });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAdd({ ...form, arrivalTime: +form.arrivalTime, burstTime: +form.burstTime, priority: +form.priority, deadline: +form.deadline });
    setForm(f => ({ ...f, name: '' }));
  };

  return (
    <form className="job-form" onSubmit={submit}>
      <div className="jf-title">Add Job</div>
      <div className="jf-row">
        <div className="jf-field">
          <label>Name</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="P5" maxLength={6} required />
        </div>
        <div className="jf-field">
          <label>Arrival</label>
          <input type="number" min="0" value={form.arrivalTime} onChange={e => set('arrivalTime', e.target.value)} />
        </div>
        <div className="jf-field">
          <label>Burst</label>
          <input type="number" min="1" value={form.burstTime} onChange={e => set('burstTime', e.target.value)} />
        </div>
        <div className="jf-field">
          <label>Priority</label>
          <input type="number" min="1" max="10" value={form.priority} onChange={e => set('priority', e.target.value)} />
        </div>
        <div className="jf-field">
          <label>Deadline</label>
          <input type="number" min="1" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
        </div>
      </div>
      <button className="btn-add-job" type="submit">+ Add</button>
    </form>
  );
}
