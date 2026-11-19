import { useState, useCallback } from 'react';
import { fcfs, sjf, priorityScheduling, edf, roundRobin } from '../algorithms/schedulers';
import { MinHeap } from '../algorithms/minHeap';

const JOB_COLORS = ['#6c63ff','#48cfad','#ff6584','#ffd166','#5b89f7','#ffb347','#a29bfe','#00cec9','#fd79a8','#e17055'];

let nextId = 1;

const DEFAULT_JOBS = [
  { id: 1, name: 'P1', arrivalTime: 0, burstTime: 6, priority: 2, deadline: 10, color: JOB_COLORS[0] },
  { id: 2, name: 'P2', arrivalTime: 1, burstTime: 3, priority: 1, deadline: 8,  color: JOB_COLORS[1] },
  { id: 3, name: 'P3', arrivalTime: 2, burstTime: 4, priority: 3, deadline: 12, color: JOB_COLORS[2] },
  { id: 4, name: 'P4', arrivalTime: 3, burstTime: 2, priority: 2, deadline: 9,  color: JOB_COLORS[3] },
];
nextId = 5;

const ALGO_MAP = { FCFS: fcfs, SJF: sjf, Priority: priorityScheduling, EDF: edf, RR: roundRobin };

export function useScheduler() {
  const [jobs, setJobs]         = useState(DEFAULT_JOBS);
  const [algorithm, setAlgo]    = useState('FCFS');
  const [quantum, setQuantum]   = useState(2);
  const [result, setResult]     = useState(null);
  const [heapSnap, setHeapSnap] = useState([]);

  const run = useCallback(() => {
    if (!jobs.length) return;
    const fn  = ALGO_MAP[algorithm];
    const res = fn(jobs, quantum);
    setResult(res);

    // Build heap snapshot from jobs (using priority for display)
    const heap = new MinHeap((a, b) => a.priority - b.priority);
    jobs.forEach(j => heap.push(j));
    setHeapSnap(heap.snapshot());
  }, [jobs, algorithm, quantum]);

  const addJob = useCallback((job) => {
    const colorIdx = (nextId - 1) % JOB_COLORS.length;
    setJobs(prev => [...prev, { ...job, id: nextId++, color: JOB_COLORS[colorIdx] }]);
    setResult(null);
  }, []);

  const removeJob = useCallback((id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    setResult(null);
  }, []);

  const clearJobs = useCallback(() => { setJobs([]); setResult(null); setHeapSnap([]); nextId = 1; }, []);

  const reset = useCallback(() => {
    setJobs(DEFAULT_JOBS); setResult(null); setHeapSnap([]); nextId = 5;
  }, []);

  return { jobs, algorithm, setAlgo, quantum, setQuantum, result, heapSnap, run, addJob, removeJob, clearJobs, reset };
}
