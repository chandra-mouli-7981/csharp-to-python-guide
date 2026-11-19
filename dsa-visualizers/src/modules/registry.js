import { lazy } from 'react';

/**
 * Every visualizer is a self-contained folder under src/modules/<id>/ whose index.jsx
 * default-exports its root component. To add a module: create the folder and add one entry here.
 * Each module's CSS is scoped to `.mod-<id>`, so modules cannot restyle each other.
 */
export const MODULES = [
  {
    id: 'pathfinding',
    title: 'Pathfinding Visualizer',
    short: 'Pathfinding',
    icon: '⬡',
    blurb:
      'Dijkstra, BFS, DFS and A* (Manhattan heuristic) on an interactive grid. Draw walls, drag the start and end nodes, generate a maze with recursive division, change the speed, and read live stats.',
    tags: ['Graphs', 'Shortest path', 'Heap'],
    Component: lazy(() => import('./pathfinding')),
  },
  {
    id: 'pattern-matching',
    title: 'Text Pattern Matching',
    short: 'Pattern matching',
    icon: '⌕',
    blurb:
      'KMP, Rabin-Karp and the Z-algorithm run side by side. Compare matches and comparisons, step through every comparison, and see the failure function and Z-array.',
    tags: ['Strings', 'KMP', 'Hashing'],
    Component: lazy(() => import('./pattern-matching')),
  },
  {
    id: 'expression-evaluator',
    title: 'Expression Evaluator',
    short: 'Expression evaluator',
    icon: '⇌',
    blurb:
      'Shunting-Yard infix-to-postfix conversion and stack-based evaluation, with step-by-step animation of the operator stack, output queue and evaluation stack.',
    tags: ['Stacks', 'Parsing', 'Postfix'],
    Component: lazy(() => import('./expression-evaluator')),
  },
  {
    id: 'job-scheduler',
    title: 'Job Scheduler',
    short: 'Job scheduler',
    icon: '⚙',
    blurb:
      'A CPU scheduling simulator for FCFS, SJF, Priority, EDF and Round Robin, with a Gantt chart, a heap tree view and waiting, turnaround and response statistics.',
    tags: ['Scheduling', 'Heap', 'OS'],
    Component: lazy(() => import('./job-scheduler')),
  },
];
