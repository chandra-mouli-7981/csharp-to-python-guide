> **Now a module of the shared `dsa-visualizers` app.** This folder is `src/modules/job-scheduler`; there is no separate `package.json` or `npm start` here any more.
> From `dsa-visualizers/` run `npm install` then `npm start` and open `http://localhost:3000/#/job-scheduler` (or `npm run build` for the static site in `dist/`). The run instructions further down describe the old stand-alone project.
>
> Accuracy note: only EDF uses the MinHeap (rebuilt per pick). Priority scheduling sorts the ready list, so the 'Uses Heap' column below is not accurate for Priority.
>

# ⚙ Job Scheduler — Priority Queue & Heap

An interactive CPU job scheduler that simulates **5 real OS scheduling algorithms** using a **Min-Heap / Priority Queue**. Visualizes execution order with a Gantt chart, heap tree, and performance statistics.

**[Live Demo](https://your-demo-link.vercel.app)** · **[Portfolio](https://yourportfolio.com)**

---

## ✨ Features

- **5 scheduling algorithms** — FCFS, SJF, Priority, EDF, Round Robin
- **Gantt chart** — color-coded timeline per job, tick marks, makespan
- **Heap tree visualizer** — live binary tree of the priority queue
- **Stats panel** — avg waiting, turnaround, response time, CPU utilization, throughput
- **Configurable jobs** — name, arrival time, burst time, priority, deadline
- **Round Robin quantum** — adjustable time quantum control

---

## 🧠 Algorithms

| Algorithm      | Strategy                    | Uses Heap |
|----------------|-----------------------------|-----------|
| FCFS           | Arrival order               | ✗         |
| SJF            | Shortest burst first        | ✗         |
| Priority       | Lowest priority number      | ✓         |
| EDF            | Earliest deadline first     | ✓ (MinHeap by deadline) |
| Round Robin    | Time-sliced, cyclic         | ✗         |

### Min-Heap
Generic implementation with custom comparator, O(log n) push/pop, used as the core data structure for EDF and Priority scheduling.

---

## 🚀 Getting Started

```bash
cd job-scheduler
npm install
npm start       # → http://localhost:3000
```

---

## 🏗️ Project Structure

```
src/
├── algorithms/
│   ├── minHeap.js      # Generic MinHeap with comparator + snapshot()
│   └── schedulers.js   # FCFS · SJF · Priority · EDF · Round Robin
├── components/
│   ├── JobForm/        # Add jobs with all parameters
│   ├── JobTable/       # Job list with remove button
│   ├── GanttChart/     # SVG-based Gantt chart
│   ├── HeapTree/       # SVG binary tree of the heap
│   └── StatsGrid/      # 6-metric stats panel
├── hooks/
│   └── useScheduler.js # Algorithm dispatch, job state management
└── App.jsx
```

---

## 🎨 Tech Stack
- **React 18** · functional components · custom hooks · SVG
- **Vanilla CSS** — no UI library · dark theme
