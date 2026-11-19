> **Now a module of the shared `dsa-visualizers` app.** This folder is `src/modules/expression-evaluator`; there is no separate `package.json` or `npm start` here any more.
> From `dsa-visualizers/` run `npm install` then `npm start` and open `http://localhost:3000/#/expression-evaluator` (or `npm run build` for the static site in `dist/`). The run instructions further down describe the old stand-alone project.
>

# ⇌ Expression Evaluator

An interactive visualizer for **infix-to-postfix conversion** (Shunting-Yard algorithm) and **stack-based evaluation**. Step through every token, watch the operator stack and output queue update in real time, then see the evaluation stack resolve to the final result.

**[Live Demo](https://your-demo-link.vercel.app)** · **[Portfolio](https://yourportfolio.com)**

---

## ✨ Features

- **Full Shunting-Yard implementation** — operators, parentheses, functions (`sin`, `cos`, `sqrt`, `log`), unary minus, right-associative `^`
- **Step-by-step animation** — forward/back/play controls with 700ms auto-play
- **Dual stack visualizer** — operator stack and output queue side-by-side
- **Evaluation stack panel** — watch numbers pop/push during RPN evaluation
- **Token strip** — see infix tokens → postfix tokens at a glance
- **Built-in examples** — one click to load any expression

---

## 🧠 Algorithms

### Shunting-Yard (Dijkstra, 1961)
Converts infix `3 + 4 * 2` → postfix `3 4 2 * +` using precedence rules and a stack.
- Time: **O(n)** · Space: **O(n)**

### Postfix Evaluation
Evaluates RPN using a single stack: numbers push, operators pop two and push result.
- Time: **O(n)** · Space: **O(n)**

---

## 🚀 Getting Started

```bash
cd expression-evaluator
npm install
npm start           # → http://localhost:3000
```

---

## 🏗️ Project Structure

```
src/
├── algorithms/
│   ├── shuntingYard.js   # Tokenizer + Shunting-Yard with step recording
│   └── evaluator.js      # Postfix evaluator with step recording
├── components/
│   ├── ExprInput/        # Expression input bar + example chips
│   ├── StackVisualizer/  # Operator stack + output queue display
│   ├── EvalVisualizer/   # Evaluation stack display
│   └── StepControls/     # Back/Forward/Play/Reset + progress bar
├── hooks/
│   └── useEvaluator.js   # Step state machine + play/pause timer
└── App.jsx
```

---

## 🎨 Tech Stack
- **React 18** · functional components · custom hooks
- **Vanilla CSS** — no UI library · dark theme
