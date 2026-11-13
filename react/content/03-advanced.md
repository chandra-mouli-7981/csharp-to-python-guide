# Level 3 · Advanced

## 3.1 Server state with TanStack Query

Most "state" in a typical app is **server state**: data that lives on a server, is shared, and can go stale. It has different problems from UI state (caching, refetching, deduplication, invalidation), so treat it with a dedicated tool. **TanStack Query** (formerly React Query) is the standard answer. SWR is a lighter alternative, and RTK Query is the option if you already use Redux Toolkit.

```tsx
const { data, isPending, isError, error, isFetching, refetch } = useQuery({
  queryKey: ['user', userId],             // the cache key: any change = a different cache entry
  queryFn: () => api.getUser(userId),
  staleTime: 60_000,                      // treat the data as fresh for a minute
  enabled: !!userId,                      // don't run until we have an id
});
```

**Concepts to explain:**

| Term | Meaning |
|---|---|
| **Query key** | Identifies the data. Include everything the query depends on: `['todos', { status, page }]`. Changing a key fetches (or reads the cache for) another entry. We checked: changing the `id` in the key fetched the new one, and switching back showed the cached value immediately |
| **`staleTime`** | How long data counts as fresh (default `0`: always stale, so it refetches on mount, window focus and reconnect) |
| **`gcTime`** | How long *unused* data stays in the cache (default 5 min). Renamed from `cacheTime` in v5 |
| **`isPending` vs `isFetching`** | `isPending`: no data yet. `isFetching`: any request in flight, including background refetches. A disabled query is `isPending` but **not** fetching (we checked) |
| **Invalidation** | `queryClient.invalidateQueries({ queryKey: ['todos'] })` marks entries stale and refetches the active ones |
| **Mutations** | `useMutation` for writes (POST/PUT/DELETE), with `onSuccess` (usually invalidate) |

**v5 changes** interviewers ask about: a single **object argument** for hooks, `isLoading` became **`isPending`** (and `isLoading` now means "pending *and* fetching"), `cacheTime` became `gcTime`, **`initialPageParam` is required** for infinite queries, and `keepPreviousData` became `placeholderData: keepPreviousData` (we used both in the pagination example).

### Optimistic updates with rollback

```tsx
const queryClient = useQueryClient();
const toggle = useMutation({
  mutationFn: (id: number) => api.toggle(id),
  onMutate: async (id) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });          // stop in-flight refetches overwriting us
    const previous = queryClient.getQueryData<Todo[]>(['todos']);      // snapshot
    queryClient.setQueryData<Todo[]>(['todos'], (old) => old!.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
    return { previous };                                               // context for onError
  },
  onError: (_err, _id, ctx) => queryClient.setQueryData(['todos'], ctx!.previous),   // rollback
  onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),           // re-sync with the server
});
```

We ran this against a mutation that fails: the cache is rolled back to `done: false`.

### Infinite and paginated lists

- **Pagination:** put `page` in the key and use `placeholderData: keepPreviousData` so the old page stays on screen while the next loads (no flash, and the pager doesn't collapse).
- **Infinite scroll:** `useInfiniteQuery` with `initialPageParam`, `getNextPageParam`, `fetchNextPage`, `hasNextPage`. We fetched page 1, then called `fetchNextPage` and got `[page1, page2]`.

### Why not just `useEffect`?

TanStack Query gives you, for free: caching and deduping (ten components asking for the same key make one request), retries with backoff, background refetching on focus/reconnect, cancellation, pagination helpers, mutations with optimistic updates, and **devtools**. The things you'd otherwise rebuild badly are listed in 2.11.

**Server state vs client state:** keep server data in the query cache, and keep only true UI state (open modal, selected tab, form draft) in `useState` or a store. Do **not** copy query data into `useState` or Redux. It creates two sources of truth.

## 3.2 Client state management

Start simple and add tools only when the problem demands:

| Need | Reach for |
|---|---|
| State used by one component | `useState` / `useReducer` |
| Shared by a few nearby components | Lift state up, composition |
| Low-frequency app-wide values (theme, current user, locale) | **Context** |
| Complex client state, many components, frequent updates | **Zustand** or **Redux Toolkit** |
| Server data | TanStack Query / RTK Query (3.1) |
| State that belongs in the URL (filters, page, tab) | **The router's search params**. It is shareable and survives refresh |
| Form state | A form library (below), or native form + Actions |

### Redux Toolkit

Redux's pattern (one store, actions describe what happened, reducers compute the next state) with the boilerplate removed.

```tsx
const todosSlice = createSlice({
  name: 'todos',
  initialState: [] as Todo[],
  reducers: {
    added: (state, action: PayloadAction<number>) => { state.push({ id: action.payload, done: false }); },   // Immer: "mutation" is safe here
    toggled: (state, action: PayloadAction<number>) => { const t = state.find((x) => x.id === action.payload); if (t) t.done = !t.done; },
  },
});

export const store = configureStore({ reducer: { todos: todosSlice.reducer } });

const todos = useSelector((s: RootState) => s.todos);      // re-renders only when the selected slice changes
const dispatch = useDispatch<AppDispatch>();
dispatch(todosSlice.actions.added(1));
```

We checked that the "mutating" reducer produced a new state and the old state object was unchanged, and that a component selecting `a` did not re-render when only `b` changed. Know **`createAsyncThunk`** (async actions), **selectors** (`createSelector` for memoised derived data), **RTK Query** (data fetching built in) and **why Redux**: predictable updates, time-travel devtools, middleware, strict structure for large teams.

### Zustand

A tiny store with no providers and no boilerplate:

```tsx
const useStore = create<{ count: number; inc: () => void }>((set) => ({
  count: 0,
  inc: () => set((s) => ({ count: s.count + 1 })),
}));

const count = useStore((s) => s.count);      // selector: re-render only when `count` changes
```

We checked: a component selecting `count` did not re-render when an unrelated field changed. **Always select a slice**. `useStore()` with no selector re-renders on any change.

**Choosing:** Zustand for most apps' client state (simple, small). Redux Toolkit for large teams or apps that want strict conventions, middleware and devtools. Jotai/Recoil-style atoms for fine-grained derived state. Context for rarely-changing values.

### Forms at scale

**React Hook Form** keeps inputs **uncontrolled** and registers them with refs, so typing does not re-render the whole form. Combine it with **Zod** (or Valibot) so one schema gives you validation and the TypeScript type:

```tsx
const schema = z.object({ email: z.string().email(), age: z.coerce.number().min(18) });
type FormValues = z.infer<typeof schema>;

const { register, handleSubmit, formState: { errors, isSubmitting } } =
  useForm<FormValues>({ resolver: zodResolver(schema) });

<form onSubmit={handleSubmit(onValid)}>
  <input {...register('email')} />
  {errors.email && <p role="alert">{errors.email.message}</p>}
</form>
```

For a small form, plain state (see the signup solution in Level 4) or React 19 Actions are enough. Know the trade-off: a library earns its keep with many fields, dynamic fields (arrays), complex validation, and performance.

## 3.3 Routing with React Router

React Router is the standard client router. Modern usage is the **data router**: routes are declared with their data loading, and the router coordinates navigation.

```tsx
const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,                               // renders <Outlet /> for the child route
    children: [
      { index: true, Component: Home },
      {
        path: 'users/:id',
        loader: async ({ params }) => fetchUser(params.id!),   // runs before the route renders
        Component: UserPage,                         // reads it with useLoaderData()
      },
      { path: 'old', loader: () => redirect('/users/9') },
      { path: 'reports', lazy: () => import('./reports-route') },   // code-split route
    ],
  },
]);

createRoot(root).render(<RouterProvider router={router} />);
```

We ran a memory router with a layout route, an index route, a param route with a loader, a redirecting loader and `Link` navigation. The loader's data arrived through `useLoaderData`, `useParams` returned `id`, and the redirect landed on the new path.

**Know these:**

| Concept | Notes |
|---|---|
| **Nested routes and `<Outlet />`** | Layout routes render child routes in place |
| **Loaders and actions** | Fetch data and handle form submissions at the route level, avoiding the "render → effect → spinner" waterfall |
| **`useParams`, `useSearchParams`, `useNavigate`, `useLocation`** | Params, query string (we checked `setSearchParams({ q })` updates the URL state), imperative navigation |
| **Protected routes** | A layout route (or loader) that redirects when not authenticated. **Client checks are only UX**, and the server must enforce access |
| **Code splitting** | `lazy` on routes or `React.lazy` + `Suspense` |
| **Error handling** | `errorElement` / `ErrorBoundary` per route, `useRouteError` |
| **`useNavigation`** | Know a navigation is pending, and show a global progress bar |
| **Package and versions** | Import from `react-router` (the separate `react-router-dom` package became a thin re-export in v7). Version 7 merged in the Remix framework features, so the same library can also run as a framework with SSR |

**Frameworks vs a plain router:** Next.js (file-based routing, Server Components, server rendering) or React Router's framework mode give you SSR, data loading and bundling in one. A plain SPA with Vite and a client router is simpler and fine for internal apps and dashboards.

## 3.4 Testing

**What to test:** behaviour the *user* sees and does, not implementation. The standard stack is **Vitest** (or Jest) + **React Testing Library** + **`@testing-library/user-event`**, with **MSW** to mock the network and **Playwright** (or Cypress) for end-to-end tests.

```tsx
it('adds and completes a todo', async () => {
  const user = userEvent.setup();
  render(<Todos />);
  await user.type(screen.getByPlaceholderText('What needs doing?'), 'one{Enter}');
  await user.click(screen.getByLabelText('one'));
  expect(screen.getByText('0 left')).toBeInTheDocument();
});
```

**Principles**

- **Query the way a user finds things**, in this order of preference: `getByRole` (with `name`), `getByLabelText`, `getByPlaceholderText`, `getByText`, and `getByTestId` as a last resort. If `getByRole` can't find it, your accessibility is probably broken too.
- **`getBy*`** throws if missing, **`queryBy*`** returns `null` (use for asserting absence), **`findBy*`** is async and waits (use for things that appear later).
- **Use `userEvent`, not `fireEvent`**: it simulates real sequences (focus, keydown, input, click).
- **Don't test implementation details**: internal state, hook calls, component names. Refactoring shouldn't break tests.
- **Mock at the network boundary** (MSW) instead of mocking your own modules. The component and the `fetch` call run for real.
- **Custom hooks:** `renderHook`. We tested `useDebounce` with fake timers and `useLocalStorage` this way.
- **Wrap updates in `act`.** RTL does it for you for `render`, `user` events and `waitFor`. If you see *"not wrapped in act(...)"*, you are asserting before async work has settled. We also hit this with Suspense: rendering a component that suspends needs `await act(async () => { render(...) })`.
- **Test the contract, not React:** for `Modal`, assert focus moves in, `Escape` closes, and focus returns. Don't assert how many times it rendered.

**Testing TanStack Query:** create a **fresh `QueryClient` per test** with `retry: false` (otherwise failing queries retry with backoff and tests time out), and wrap with `QueryClientProvider`.

**What about snapshot tests?** Useful for small, stable output (a serialised config, a small pure component). Large DOM snapshots are noisy and get approved without being read.

**The testing pyramid:** many unit tests (pure functions, hooks, reducers), a good number of component tests (behaviour), few end-to-end tests (critical journeys: sign in, checkout).

## 3.5 Performance

**Process: measure → find the cause → fix → measure again.** Tools: the **React DevTools Profiler** (what rendered and why, and how long), the browser **Performance** tab, **Lighthouse / Web Vitals** (LCP, INP, CLS), and a **bundle analyser**.

**Load performance**

- **Code splitting**: `lazy()` + `Suspense` for routes and heavy components (charts, editors, maps). Lazy routes only help if nothing eagerly imports them.
- Trim dependencies (check bundle size before adding one, prefer ESM and tree-shakable libraries, avoid importing all of lodash/moment).
- Images: correct size and format, `loading="lazy"`, `width`/`height` to prevent layout shift, `fetchpriority` for the hero image.
- **SSR/SSG/streaming** for faster first paint and SEO (3.6).
- Preload critical resources. React 19 gives `preload`, `preinit`, `preconnect` and `prefetchDNS` in `react-dom`.

**Runtime performance**

| Problem | Fix |
|---|---|
| Whole tree re-renders on a small change | **Move state down** into the component that uses it. Lift content up as `children` |
| An expensive component re-renders with the same props | `memo` + stable props, or the **React Compiler** |
| An expensive calculation each render | `useMemo` (measure first) |
| A long list (thousands of rows) | **Virtualise** (TanStack Virtual, react-window): render only the visible rows |
| Typing feels laggy with a heavy results list | `useDeferredValue` / `useTransition` |
| Context update re-renders everything | Split contexts, or a store with selectors |
| New object/array/function props defeating `memo` | Stable references (`useMemo`/`useCallback`) or the Compiler |
| Big lists keyed by index, items reordered | A stable `key` |
| Layout thrash or heavy work on the main thread | A Web Worker, `requestIdleCallback`, `useLayoutEffect` only for measuring |

**Common misconceptions:**

- "Re-renders are slow." They're usually cheap. *Unnecessary slow* re-renders are the problem, so find them with the Profiler.
- "Wrap everything in `useMemo`/`useCallback`." That adds cost and noise, and gains nothing unless it feeds a `memo` or a dependency.
- "`key={index}` is fine for performance." It can be *wrong* and slow when the list changes (state follows the position and the DOM gets rewritten).

## 3.6 Rendering strategies: CSR, SSR, SSG, streaming and Server Components

| Strategy | Where HTML is made | Good for | Trade-off |
|---|---|---|---|
| **CSR** (plain Vite SPA) | In the browser | Dashboards, internal tools, behind a login | Blank page until JS loads, weak SEO |
| **SSR** | On the server, per request | Dynamic, SEO-sensitive pages | Server cost, **hydration** needed |
| **SSG** | At build time | Marketing pages, docs, blogs | Rebuild to update (or revalidate on a timer) |
| **Streaming SSR** | Server, sent in chunks as Suspense boundaries resolve | Pages with slow sections | More moving parts |
| **Server Components (RSC)** | On the server, **never shipped to the browser** | Data-heavy UI, less client JS | Needs a framework, new mental model |

**Hydration:** the server sends HTML so the user sees content immediately, then the browser loads JS and `hydrateRoot` **attaches event handlers to the existing DOM** rather than rebuilding it. We rendered a component with `renderToString`, put the HTML in the page, hydrated it, and the **same DOM node was reused** and became interactive.

**Hydration mismatch:** if the client's first render differs from the server HTML (a `Date.now()`, `Math.random()`, `localStorage`, `window.innerWidth`, a user-agent branch), React warns and may rebuild the DOM. Keep the first render deterministic, and read browser-only values in an effect (or `useSyncExternalStore` with a server snapshot). React 19 shows a readable diff of what differed.

**Server Components (in Next.js App Router, or React Router framework mode):**

```tsx
// app/users/page.tsx: a Server Component by default; runs only on the server
export default async function Users() {
  const users = await db.users.findMany();          // direct data access, no API layer, no secrets shipped to the client
  return <ul>{users.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

```tsx
'use client';                                        // marks the boundary: this file and its imports are shipped to the browser
export function LikeButton() { const [n, setN] = useState(0); return <button onClick={() => setN(n + 1)}>{n}</button>; }
```

```tsx
'use server';                                        // Server Action: a function the client can call, running on the server
export async function saveUser(formData: FormData) { await db.users.create({ name: String(formData.get('name')) }); }
```

| | Server Component | Client Component |
|---|---|---|
| Runs | Only on the server | Server (for the initial HTML) **and** the browser |
| Can use | `async/await`, DB, secrets, file system | `useState`, `useEffect`, event handlers, browser APIs |
| Ships JS to the browser | No | Yes |
| Interactive | No | Yes |

Key points: a Server Component can **render** Client Components and pass them serialisable props (and `children`), but a Client Component can't *import* a Server Component. Server Actions are **public HTTP endpoints**, so validate and authorise inside them like any API route. Since React 19.3, Server Components can also render Context providers directly (`<UserContext value={...}>`), and `use(browser())` from `react-dom` lets a component opt out of server rendering (render only in the browser).

**Partial prerendering (19.2):** prerender the static shell at build time, then stream the dynamic parts at request time (`prerender`, `resume` APIs, used through a framework).

## 3.7 Patterns interviewers ask about

| Pattern | What it is | Today |
|---|---|---|
| **Custom hooks** | Reusable stateful logic | The default way to share logic |
| **Compound components** | A set of components sharing implicit state through context (`<Tabs>`, `<Tabs.Tab>`, `<Tabs.Panel>`) | A great fit for flexible UI libraries. We build Tabs in 4.2 |
| **Render props** | A prop that is a function returning UI (`<List renderItem={(x) => ...} />`) | Still fine for "slots" with data |
| **Higher-order components (HOC)** | A function that takes a component and returns an enhanced one (`withAuth(Page)`) | Legacy (Redux `connect`, `withRouter`). Hooks replaced most uses |
| **Controlled / uncontrolled components** | Parent-owned vs self-owned state, with `value`/`defaultValue` and `onChange` | Design reusable inputs to support both when you can |
| **Container / presentational** | Data-fetching vs rendering components | Mostly replaced by custom hooks |
| **Portals** | `createPortal(children, domNode)` renders into another DOM node (modals, tooltips) | We checked a click inside a portal still bubbles to React ancestors, even though the DOM node is elsewhere |
| **Error boundaries** | Catch render errors in a subtree | 2.10 |
| **`flushSync`** | Force a synchronous DOM update | Rare escape hatch (we checked the DOM is updated immediately after) |
| **State machines / reducers** | Explicit states and transitions | Wizards, async flows |

**Composition over configuration:** a component with 15 boolean props is a smell. Prefer small components that compose, with `children` and slots.

## 3.8 Accessibility (a11y)

Accessibility is a standard interview topic and **a good source of easy points**.

- **Use semantic HTML first**: `button` (not `div onClick`), `a href` for navigation, `nav`, `main`, `ul`/`li`, `label`, `h1`..`h6` in order. You get keyboard behaviour and roles for free.
- **Every input has a label**: `<label htmlFor={id}>` with an id from **`useId()`**, which is unique per instance and stable between server and client (we checked two instances got different ids and the label pointed to the right one).
- **Keyboard**: everything must work without a mouse: tab order, visible focus, `Enter`/`Space` on buttons, `Escape` to close, arrow keys in widgets (tabs, menus).
- **Focus management** (the part SPAs break): move focus into a modal, trap it there, return it on close. Move focus to the new page heading after a route change.
- **ARIA is a last resort**: `aria-label` for icon buttons, `aria-live="polite"` for status messages, `aria-expanded`, `aria-controls`, `aria-selected`. *No ARIA is better than bad ARIA.*
- **Don't rely on colour alone**, and keep sufficient contrast (4.5:1 for body text).
- **Alt text** on meaningful images, empty `alt=""` on decorative ones.
- **Tools:** `eslint-plugin-jsx-a11y`, axe (`jest-axe`/`vitest-axe`, browser extension), Lighthouse, and keyboard-only and screen-reader testing (NVDA, VoiceOver). Testing with `getByRole` is itself an accessibility check.
- For hard widgets (dialogs, comboboxes, menus), use a proven headless library (**Radix UI**, **React Aria**, **Headless UI**, or the native `<dialog>`) instead of hand-rolling.

## 3.9 Security

| Threat | Defence in React |
|---|---|
| **XSS** | JSX escapes values by default. Avoid `dangerouslySetInnerHTML` with untrusted data. If you must, sanitise with **DOMPurify** |
| **Dangerous URLs** | `<a href={userUrl}>` with `javascript:...` can run script. Validate that the scheme is `http(s)`/`mailto` |
| **Injection into inline scripts (SSR)** | When serialising state into `<script>` for hydration, escape `<` (for example `JSON.stringify(data).replace(/</g, '\\u003c')`). Frameworks do it for you |
| **Token storage** | Prefer an **HttpOnly, Secure, SameSite cookie** for session or refresh tokens. A long-lived token in `localStorage` is readable by any XSS. Keep short-lived access tokens in memory |
| **CSRF** | Needed with cookie auth: SameSite cookies, CSRF tokens, checking `Origin` |
| **Secrets in the bundle** | **Anything in client code is public.** Environment variables with a public prefix (`VITE_*`, `NEXT_PUBLIC_*`) end up in the bundle. Secrets stay on the server |
| **Authorisation** | Route guards and hidden buttons are UX. **The server must enforce permissions.** Server Actions and API routes are public endpoints |
| **Dependencies** | `npm audit`, lockfiles, review new packages, Dependabot/Renovate, avoid abandoned libraries |
| **Content Security Policy** | Restricts where scripts can load from, a strong second line against XSS |
| **Trusted Types (React 19.3)** | Browser feature that blocks unsafe string-to-HTML sinks. React 19.3 supports it, so you can enforce it with CSP |
| **Clickjacking and third-party scripts** | `frame-ancestors`/`X-Frame-Options`, and think about what every analytics or widget script can read |

Interview line: "React protects against the common XSS case by escaping, so my attention goes to `dangerouslySetInnerHTML`, user-controlled URLs, token storage, and making sure the server does the real authorisation."

## 3.10 TypeScript with React

```tsx
// props
type CardProps = { title: string; children: React.ReactNode; onClose?: () => void };
function Card({ title, children, onClose }: CardProps) { ... }

// extend native element props
type ButtonProps = React.ComponentProps<'button'> & { variant?: 'primary' | 'ghost' };

// state: say the type when the initial value doesn't show it
const [user, setUser] = useState<User | null>(null);

// refs
const inputRef = useRef<HTMLInputElement>(null);       // React 19 types: useRef always takes an argument

// events
const onChange = (e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value);

// context with a safe hook (no `null` checks in every consumer)
const Ctx = createContext<Value | null>(null);
function useValue() { const v = useContext(Ctx); if (!v) throw new Error('Use inside <Provider>'); return v; }

// generic component (we build this DataTable in Level 4)
function DataTable<T extends Record<string, unknown>>({ rows, columns }: { rows: T[]; columns: Column<T>[] }) { ... }

// discriminated union for async state
type State<T> = { status: 'idle' } | { status: 'loading' } | { status: 'ok'; data: T } | { status: 'error'; error: Error };
```

| Type | Meaning |
|---|---|
| `React.ReactNode` | Anything renderable (string, number, element, array, `null`, ...). Use for `children` |
| `React.ReactElement` | A JSX element specifically |
| `React.ComponentProps<typeof X>` / `<'div'>` | The props of a component or HTML tag |
| `React.FC<Props>` | Works, but isn't required. A plain function with typed props is simpler and handles generics |
| `React.Dispatch<React.SetStateAction<T>>` | The type of a `setState` function |

Tips: avoid `any` (use `unknown` and narrow). Use **`as const`** for tuples returned from hooks (`return [value, setValue] as const`). Don't type the return of simple components. Type *props* and *hook return values*. Use **Zod** to derive types from runtime schemas for API data. In React 19's types the old global `JSX` namespace moved to `React.JSX`.

## 3.11 Styling, project setup and tooling

**Styling options**

| Option | Notes |
|---|---|
| **CSS Modules** | Scoped class names, zero runtime, works everywhere |
| **Tailwind CSS** | Utility classes, very popular, no runtime |
| **CSS-in-JS** (styled-components, Emotion) | Colocated and dynamic, but a **runtime cost**, and awkward with Server Components. Many teams are moving away |
| **Zero-runtime CSS-in-JS** (vanilla-extract, Panda CSS, StyleX) | Type-safe, compiled to static CSS |
| **Component libraries** (MUI, Chakra, shadcn/ui, Ant Design) | Speed and consistency, with a bundle-size and customisation trade-off |

**Tooling**

- **Vite** for plain React apps (**Create React App is deprecated**). **Next.js** or **React Router framework mode** for SSR/full-stack.
- **TypeScript**, **ESLint** (with `eslint-plugin-react-hooks` and `jsx-a11y`) and **Prettier**.
- **Vitest** or Jest + React Testing Library, **Playwright** for end-to-end.
- **React DevTools** (component tree, Profiler, "highlight updates"), **TanStack Query devtools**, **Redux DevTools**.
- **Storybook** for component libraries.
- **Environment config:** build-time variables are baked into the bundle. For "one build, many environments", fetch a config file at startup.

## 3.12 The newest features (19.2 and 19.3)

Be able to name these and say what problem each solves:

| Feature | Version | What and why |
|---|---|---|
| **`<Activity>`** | 19.2 | Hide UI while keeping state, and pause its effects. Tabs, back navigation, prerendering (2.9) |
| **`useEffectEvent`** | 19.2 | Reads latest props/state inside an effect without being a dependency (2.3) |
| **Partial prerendering**, batched Suspense reveals for SSR | 19.2 | Faster first paint with static shell + streamed dynamic parts |
| **Performance Tracks** | 19.2 | React-specific tracks in the Chrome performance profile |
| **`<ViewTransition>`** and **`addTransitionType`** | 19.3 | Animate between UI states using the browser's View Transitions API. Wrap the thing that changes, and trigger the change inside a transition (`startTransition`), a Suspense reveal or `useDeferredValue`. `addTransitionType('navigate')` tags *why* it changed so you can style forward and back differently. We checked it exports and renders, and the animation itself needs a real browser |
| **Fragment refs** | 19.3 | `<Fragment ref={ref}>` gives a handle for a group of sibling nodes, with `observeUsing` for `IntersectionObserver`, `focus`, `addEventListener` and more (2.2). No wrapper element needed |
| **Trusted Types** support | 19.3 | Works with a strict CSP (3.9) |
| **`use(browser())`** | 19.3 | Opt a component out of server rendering |
| **Context in Server Components** | 19.3 | `<Context value>` can be rendered on the server |
| **Transitions render independently** | 19.3 | An unrelated update isn't held back by a slow transition |
| **StrictMode and hydration** | 19.3 | Effects are double-invoked during hydration in dev too |

## 3.13 React vs Angular vs Vue

| | React | Angular | Vue |
|---|---|---|---|
| Kind | Library for UI | Full framework | Progressive framework |
| Language | JavaScript/TypeScript, JSX | TypeScript, HTML templates | JavaScript/TypeScript, SFC templates |
| Reactivity | Re-render the component, diff the tree (Compiler optimises) | Signals (fine-grained), zoneless | Proxy-based refs, fine-grained |
| State | You choose (hooks, Zustand, Redux, ...) | Signals, services, NgRx | Pinia, composition API |
| Routing, forms, HTTP | Libraries | Built in | Official router/state libraries |
| Structure | Flexible | Opinionated | In between |
| Learning curve | Small core, many decisions | Steep, then consistent | Gentle |

Answer neutrally: "React gives me a small, flexible core and a huge ecosystem, at the cost of more decisions. I'd pick it for products where the team wants control. Angular's consistency pays off for big teams. What I care about is the model: unidirectional data flow, composition, and declarative UI."

## 3.14 Quick-fire Q&A (Advanced)

**How do you manage server state?** TanStack Query (or SWR/RTK Query): caching, deduping, invalidation, optimistic updates. Not Redux or `useState` copies.

**Context vs Redux vs Zustand?** Context for low-frequency values and dependency injection. Zustand for simple global client state with selectors. Redux Toolkit for large apps that benefit from strict structure, middleware and devtools.

**How do you optimise a slow list?** Find the cause with the Profiler. Virtualise long lists, stable keys, `memo` rows with stable props, `useDeferredValue` for filtering, and server-side pagination.

**How do you code-split?** `lazy()` + `Suspense` on routes and heavy components, and dynamic `import()`.

**What is hydration?** Attaching event handlers to server-rendered HTML instead of recreating the DOM. Mismatches cause warnings or rebuilds.

**SSR vs SSG vs CSR?** HTML per request on the server, HTML at build time, or HTML in the browser. Choose by SEO needs, freshness and cost.

**What are Server Components?** Components that render only on the server and ship no JS. They can read data directly. Interactive parts are Client Components (`'use client'`).

**How do you test a component?** React Testing Library with `userEvent`, query by role, assert visible behaviour, mock the network with MSW, and test hooks with `renderHook`.

**What do you test and not test?** User-visible behaviour, yes. Internal state and implementation details, no.

**How do you handle authentication?** Tokens in HttpOnly cookies (or in-memory access tokens), an API client that refreshes on `401` once, protected routes for UX, and server-side authorisation.

**How do you handle errors?** Error boundaries for render errors, `try/catch` for handlers and async code, query/mutation error states, a central reporter (`onCaughtError`/Sentry), and user-friendly fallbacks.

**How do you structure a large React app?** Feature folders (each with components, hooks, API calls and tests), shared UI in a `components` library, a clear data layer, absolute imports, and lint rules to keep boundaries.

**What is the React Compiler?** A build-time optimiser that auto-memoises. It needs pure, rules-following code.

**What's new in React 19?** `use`, Actions with `useActionState`/`useFormStatus`/`useOptimistic`, `ref` as a prop, `<Context value>`, metadata and resource APIs, Server Components stable. **19.2:** `Activity`, `useEffectEvent`. **19.3:** `ViewTransition`, Fragment refs, Trusted Types.
