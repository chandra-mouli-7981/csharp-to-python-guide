> **Now a module of the shared `dsa-visualizers` app.** This folder is `src/modules/pathfinding`; there is no separate `package.json` or `npm start` here any more.
> From `dsa-visualizers/` run `npm install` then `npm start` and open `http://localhost:3000/#/pathfinding` (or `npm run build` for the static site in `dist/`). The run instructions further down describe the old stand-alone project.
>

# ⬡ Pathfinding Visualizer

An interactive web application that visualizes four classic shortest-path algorithms in real time. Built with React.js — designed to be explored, not just read about.

**[Live Demo](https://your-demo-link.vercel.app)** · **[Portfolio](https://yourportfolio.com)**

![Pathfinding Visualizer Screenshot](./screenshot.png)

---

## ✨ Features

- **4 Algorithms** — Dijkstra, BFS, DFS, A* (with Manhattan heuristic)
- **Interactive Grid** — Click & drag to draw walls; drag start/end nodes anywhere
- **Maze Generation** — Recursive Division algorithm for instant mazes
- **Speed Control** — Slow / Medium / Fast / Instant visualization modes
- **Live Stats Panel** — Path length, nodes visited, and time elapsed
- **Algorithm Info Bar** — Complexity, guarantee status, and description per algorithm

---

## 🧠 Algorithms

| Algorithm     | Weighted | Shortest Path | Time Complexity   |
|---------------|----------|---------------|-------------------|
| Dijkstra's    | ✓        | ✓ Guaranteed  | O((V + E) log V)  |
| BFS           | ✗        | ✓ Guaranteed  | O(V + E)          |
| DFS           | ✗        | ✗ No Guarantee| O(V + E)          |
| A*            | ✓        | ✓ Guaranteed  | O(E log V)        |

---

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production
npm run build
```

---

## 🏗️ Project Structure

```
src/
├── algorithms/         # Pure algorithm implementations
│   ├── dijkstra.js
│   ├── bfs.js
│   ├── dfs.js
│   └── astar.js
├── components/
│   ├── Navbar/         # Controls, algorithm picker, speed
│   ├── Grid/           # Main visualization grid
│   ├── Node/           # Individual grid cell
│   ├── Legend/         # Color key + hints
│   ├── StatsPanel/     # Post-run statistics
│   └── AlgoInfo/       # Per-algorithm info bar
├── hooks/
│   ├── useGrid.js      # Grid state, wall drawing, node dragging
│   └── useVisualization.js  # Animation engine, timing
└── utils/
    ├── gridUtils.js    # Node creation, maze generation
    └── constants.js    # Algorithms metadata, speed configs
```

---

## 🎨 Tech Stack

- **React 18** with functional components and custom hooks
- **Vanilla CSS** with CSS custom properties — no UI library
- **CSS animations** for visited/path node transitions
- Zero runtime dependencies beyond React

---

## 📖 How It Works

Each algorithm returns two arrays — `visited[]` (exploration order) and `path[]` (traced back via `previousNode` pointers). The visualization engine then replays these arrays with configurable delays using `setTimeout`, batching React state updates per node for smooth animation.

The **maze generator** uses Recursive Division — it builds walls by bisecting the grid alternately horizontally and vertically, leaving a random passage in each wall.
