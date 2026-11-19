> **Now a module of the shared `dsa-visualizers` app.** This folder is `src/modules/pattern-matching`; there is no separate `package.json` or `npm start` here any more.
> From `dsa-visualizers/` run `npm install` then `npm start` and open `http://localhost:3000/#/pattern-matching` (or `npm run build` for the static site in `dist/`). The run instructions further down describe the old stand-alone project.
>

# ⌕ Text Pattern Matching Engine

An interactive visualizer for **3 classic string searching algorithms** — KMP, Rabin-Karp, and Z-Algorithm. Run all three simultaneously, compare their stats, step through every comparison, and see the failure function, rolling hash, and Z-array computed in real time.

**[Live Demo](https://your-demo-link.vercel.app)** · **[Portfolio](https://yourportfolio.com)**

---

## ✨ Features

- **3 algorithms run simultaneously** — KMP, Rabin-Karp, Z-Algorithm
- **Side-by-side comparison table** — matches, comparisons, complexity, notes per algorithm
- **Text display with match highlighting** — all occurrences highlighted in algorithm color
- **Step-by-step trace** — navigate every comparison with forward/back controls
- **Failure function display** (KMP) — visualize the preprocessing array
- **Z-array display** (Z-Algorithm) — see the prefix lengths computed
- **Hash collision counter** (Rabin-Karp) — see how many false positives occurred
- **Built-in examples** — classic test cases loaded with one click

---

## 🧠 Algorithms

| Algorithm    | Time (avg) | Space | Key Idea                          |
|--------------|------------|-------|-----------------------------------|
| KMP          | O(n + m)   | O(m)  | Failure function avoids re-comparison |
| Rabin-Karp   | O(n + m)   | O(1)  | Rolling polynomial hash           |
| Z-Algorithm  | O(n + m)   | O(n)  | Z-array: longest prefix match at each position |

n = text length · m = pattern length

---

## 🚀 Getting Started

```bash
cd pattern-matching
npm install
npm start       # → http://localhost:3000
```

---

## 🏗️ Project Structure

```
src/
├── algorithms/
│   ├── kmp.js          # Failure function + KMP search with step recording
│   ├── rabinKarp.js    # Rolling hash + verification with step recording
│   └── zAlgorithm.js  # Z-array construction + search with step recording
├── components/
│   ├── SearchInput/    # Text + pattern inputs, example chips
│   ├── TextDisplay/    # Highlighted text with match + window indicators
│   ├── AlgoCard/       # Per-algorithm stats, failure fn, Z-array display
│   └── StepVisualizer/ # Step trace with progress bar + timeline
├── hooks/
│   └── usePatternMatch.js  # Runs all 3 algorithms, manages step state
└── App.jsx
```

---

## 🎨 Tech Stack
- **React 18** · functional components · custom hooks
- **Vanilla CSS** — no UI library · dark theme
