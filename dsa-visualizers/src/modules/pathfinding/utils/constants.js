export const ALGORITHMS = {
  DIJKSTRA: 'dijkstra',
  BFS: 'bfs',
  DFS: 'dfs',
  ASTAR: 'astar',
};

export const ALGORITHM_INFO = {
  [ALGORITHMS.DIJKSTRA]: {
    label: "Dijkstra's",
    weighted: true,
    guaranteed: true,
    description: "Explores all nodes by distance. Guarantees shortest path on weighted graphs.",
    complexity: { time: 'O((V + E) log V)', space: 'O(V)' },
  },
  [ALGORITHMS.BFS]: {
    label: 'BFS',
    weighted: false,
    guaranteed: true,
    description: 'Explores layer by layer. Guarantees shortest path on unweighted graphs.',
    complexity: { time: 'O(V + E)', space: 'O(V)' },
  },
  [ALGORITHMS.DFS]: {
    label: 'DFS',
    weighted: false,
    guaranteed: false,
    description: 'Dives deep before backtracking. Fast but does not guarantee shortest path.',
    complexity: { time: 'O(V + E)', space: 'O(V)' },
  },
  [ALGORITHMS.ASTAR]: {
    label: 'A*',
    weighted: true,
    guaranteed: true,
    description: 'Uses Manhattan heuristic to explore smarter. Fastest guaranteed shortest path.',
    complexity: { time: 'O(E log V)', space: 'O(V)' },
  },
};

export const SPEEDS = {
  SLOW: { label: 'Slow', visitDelay: 40, pathDelay: 80 },
  MEDIUM: { label: 'Medium', visitDelay: 15, pathDelay: 40 },
  FAST: { label: 'Fast', visitDelay: 5, pathDelay: 20 },
  INSTANT: { label: 'Instant', visitDelay: 0, pathDelay: 0 },
};
