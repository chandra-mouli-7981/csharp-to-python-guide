# Level 5 · Reference

## 5.1 Legacy to modern cheat sheet

Real codebases mix both styles. Be able to read the left column and write the right column.

| Topic | Legacy (still common) | Modern (React 19.x) |
|---|---|---|
| Components | Class components with `this.state` | Function components and hooks |
| Sharing logic | HOCs (`withRouter`, `connect`) and render props | Custom hooks |
| Entry point | `ReactDOM.render(<App />, el)` | `createRoot(el).render(<App />)`, `hydrateRoot` for SSR |
| Refs to children | `React.forwardRef((props, ref) => ...)` | `ref` as a normal prop |
| Context | `<Ctx.Provider value={v}>` | `<Ctx value={v}>` |
| Reading context | `useContext(Ctx)` | `useContext(Ctx)` or `use(Ctx)` (can be conditional) |
| Default props | `Component.defaultProps` | Default values in the destructured parameters |
| Prop types | `propTypes` | TypeScript |
| Form state | Controlled inputs for everything | Controlled when needed, `<form action>` + `useActionState` + `useFormStatus` |
| Pending flags | `const [loading, setLoading] = useState(false)` in every handler | `useTransition` / `isPending` from Actions |
| Optimistic UI | Manual rollback in `catch` | `useOptimistic` (or TanStack Query `onMutate`) |
| Reading a promise | `useEffect` + `useState` | `use(promise)` + `Suspense` (or a query library) |
| Latest callback in an effect | `useRef` updated each render | `useEffectEvent` |
| Hiding UI but keeping state | CSS `display: none` | `<Activity mode="hidden">` |
| Memoisation | `React.memo`, `useMemo`, `useCallback` everywhere | The **React Compiler**, with manual memo only where profiling says so |
| Data fetching | `componentDidMount` + `fetch`, or `useEffect` | TanStack Query / framework loaders / Server Components |
| Global state | Redux with hand-written actions and reducers | Redux Toolkit, Zustand, or just server state + local state |
| Document title/meta | `react-helmet` | `<title>` and `<meta>` in components (19) |
| Project setup | Create React App (deprecated) | Vite, Next.js, React Router framework mode |
| Tests | Enzyme, `react-test-renderer` | React Testing Library + Vitest/Jest + MSW |
| Routing | React Router v5 (`<Switch>`, `component=`) | React Router with the data router (`createBrowserRouter`, loaders) |
| Error reporting | `componentDidCatch` only | Class error boundaries plus `onCaughtError`/`onUncaughtError` on the root |

> **How to say it in an interview:** "I'm comfortable with both. In a new project I'd use the modern column. In an existing one I'd migrate feature by feature and let StrictMode and the lint rules point out unsafe patterns."

## 5.2 Version timeline

| Version | Date | Highlights |
|---|---|---|
| **16.8** | Feb 2019 | **Hooks** |
| **17** | Oct 2020 | "No new features". Event delegation moved to the root, new JSX transform |
| **18** | Mar 2022 | `createRoot`, **automatic batching**, **transitions** (`useTransition`, `useDeferredValue`), streaming SSR with Suspense, `useId`, `useSyncExternalStore` |
| **19.0** | Dec 2024 | **Actions**, `useActionState`, `useFormStatus`, `useOptimistic`, **`use`**, `ref` as a prop, `<Context value>`, document metadata, resource preloading, Server Components and Server Actions stable |
| **19.1** | 2025 | Minor release: Suspense and debugging improvements |
| **React Compiler 1.0** | Oct 2025 | Automatic memoisation, build-time |
| **19.2** | Oct 2025 | **`<Activity>`**, **`useEffectEvent`**, `cacheSignal`, partial prerendering, batched Suspense reveals, Performance Tracks |
| **19.3** | Sep 2026 | **`<ViewTransition>`** and `addTransitionType`, **Fragment refs**, Trusted Types support, `use(browser())`, Context in Server Components, transitions render independently |

Always check react.dev/versions and the blog before quoting details for a release you aren't sure about.

## 5.3 Warnings and errors you should recognise

| Message | Meaning | Typical cause |
|---|---|---|
| *Each child in a list should have a unique "key" prop* | Missing `key` | `map` without a key, or a key on the wrong element |
| *Rendered more hooks than during the previous render* | Hook order changed | A hook inside a condition, loop or after an early return |
| *Too many re-renders* | An update loop during render | `setState` called while rendering, or `onClick={fn()}` |
| *Maximum update depth exceeded* | A loop of updates, often in an effect | An effect that sets state it also depends on |
| *Cannot update a component while rendering a different component* | Side effect during render | A `setState` of the parent inside a child's render |
| *Can't perform a React state update on an unmounted component* | Old warning (removed in 18) | Fixed by cleanup, no longer reported |
| *Text content did not match* / *Hydration failed* | SSR mismatch | `Date.now()`, `Math.random()`, `window`/`localStorage` in the first render |
| *A component is changing an uncontrolled input to be controlled* | `value` went from `undefined` to a string | Initial state `undefined` instead of `''` |
| *You provided a `value` prop to a form field without an `onChange` handler* | The input is read-only | Missing `onChange`, or use `defaultValue` |
| *An effect function must not return anything besides a function* | An `async` effect callback | `useEffect(async () => ...)` |
| *Objects are not valid as a React child* | Rendering a plain object | `{user}` instead of `{user.name}` |
| *not wrapped in act(...)* | A test asserted before an update settled | Missing `await`, `findBy`, or `waitFor` |
| *Invalid hook call* | A hook was called outside a component, or two copies of React are loaded | Calling a hook in a normal function, a mismatched `react`/`react-dom`, a linked package |

## 5.4 Gotchas that interviewers love

1. **State is a snapshot.** `setCount(count + 1)` three times adds 1. Use the functional form for 3.
2. **Mutation doesn't re-render.** New references for objects and arrays.
3. **`{n && <X />}` renders `0`** when `n` is `0`.
4. **Keys:** stable ids, never the index for changing lists and never `Math.random()`.
5. **A new `key` resets state.** The right tool for "reset when this prop changes".
6. **Don't define components inside components.** They remount on every render.
7. **`useState(prop)` only reads the prop once.**
8. **Effects synchronise with external systems.** They are not for derived state or event responses (2.4).
9. **Dependencies describe what the effect reads.** Don't lie to the linter. Use a functional update, move the value, or `useEffectEvent`.
10. **Objects, arrays and functions in dependency arrays** are new each render. Depend on primitives.
11. **Every effect that subscribes, sets a timer, or fetches needs cleanup** (StrictMode will show you).
12. **Race conditions in fetch effects.** Abort or ignore stale responses, or use a query library.
13. **`useCallback` alone does nothing.** It only matters with `memo` or an effect dependency.
14. **A context change re-renders every consumer**, even `memo`'d ones. A fresh object as the value makes it worse.
15. **Error boundaries don't catch** event handlers, async code or server rendering errors.
16. **`useFormStatus` must be inside the `<form>`**, so it lives in a child component.
17. **State updates after `await` in an async transition** need `startTransition` again, or `useOptimistic` briefly shows duplicates.
18. **Uncontrolled inputs are reset after a form Action succeeds.** Keep `defaultValue` from state if you need the text.
19. **`use(promise)` needs a stable promise**, not one created during render.
20. **Hydration mismatches:** the first client render must equal the server HTML.
21. **Server Actions are public endpoints.** Validate and authorise inside them.
22. **Anything in the client bundle is public**: no secrets in `VITE_*` or `NEXT_PUBLIC_*` variables.
23. **A custom hook shares logic, not state.**
24. **Test behaviour, not implementation**, and query by role.
25. **StrictMode double-invokes** renders and effects in development only. If something breaks, the code was impure, so fix the code, not StrictMode.

## 5.5 Answering strategy

**For "explain X" questions** use this shape: **what it is** (one sentence), **why it exists** (the problem it solves), **a small example**, **a trade-off or gotcha**. Stop there, and let them ask a follow-up.

**For "what's the difference between A and B"**: one sentence each, then *when you'd pick each*. The "when" is the part that's graded.

**For "how would you build X"**: requirements → component breakdown → where the state lives (and what is derived) → data flow → edge cases (loading, empty, error, accessibility) → performance → testing.

**For "this code has a bug"**: read it out loud, say what it's supposed to do, find the line where reality differs (usually state, keys, an effect or a closure), name the rule, then fix it minimally.

**When you don't know**: say "I haven't used that in production, but my understanding is… and I'd confirm it in the docs". Honest, and still shows reasoning.

**Always have 3 stories ready** from your own work: a performance problem you fixed (with how you measured it), a bug that took time to find, and something you built that others used or maintained.

**Questions to ask them**: which React version and framework, how they handle server state and global state, how they test, whether they use TypeScript and the Compiler, how releases and upgrades work.

## 5.6 The day-before checklist

**Foundations**
- [ ] I can explain what JSX compiles to, and why `{0 && ...}` is a bug
- [ ] I can explain why state is a snapshot, and when to use the functional updater
- [ ] I can explain keys, and the index-key bug
- [ ] I can explain what triggers a re-render, and what doesn't
- [ ] I can explain controlled vs uncontrolled inputs
- [ ] I can explain reconciliation and how a `key` resets state

**Core**
- [ ] I can explain `useEffect` (dependencies, cleanup, StrictMode, stale closures, races)
- [ ] I can explain when **not** to use an effect and give three alternatives
- [ ] I can explain `useRef`, `useMemo`, `useCallback`, `memo`, and what the Compiler changes
- [ ] I can explain context and why it can cause re-renders
- [ ] I can write a `useReducer`, and a custom hook (`useDebounce`, `useFetch`)
- [ ] I can explain `use`, Actions, `useActionState`, `useFormStatus`, `useOptimistic`
- [ ] I can explain Suspense, transitions, `useDeferredValue` and `Activity`
- [ ] I can explain what an error boundary catches and what it doesn't

**Advanced**
- [ ] I can explain server state vs client state, and how TanStack Query works
- [ ] I can choose between context, Zustand and Redux Toolkit, and say why
- [ ] I can set up routing with loaders, nested routes and protected routes
- [ ] I can test a component, a hook and a data-fetching component
- [ ] I can list five performance fixes and say how I'd find the problem first
- [ ] I can explain CSR, SSR, SSG, hydration and Server Components
- [ ] I can explain XSS protection, token storage, and why client checks aren't security
- [ ] I know what changed in React 19, 19.2 and 19.3

**Practice**
- [ ] I have written the todo list, typeahead, modal and data table from a blank file
- [ ] I can spot the bugs in the "find the bug" list within 30 seconds each
- [ ] I have two or three stories from my own work ready

**On the day**
- [ ] Ask clarifying questions before coding
- [ ] Think out loud
- [ ] Get a working version first, then improve it
- [ ] Mention testing, accessibility, and error states even if you don't have time to build them
