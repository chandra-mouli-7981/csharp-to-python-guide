# React Interview Guide

Everything a mid-level React interview usually covers, in one place: the concepts, the "why" behind them, the traps interviewers like, and worked coding problems. It covers modern React (hooks, Actions, Suspense, the React Compiler, React 19.x features) and the older patterns you will still meet in real codebases (class components, `forwardRef`, `useEffect` for everything, Redux boilerplate).

## Start here

**How the guide is organised**

| Level | Covers | Why it matters |
|---|---|---|
| **1. Foundations** | JSX, components and props, state, events, lists and keys, conditional rendering, forms, how rendering and reconciliation work, composition | Every interview opens here. "Why did my component re-render?" is the most common question there is |
| **2. Core** | All the hooks, custom hooks, effects (and when *not* to use them), React 19 features (`use`, Actions, `useOptimistic`), Suspense, error boundaries, transitions, memoisation and the Compiler | The bulk of the "how would you build X" questions |
| **3. Advanced** | State management, data fetching, routing, testing, performance, SSR and Server Components, patterns, accessibility, security, TypeScript, tooling | What separates mid-level from junior |
| **4. Practice** | Coding challenges with solutions, scenario and design questions, "find the bug" snippets | Where you build speed |
| **5. Reference** | Legacy to modern cheat sheet, version timeline, gotchas, answering strategy, last-day checklist | Read the night before |

**Suggested use**

1. Read Levels 1 to 3 once. Skip anything you can already explain out loud.
2. Do Level 4 without looking at the solution. Say your reasoning out loud, because that is what is graded.
3. Re-read Level 5 and the "Quick-fire Q&A" at the end of each level the day before.

## Which React version?

Interviewers ask about whatever their codebase uses, which is often a major version or two behind. The guide teaches the current style and marks where older code looks different. It was written against **React 19.3** (September 2026). Every code sample was run in a real React 19.3 project with Vitest and React Testing Library, not just copied from docs. The libraries in the guide were checked at these versions: TanStack Query 5, React Router 8, Redux Toolkit 2, Zustand 5.

> **Tip:** if you are not sure what the company uses, ask "which React version are you on, and do you use a framework such as Next.js or plain Vite?". It is a good question, and it tells you which half of this guide matters most.

### When did each feature arrive?

This is the single most useful table in the guide. Interviewers love "what changed in recent versions?".

| Feature | Version | Notes |
|---|---|---|
| **Hooks** (`useState`, `useEffect`, ...) | 16.8 (2019) | Replaced most class components |
| **Concurrent rendering**, automatic batching, `useTransition`, `useDeferredValue`, `useId`, `useSyncExternalStore` | 18 (2022) | `createRoot` is the opt-in |
| **`use`**, **Actions**, `useActionState`, `useFormStatus`, **`useOptimistic`** | 19.0 (Dec 2024) | Form `action={fn}`, async transitions |
| **`ref` as a regular prop** (no `forwardRef`), ref callbacks can return a cleanup | 19.0 | `forwardRef` still works but is no longer needed |
| **`<Context value>`** instead of `<Context.Provider>` | 19.0 | `Provider` still works |
| **Document metadata** (`<title>`, `<meta>` in components), resource preloading APIs | 19.0 | Hoisted to `<head>` |
| **Server Components** and **Server Actions** (`'use client'`, `'use server'`) | Stable in 19.0 | Used through a framework such as Next.js |
| **React Compiler 1.0** (automatic memoisation) | Oct 2025 | A build-time plugin, not part of React itself |
| **`<Activity>`** (hide UI but keep state), **`useEffectEvent`**, `cacheSignal`, partial pre-rendering | 19.2 (Oct 2025) | `useEffectEvent` replaces the "ref to the latest callback" trick |
| **`<ViewTransition>`** and `addTransitionType`, **Fragment refs**, Trusted Types support, `use(browser())` | 19.3 (Sep 2026) | Animations on navigation, observers on a group of nodes |

Create React App is deprecated (Feb 2025). New plain-React apps start with **Vite**, or with a framework (Next.js, React Router in framework mode).

## What React actually is

React is a **library for building user interfaces from components**. You describe *what the UI should look like for a given state*, and React works out how to update the DOM.

```text
state + props  →  your component functions run  →  a tree of elements ("what the UI should be")
                                                         ↓  React compares it to the previous tree
                                                      minimal DOM updates
```

Three ideas to repeat in an interview:

1. **UI is a function of state**: `UI = f(state, props)`. You don't manipulate the DOM, you change state and React re-renders.
2. **Data flows one way**: parents pass props down, children tell parents things through callbacks (events up).
3. **Rendering is a pure calculation**: a component's body must not have side effects. Side effects go in event handlers or effects.

## Answering tips

- Say **what it is**, **why it exists**, then give a **small example**, then a **gotcha**.
- Know the *why* behind rules ("hooks can't be in conditions because React matches them by call order"), not just the rule.
- When asked "how do you optimise?", **measure first** (React DevTools Profiler), then fix the largest cost.
- Be honest about version differences: "in React 19 I'd use X, in older codebases it was Y".
