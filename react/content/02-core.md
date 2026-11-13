# Level 2 · Core

## 2.1 `useEffect`: synchronising with the outside world

An effect **runs code after React has updated the DOM, to keep your component in sync with something outside React**: a network request, a subscription, a timer, a browser API, a third-party widget.

```tsx
useEffect(() => {
  const connection = createConnection(roomId);   // setup
  connection.connect();
  return () => connection.disconnect();          // cleanup
}, [roomId]);                                    // dependencies
```

**When does it run?**

| Dependency array | Runs |
|---|---|
| none: `useEffect(fn)` | After **every** render |
| `[]` | After the first render (setup), and cleanup on unmount |
| `[a, b]` | After the first render, and after any render where `a` or `b` changed (by `Object.is`) |

Order for a change: **cleanup of the previous effect runs first**, then the new setup. We checked: with `[id]` changing 1 → 2 and then unmounting, the sequence is `setup(1), cleanup(1), setup(2), cleanup(2)`.

**StrictMode (development only)** runs setup, **cleanup**, setup again on mount, so you notice a missing or broken cleanup straight away. If your effect "runs twice" in dev, the fix is a correct cleanup, not removing StrictMode.

```tsx
useEffect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);        // ✅ without this, StrictMode gives you two intervals
}, []);
```

### The dependency array is not a performance knob

Dependencies **describe what the effect reads**. List every reactive value (props, state, anything derived from them) used inside. Leaving one out gives a **stale closure**: the effect keeps using the value from the render it was created in.

```tsx
// ❌ stale closure: n is 0 forever inside this effect, so the counter gets stuck at 1
useEffect(() => {
  const id = setInterval(() => setN(n + 1), 100);
  return () => clearInterval(id);
}, []);

// ✅ functional update: no dependency on n
useEffect(() => {
  const id = setInterval(() => setN((c) => c + 1), 100);
  return () => clearInterval(id);
}, []);
```

(Running the first version for 500 ms leaves the counter at 1. The second reaches 5.)

Other ways to fix a dependency you don't want: **move the value or function inside the effect**, **move it outside the component** if it doesn't depend on props/state, or use **`useEffectEvent`** (2.3). Never silence the lint rule `react-hooks/exhaustive-deps` to "fix" it.

**Objects, arrays and functions created in the component body are new on every render**, so putting them in the dependency array re-runs the effect every time. Depend on the primitive values you need instead (reproduced in 4.4).

### Fetching in an effect: the race condition

```tsx
useEffect(() => {
  let ignore = false;
  fetchUser(id).then((u) => { if (!ignore) setUser(u); });
  return () => { ignore = true; };           // ignore the response of a stale request
}, [id]);
```

Without the `ignore` flag, if `id` changes from `a` to `b` quickly and the response for `a` arrives **last**, the screen shows `a`'s data for `b`. Better, also **cancel** the request with an `AbortController` (`fetch(url, { signal })` and `return () => ctrl.abort()`), and ignore the resulting `AbortError`.

Handwriting this for every request is error-prone. Real apps use **TanStack Query** or a framework's data loading (3.1), or the `use` hook with Suspense (2.8).

### `useLayoutEffect`

Runs **synchronously after DOM updates but before the browser paints**. Use it only to *measure* the DOM and adjust something before the user sees it (tooltip position, for example), to avoid a flicker. It blocks painting, and it doesn't run on the server. Start with `useEffect`.

## 2.2 `useRef`: a value that doesn't cause renders

A ref is **a box with a `.current` property that React keeps across renders**. Changing it **does not** trigger a re-render.

```tsx
const inputRef = useRef<HTMLInputElement>(null);
<input ref={inputRef} />
<button onClick={() => inputRef.current?.focus()}>Focus</button>
```

Two uses:

1. **Reaching a DOM node** (focus, scroll, measure, play a video, integrate a non-React library).
2. **Keeping a mutable value that isn't part of what's on screen**: a timer id, a previous value, the "is a request in flight" flag, an `AbortController`.

**Don't read or write `ref.current` during render** (other than the initial setup), because it makes rendering impure. Do it in event handlers and effects. Anything the UI should react to belongs in **state**, not a ref.

- **Ref callbacks** (`ref={(el) => ...}`) receive the node on mount and `null` on unmount. In React 19 the callback **can return a cleanup function** instead.
- **`useImperativeHandle(ref, () => ({ focus() {...} }))`** exposes a *limited API* to the parent instead of the whole DOM node. It is an escape hatch. Prefer props and state.
- In React 19, `ref` is a **normal prop** for function components, so there is no need for `forwardRef`.
- **Fragment refs (19.3):** `<Fragment ref={ref}>` gives a handle to a *group* of nodes. We checked the instance exposes `addEventListener`, `removeEventListener`, `dispatchEvent`, `focus`, `focusLast`, `blur`, `observeUsing`/`unobserveUsing` (for `IntersectionObserver` and similar), `getClientRects`, `getRootNode`, `compareDocumentPosition` and `scrollIntoView`.

## 2.3 `useEffectEvent`: read the latest values without re-running the effect

Problem: an effect should re-run when `roomId` changes, but **not** when `theme` changes, even though it uses both. Leaving `theme` out of the dependencies is a lint error and a stale-closure bug.

```tsx
function Chat({ roomId, theme }: { roomId: string; theme: string }) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme);          // always sees the latest theme
  });

  useEffect(() => {
    const conn = createConnection(roomId);
    conn.on('connected', () => onConnected());
    conn.connect();
    return () => conn.disconnect();
  }, [roomId]);                                     // theme is NOT a dependency, and that's correct
}
```

`useEffectEvent` (stable since **19.2**) wraps logic that is "an *event* that happens inside an effect", so it reads the latest props and state without being reactive. We checked that changing only `theme` does not restart the effect, and the callback still sees the new theme.

**Rules:** only call it **from inside effects** (or from callbacks created in them). Don't pass it to child components or hooks, and don't put it in the dependency array. Before 19.2, people kept "the latest callback" in a ref updated on each render. It is the same idea, now built in.

Common uses: the latest `onChange`/`onClose` prop passed to a document listener, logging, notifications, analytics.

## 2.4 You might not need an effect

Effects are for **synchronising with external systems**. Most "I need an effect" situations aren't. Each unnecessary effect adds an extra render and more bugs.

| Situation | Instead of an effect |
|---|---|
| Derive data from props/state | Compute it **during render** (`const total = items.reduce(...)`) |
| Expensive derivation | `useMemo` (or just compute it; measure first) |
| Reset state when a prop changes | Give the component a **`key`** |
| Adjust *some* state when a prop changes | Compute during render, or store an id and derive the rest |
| Respond to a user action (submit, click) | Do it **in the event handler** |
| Notify the parent about a change | Call the parent's callback **in the same event handler** that changes the state |
| A chain of effects that each set state for the next | Compute everything in one event handler |
| Share state between components | **Lift state up** |
| Subscribe to an external store | `useSyncExternalStore` (or the library's hook) |
| Fetch data | A data library (TanStack Query), the framework's loader, or `use` + Suspense |
| Initialise something once on app start | Module-level code, or guard with a module variable |

```tsx
// ❌ derived state in an effect: renders once with total = 0, then again with the real value
const [total, setTotal] = useState(0);
useEffect(() => { setTotal(items.reduce((a, b) => a + b, 0)); }, [items]);

// ✅ just calculate it
const total = items.reduce((a, b) => a + b, 0);
```

(We counted renders: the effect version renders twice for the first paint, the plain version once.)

```tsx
// ❌ reset in an effect: the child renders with stale state first
useEffect(() => { setDraft(''); }, [userId]);
// ✅
<Editor key={userId} />
```

Good reasons to use an effect: opening a connection, adding a `window` or `document` listener, starting a timer, controlling a non-React widget, sending an analytics event *because the component appeared*, a fetch if you don't have a data library.

## 2.5 Custom hooks and the rules of hooks

A **custom hook** is a function whose name starts with `use` and that calls other hooks. It **shares logic, not state**: each component calling `useCounter()` gets its **own** independent state.

```tsx
function useDebounce<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch { return initial; }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function useFetch<T>(url: string) {
  const [state, setState] = useState<{ data?: T; error?: Error; loading: boolean }>({ loading: true });
  useEffect(() => {
    const ctrl = new AbortController();
    setState({ loading: true });
    fetch(url, { signal: ctrl.signal })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<T>; })
      .then((data) => setState({ data, loading: false }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ error, loading: false }); });
    return () => ctrl.abort();
  }, [url]);
  return state;
}
```

All three were run in tests (the debounce settles after the delay, localStorage round-trips, and `useFetch` aborts the previous request when `url` changes and doesn't treat the abort as an error).

**Good custom hooks**: have a clear single purpose, return what callers need (a value, a tuple or an object), accept parameters rather than reading globals, and clean up after themselves. **Don't** create hooks like `useMount(fn)` that hide what an effect depends on.

**SSR note:** `useLocalStorage` reads `localStorage` in the initial state. On the server there is none, and on the client the first render can differ from the server's, giving a **hydration mismatch**. For SSR apps, read storage in an effect (after hydration), or use `useSyncExternalStore`.

### Rules of hooks

1. **Only call hooks at the top level** of a component or custom hook: not inside conditions, loops, nested functions, `try/catch`, or after an early `return`.
2. **Only call hooks from React functions** (components and custom hooks).

**Why?** React keeps each component's hook state in an **ordered list** and matches calls by **position**. If the order changes between renders, state attaches to the wrong hook. We checked: calling a hook conditionally and flipping the condition throws *"Rendered more hooks than during the previous render"*.

The `eslint-plugin-react-hooks` package enforces these rules and the exhaustive-deps check. Treat its warnings as errors. (Exception: **`use`** is the one hook-like API that *can* be called conditionally and after an early return. We checked both.)

## 2.6 Context and `useReducer`

### Context

Context lets a component read a value from an ancestor **without passing props through every level**.

```tsx
const ThemeContext = createContext<'light' | 'dark'>('light');

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  return (
    <ThemeContext value={theme}>          {/* React 19: no .Provider needed */}
      <Page />
    </ThemeContext>
  );
}

function Button() {
  const theme = useContext(ThemeContext);   // or use(ThemeContext)
  return <button className={theme}>OK</button>;
}
```

**Performance trap:** when the value changes, **every component that reads the context re-renders**, and `memo` does not stop it (we checked). Also, `value={{ user, setUser }}` creates a **new object every render**, so every consumer re-renders whenever the provider's parent does (we measured 2 renders for the inline object, 1 for a memoised one).

Mitigations:

- Memoise the value (`useMemo`) if the provider re-renders often (or rely on the Compiler).
- **Split contexts** by how often they change (`UserContext`, `ThemeContext`), or split *state* and *dispatch* into two contexts.
- Put fast-changing state in a **store** (Zustand, Redux) with selectors, instead of context.

Context is for **dependency injection and low-frequency global values**, not a replacement for a state library for everything.

### `useReducer`

For state with **several related fields or many kinds of updates**, put the transitions in a pure function:

```tsx
type Action = { type: 'added'; title: string } | { type: 'toggled'; id: number } | { type: 'removed'; id: number };

function reducer(state: Todo[], action: Action): Todo[] {
  switch (action.type) {
    case 'added':   return [...state, { id: Date.now(), title: action.title, done: false }];
    case 'toggled': return state.map((t) => (t.id === action.id ? { ...t, done: !t.done } : t));
    case 'removed': return state.filter((t) => t.id !== action.id);
  }
}

const [todos, dispatch] = useReducer(reducer, []);
dispatch({ type: 'toggled', id: 3 });
```

| `useState` | `useReducer` |
|---|---|
| One value, or independent values | Related fields that change together |
| Simple updates | Many update types, or logic worth testing on its own |
| | The reducer can be tested without React, and `dispatch` has a **stable identity** (good for context and `memo`) |

Context + `useReducer` is the "built-in Redux" pattern. Reducers **must be pure**: no mutation, no random values, no side effects (StrictMode runs them twice to check).

## 2.7 Memoisation: `memo`, `useMemo`, `useCallback`, and the Compiler

```tsx
const Row = memo(function Row({ item, onSelect }: Props) { ... });   // skip re-render if props are shallow-equal
const sorted = useMemo(() => [...items].sort(compare), [items]);       // cache a calculation
const onSelect = useCallback((id: string) => select(id), []);          // cache a function's identity
```

- **`memo(Component)`**: skips re-rendering when the props are **shallow-equal** to last time.
- **`useMemo(fn, deps)`**: caches the *result* of an expensive calculation between renders.
- **`useCallback(fn, deps)`**: caches the *function*. It is `useMemo(() => fn, deps)`.

**A `useCallback` is useless on its own.** It only helps when the function goes to a `memo`'d child or is an effect dependency. We checked: a `memo`'d child given a `useCallback` function rendered once across two parent renders, while an identical child given an inline `() => {}` rendered every time.

**Don't memoise everything.** Memoisation has a cost (comparing dependencies, memory) and noise. Memoise when profiling shows slow renders: an expensive calculation, a big list of `memo` rows, a stable value needed as an effect dependency. Measure first, with the React DevTools Profiler.

**Cheap fixes before memoisation:**

1. **Move state down** into the smaller component that needs it, so the rest of the tree doesn't re-render.
2. **Lift content up** and pass it as `children`: a parent that re-renders because of its own state doesn't re-render elements it received as `children`.
3. Keep **lists small** or virtualise them (3.5).

### The React Compiler

**React Compiler 1.0 (October 2025)** is a build-time plugin (`babel-plugin-react-compiler`, with a Vite/Next/Babel integration) that **automatically memoises** components and hooks. It analyses your code and inserts the caching for you, so you rarely need to write `useMemo`, `useCallback` or `memo`. We compiled a small component with the 1.0 plugin and the output caches `sorted` and the per-item handler, with a slot cache (`_c(7)`) guarded by checks against the previous inputs.

What to know:

- It works only for code that **follows the rules of React** (pure render, no mutating props/state). Code that doesn't gets skipped, not broken. The lint rules in recent `eslint-plugin-react-hooks` versions flag problems it finds.
- You can **opt a component out** with the `'use no memo'` directive.
- **`useMemo`/`useCallback` still matter** for values used as effect dependencies in edge cases, for code the compiler can't process, and in older codebases without it. Know both.
- An interviewer asking "how do you prevent re-renders?" wants: **measure → structure (state down, children up) → memo/Compiler**.

## 2.8 React 19: `use`, Actions and forms

### `use`

`use(resource)` reads a **Promise** or a **Context**. With a promise it **suspends** the component (shows the nearest `<Suspense>` fallback) until it resolves, and **throws** to the nearest error boundary if it rejects.

```tsx
function Comments({ commentsPromise }: { commentsPromise: Promise<Comment[]> }) {
  const comments = use(commentsPromise);              // suspends until resolved
  return <ul>{comments.map((c) => <li key={c.id}>{c.text}</li>)}</ul>;
}

<Suspense fallback={<Spinner />}><Comments commentsPromise={promise} /></Suspense>
```

- Unlike other hooks, **`use` can be called conditionally** and after an early return (we checked with context).
- The promise must be **stable across renders**: created by a parent, a Server Component, or a cache. A promise created **inside** a client component's render is a new one each time, so it suspends forever. Libraries (TanStack Query's `useSuspenseQuery`) and frameworks handle this.
- Don't call it inside `try/catch`. Use an error boundary.

### Actions and forms

An **Action** is an **async function used in a transition**. React tracks its pending state, handles errors, and gives you optimistic updates.

```tsx
// 1. A form action: React passes FormData, and resets uncontrolled inputs after success
<form action={async (formData: FormData) => { await save(formData.get('name') as string); }}>
  <input name="name" />
  <button>Save</button>
</form>
```

**`useActionState`** adds state and a pending flag to an action:

```tsx
function Rename() {
  const [state, action, isPending] = useActionState(
    async (prev: { error?: string; name?: string }, formData: FormData) => {
      const name = String(formData.get('name'));
      if (name.length < 3) return { error: 'Too short' };
      await api.rename(name);
      return { name };
    },
    {},
  );
  return (
    <form action={action}>
      <input name="name" defaultValue={state.name} />
      <button disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</button>
      {state.error && <p role="alert">{state.error}</p>}
    </form>
  );
}
```

**`useFormStatus`** (from `react-dom`) lets a **child of a form** read its pending state without prop drilling. It must be rendered *inside* the `<form>`, so it belongs in a separate `<SubmitButton />` component:

```tsx
function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Saving' : 'Save'}</button>;
}
```

We ran this: after submitting, the message from the action state appears and the button returns to "Save".

**Uncontrolled inputs are reset after a successful action.** If that surprises you, keep `defaultValue` from the returned state (as above), or use controlled inputs.

### `useOptimistic`

Shows an **expected result immediately** while the real request is in flight, and **reverts automatically** if the action fails or when it finishes.

```tsx
const [todos, setTodos] = useState<Todo[]>(initial);
const [optimistic, toggleOptimistic] = useOptimistic(todos, (current, id: number) =>
  current.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

function toggle(id: number) {
  startTransition(async () => {
    toggleOptimistic(id);                              // shown immediately
    await save(id);
    startTransition(() => setTodos(/* the real new state */));   // ← must be wrapped again after the await
  });
}
```

> **Gotcha we reproduced:** state updates **after an `await`** inside an async transition are *not* part of the transition unless you wrap them in `startTransition` again. Without it, the real state arrives while the optimistic overlay is still applied, and the UI briefly shows the item **twice** (we saw the optimistic list length reach 2).

### Other React 19 changes worth knowing

| Change | What it means |
|---|---|
| **`ref` as a prop** | No `forwardRef` for new code. Ref callbacks can return a cleanup |
| **`<Context value>`** | `<Context.Provider>` is no longer needed |
| **Document metadata** | `<title>`, `<meta>`, `<link>` rendered in any component are hoisted into `<head>` |
| **Stylesheets and preloading** | `<link rel="stylesheet" precedence="...">`, and `preload`, `preinit`, `prefetchDNS`, `preconnect` from `react-dom` |
| **`useDeferredValue(value, initialValue)`** | An initial value for the first render |
| **Better error reporting** | `createRoot(el, { onCaughtError, onUncaughtError })`, clearer hydration mismatch diffs |
| **Removed** | `propTypes`, `defaultProps` on function components, string refs, legacy context, `ReactDOM.render`/`hydrate` (use `createRoot`/`hydrateRoot`), `findDOMNode`, `react-test-renderer` is deprecated (use React Testing Library) |
| **Renamed** | `useFormState` is now `useActionState` |

## 2.9 Suspense, transitions and `<Activity>`

### Suspense

`<Suspense fallback={...}>` shows a fallback while something **inside it** isn't ready: lazy-loaded code (`lazy`), data read with `use`, or a Suspense-enabled library. It is **declarative loading UI**: the component that needs the data doesn't manage `loading` flags.

```tsx
const Chart = lazy(() => import('./Chart'));          // code splitting

<Suspense fallback={<Skeleton />}>
  <Chart />
</Suspense>
```

Place boundaries **around meaningful sections**, not a single one at the root (the whole page would flash a spinner) and not around every tiny component. **Nesting** them lets parts of the page appear progressively. On the server, Suspense is also how **streaming SSR** sends the shell first and fills in slow parts later.

### Transitions: keeping the UI responsive

A **transition** marks an update as **non-urgent**, so React can keep showing the current UI (and keep it interactive) while the new one renders or loads.

```tsx
const [isPending, startTransition] = useTransition();

function selectTab(next: string) {
  startTransition(() => setTab(next));                // the old tab stays visible; no fallback flash
}
```

- **`isPending`** lets you show a subtle loading state (dim the content) instead of replacing it with a spinner.
- A transition **won't replace content that is already visible with a Suspense fallback**. React keeps showing the old content until the new content is ready.
- In React 19, `startTransition` accepts **async functions** (those are Actions). While it runs, `isPending` is `true`, and the old state stays visible. We checked: after starting an async transition, `isPending` is `true` and the old value is still displayed, then it flips when the work finishes.
- Use for **navigation, tab switches, filtering a big list**. Don't use it for controlled input values, which need to update immediately.

**`useDeferredValue(value)`** gives you a **lagging copy** of a value. Typing updates `query` immediately, while the expensive list renders with `deferredQuery` in the background and is interrupted if you type again:

```tsx
const [query, setQuery] = useState('');
const deferred = useDeferredValue(query);
<input value={query} onChange={(e) => setQuery(e.target.value)} />
<SlowList filter={deferred} />                        // memo it, so it only re-renders when `deferred` changes
```

`useTransition` wraps the code that sets state. `useDeferredValue` wraps the *value* when you don't control the state setter (for instance a prop). Neither replaces debouncing network requests: debounce when you want **fewer requests**, defer when you want **a responsive render**.

### `<Activity>` (19.2)

```tsx
<Activity mode={tab === 'inbox' ? 'visible' : 'hidden'}>
  <Inbox />
</Activity>
```

`<Activity mode="hidden">` hides the subtree (it gets `display: none`) but **keeps its state and DOM**, and **unmounts its effects** (cleanups run) while hidden. Hidden content still re-renders at low priority. We ran this: text typed into an input survived hide and show, and the effect log was `setup, cleanup, setup`.

Use it for **tabs, wizards, back-navigation and prerendering the next screen**, where you'd otherwise either lose state (conditional rendering) or keep expensive effects running (CSS hiding).

## 2.10 Error boundaries

An **error boundary** catches errors thrown **while rendering** (and in lifecycle methods and effects of its descendants), and shows a fallback instead of unmounting the whole app. They are still **classes** (there's no hook for it).

```tsx
class ErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { reportToMonitoring(error, info.componentStack); }
  render() { return this.state.error ? this.props.fallback : this.props.children; }
}
```

In practice, use **`react-error-boundary`** (a maintained wrapper with `resetErrorBoundary` and `resetKeys`).

**What boundaries do NOT catch:**

- Errors in **event handlers** (we checked: the boundary's fallback stays hidden and the error goes to `window.onerror`). Use `try/catch` and state.
- **Asynchronous code** (a `setTimeout`, an un-awaited promise). Catch it and set state, or `throw` from state so the *next render* throws:

```tsx
const [, setState] = useState();
fetchData().catch((e) => setState(() => { throw e; }));   // rethrow during render so the boundary sees it
```

- **Server-side rendering errors** (handled by the framework), and errors thrown *by the boundary itself*.

**Placement:** a boundary at the root as a last resort, plus **around risky or independent sections** (a widget, a route), so one failure doesn't blank the page. Pair each `Suspense` with an error boundary for async loading.

Since React 19, `createRoot` takes `onCaughtError` and `onUncaughtError` options, a single place to report errors to monitoring.

## 2.11 Data fetching, the short version

| Approach | When |
|---|---|
| `useEffect` + `fetch` | Almost never directly. Fine for a quick demo or a one-off |
| **TanStack Query** (or SWR) | The default for client-rendered apps: caching, deduping, retries, background refresh, mutations (3.1) |
| **Framework loaders** (React Router loaders, Next.js Server Components) | When you use a framework, so data loads *before* or during render |
| `use(promise)` + Suspense | When something above you creates a stable promise |
| WebSocket / SSE | Real-time data. Wrap it in a custom hook, or `useSyncExternalStore` |

The things a hand-rolled `useEffect` fetch gets wrong: **race conditions**, **no cache** (every mount refetches), **no deduplication**, **no retry**, **no stale-while-revalidate**, **loading and error flags for every call**. Name those in an interview.

## 2.12 Quick-fire Q&A (Core)

**When does `useEffect` run?** After the browser has painted, after every render by default, or only when its dependencies change. Cleanup runs before the next effect and on unmount.

**What is a stale closure?** A function that captured values from an old render and uses them later. Fix with a functional update, correct dependencies, a ref, or `useEffectEvent`.

**`useEffect` vs `useLayoutEffect`?** Layout effects run synchronously after DOM mutation but **before paint**, for measuring. Effects run **after paint**. Default to `useEffect`.

**`useMemo` vs `useCallback`?** `useMemo` caches a computed value. `useCallback` caches a function. Both rely on dependencies, and both are optimisations, not guarantees.

**When do you need `memo`?** When a component re-renders often with the same props and its render is costly. It must be paired with stable props (`useCallback`/`useMemo`, or the Compiler).

**What is the difference between `useRef` and `useState`?** Changing state re-renders. Changing a ref doesn't. Use refs for DOM nodes and values that aren't displayed.

**Why does the index-as-key bug happen?** State is attached to the component *at that position*, not to your data item, so after a removal the wrong row inherits state.

**What problem does `useReducer` solve?** Complex or related state transitions in one testable pure function, and a stable `dispatch`.

**How do you avoid prop drilling?** Composition (`children`), context, or a store.

**Why can context cause performance problems?** Every consumer re-renders when the value changes, and `memo` doesn't help. Split contexts, memoise the value, or use a store with selectors.

**What is a custom hook?** A function starting with `use` that calls other hooks to share logic. Each use has its own state.

**What does `use` do?** Reads a promise (suspending) or context. It is the only hook-like API you can call conditionally.

**What are Actions?** Async functions passed to transitions or forms. React handles pending state, errors, optimistic updates and form resets.

**What's new for forms in React 19?** `<form action={fn}>`, `useActionState`, `useFormStatus`, `useOptimistic`.

**What do transitions do?** Mark updates non-urgent so the current UI stays responsive and visible while the new one renders.

**Why can't an error boundary catch errors in event handlers?** Boundaries catch errors during rendering. Handlers run outside the render phase, so use `try/catch`.

**What is `Activity` for?** Hiding UI without losing its state, while pausing its effects.

**What does the React Compiler do?** Automatically memoises your components at build time, so manual `useMemo`/`useCallback`/`memo` are rarely needed. It requires code that follows the rules of React.
