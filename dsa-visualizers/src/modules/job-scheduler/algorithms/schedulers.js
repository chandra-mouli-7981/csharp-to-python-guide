import { MinHeap } from './minHeap';

/**
 * Each scheduler returns:
 *   timeline : [{ jobId, jobName, start, end, color }]
 *   stats    : { avgWaiting, avgTurnaround, avgResponse, cpuUtil, throughput }
 *   order    : jobId[]   (completion order)
 */

// ── helpers ──────────────────────────────────
function calcStats(jobs, timeline) {
  const completionMap = {};
  timeline.forEach(s => { completionMap[s.jobId] = s.end; });

  let totalWait = 0, totalTA = 0, totalResp = 0;
  jobs.forEach(j => {
    const ct = completionMap[j.id] ?? 0;
    const ta = ct - j.arrivalTime;
    const wt = ta - j.burstTime;
    const rt = (timeline.find(s => s.jobId === j.id)?.start ?? 0) - j.arrivalTime;
    totalWait += Math.max(0, wt);
    totalTA   += Math.max(0, ta);
    totalResp += Math.max(0, rt);
  });

  const n        = jobs.length;
  const makespan = timeline.at(-1)?.end ?? 0;
  const busyTime = timeline.reduce((s, seg) => s + (seg.end - seg.start), 0);

  return {
    avgWaiting:    +(totalWait / n).toFixed(2),
    avgTurnaround: +(totalTA   / n).toFixed(2),
    avgResponse:   +(totalResp / n).toFixed(2),
    cpuUtil:       makespan ? +((busyTime / makespan) * 100).toFixed(1) : 0,
    throughput:    makespan ? +(n / makespan).toFixed(3) : 0,
    makespan,
  };
}

function sortedByArrival(jobs) {
  return [...jobs].sort((a, b) => a.arrivalTime - b.arrivalTime);
}

// ── 1. FCFS ──────────────────────────────────
export function fcfs(jobs) {
  const sorted   = sortedByArrival(jobs);
  const timeline = [];
  let time       = 0;

  for (const job of sorted) {
    time = Math.max(time, job.arrivalTime);
    timeline.push({ jobId: job.id, jobName: job.name, start: time, end: time + job.burstTime, color: job.color });
    time += job.burstTime;
  }

  return { timeline, stats: calcStats(jobs, timeline), order: timeline.map(s => s.jobId) };
}

// ── 2. SJF (non-preemptive) ──────────────────
export function sjf(jobs) {
  const remaining = sortedByArrival(jobs).map(j => ({ ...j }));
  const timeline  = [];
  let   time      = 0;
  const done      = new Set();

  while (done.size < jobs.length) {
    const available = remaining.filter(j => !done.has(j.id) && j.arrivalTime <= time);
    if (!available.length) { time++; continue; }
    available.sort((a, b) => a.burstTime - b.burstTime);
    const job = available[0];
    timeline.push({ jobId: job.id, jobName: job.name, start: time, end: time + job.burstTime, color: job.color });
    time += job.burstTime;
    done.add(job.id);
  }

  return { timeline, stats: calcStats(jobs, timeline), order: timeline.map(s => s.jobId) };
}

// ── 3. Priority (non-preemptive, lower = higher priority) ──
export function priorityScheduling(jobs) {
  const remaining = sortedByArrival(jobs).map(j => ({ ...j }));
  const timeline  = [];
  let   time      = 0;
  const done      = new Set();

  while (done.size < jobs.length) {
    const available = remaining.filter(j => !done.has(j.id) && j.arrivalTime <= time);
    if (!available.length) { time++; continue; }
    available.sort((a, b) => a.priority - b.priority);
    const job = available[0];
    timeline.push({ jobId: job.id, jobName: job.name, start: time, end: time + job.burstTime, color: job.color });
    time += job.burstTime;
    done.add(job.id);
  }

  return { timeline, stats: calcStats(jobs, timeline), order: timeline.map(s => s.jobId) };
}

// ── 4. EDF — Earliest Deadline First (non-preemptive) ──
export function edf(jobs) {
  const remaining = sortedByArrival(jobs).map(j => ({ ...j }));
  const timeline  = [];
  let   time      = 0;
  const done      = new Set();

  while (done.size < jobs.length) {
    const available = remaining.filter(j => !done.has(j.id) && j.arrivalTime <= time);
    if (!available.length) { time++; continue; }
    // Use MinHeap for realistic EDF behaviour
    const heap = new MinHeap((a, b) => a.deadline - b.deadline);
    available.forEach(j => heap.push(j));
    const job = heap.pop();
    timeline.push({ jobId: job.id, jobName: job.name, start: time, end: time + job.burstTime, color: job.color });
    time += job.burstTime;
    done.add(job.id);
  }

  return { timeline, stats: calcStats(jobs, timeline), order: timeline.map(s => s.jobId) };
}

// ── 5. Round Robin ────────────────────────────
export function roundRobin(jobs, quantum = 2) {
  const procs    = sortedByArrival(jobs).map(j => ({ ...j, remaining: j.burstTime }));
  const timeline = [];
  let   time     = 0;
  const queue    = [];
  const enqueued = new Set();
  let   ptr      = 0;

  // Enqueue all jobs that arrive at t=0
  procs.filter(p => p.arrivalTime <= time).forEach(p => { queue.push(p); enqueued.add(p.id); });

  while (queue.length || procs.some(p => !enqueued.has(p.id))) {
    if (!queue.length) {
      // Advance time to next arrival
      const next = procs.filter(p => !enqueued.has(p.id)).sort((a,b) => a.arrivalTime - b.arrivalTime)[0];
      time = next.arrivalTime;
      queue.push(next); enqueued.add(next.id);
    }

    const job    = queue.shift();
    const slice  = Math.min(quantum, job.remaining);
    const start  = Math.max(time, job.arrivalTime);

    timeline.push({ jobId: job.id, jobName: job.name, start, end: start + slice, color: job.color });
    time = start + slice;
    job.remaining -= slice;

    // Enqueue newly arrived jobs
    procs.filter(p => !enqueued.has(p.id) && p.arrivalTime <= time)
         .forEach(p => { queue.push(p); enqueued.add(p.id); });

    if (job.remaining > 0) queue.push(job);
  }

  // A job finishes at the end of its LAST slice, so order by that (not by first appearance).
  const finishedAt = new Map();
  timeline.forEach(s => finishedAt.set(s.jobId, s.end));
  const order = [...finishedAt.keys()].sort((a, b) => finishedAt.get(a) - finishedAt.get(b));

  return { timeline, stats: calcStats(jobs, timeline), order };
}
