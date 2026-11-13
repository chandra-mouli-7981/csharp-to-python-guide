# Level 4 · Practice

## 4.0 How to attack a coding round

Mid-level React rounds are usually "build a small component" (30 to 45 minutes) or "review this code and tell me what's wrong". The interviewer is grading how you think, not whether you finish.

1. **Clarify first.** Inputs and outputs? Empty, loading and error states? Does it need to be reusable? Accessibility?
2. **Model the state.** What is the *source* state, and what is *derived*? Never store something you can compute during render.
3. **Name the data flow.** Data down through props, events up through callbacks. Say it out loud.
4. **Build the happy path, then the edges.** Empty list, double click, slow network, error, rapid typing, unmounting mid-request.
5. **Mention what you'd add with more time**: tests, a11y, memoisation after profiling, error reporting. That shows seniority without costing minutes.

Every solution below was run in a React 19.3 project with Vitest and React Testing Library, and type-checked with TypeScript. Imports are left out to keep the code short, and they come from `react`, `react-dom` and `@tanstack/react-query`.

> **Tip:** if the company is on an older React, say so, then write the same solution without `useEffectEvent`, `use`, `useOptimistic` and `ref`-as-a-prop (a ref holding the latest callback, `forwardRef`, and `useState` + an async function). Knowing both is the point of this guide.

## 4.1 Easy problems

### E1 · Todo list

**Task:** add items, toggle done, remove, filter by all/open/done, and show how many are left.

**What they look for:** immutable state updates, **derived values computed during render** (no `useEffect`, no duplicated state), `key` on a real id, an empty state.

```tsx
export interface Todo { id: number; title: string; done: boolean }
type Filter = 'all' | 'open' | 'done';

export function Todos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const nextId = useRef(1);

  const visible = todos.filter((t) => filter === 'all' || (filter === 'done') === t.done);   // derived: no state, no effect
  const openCount = todos.filter((t) => !t.done).length;

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const title = new FormData(form).get('title')?.toString().trim();
    if (!title) return;
    setTodos((list) => [...list, { id: nextId.current++, title, done: false }]);
    form.reset();
  }
  const toggle = (id: number) => setTodos((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id: number) => setTodos((list) => list.filter((t) => t.id !== id));

  return (
    <section>
      <form onSubmit={add}>
        <input name="title" placeholder="What needs doing?" />
        <button>Add</button>
      </form>
      <nav>
        {(['all', 'open', 'done'] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>{f}</button>
        ))}
      </nav>
      <ul>
        {visible.map((t) => (
          <li key={t.id} className={t.done ? 'done' : ''}>
            <input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label={t.title} />
            {t.title}
            <button type="button" aria-label={`Remove ${t.title}`} onClick={() => remove(t.id)}>×</button>
          </li>
        ))}
        {visible.length === 0 && <li>Nothing here</li>}
      </ul>
      <p>{openCount} left</p>
    </section>
  );
}
```

**Follow-ups they ask**

- *Why `setTodos(list => ...)`?* The functional form always works from the latest state, so rapid or batched updates don't overwrite each other.
- *Why derive `visible` instead of storing it?* Two sources of truth go out of sync. Computing during render is always correct and cheap here.
- *Why `useRef` for `nextId`?* It must survive renders but doesn't affect what's on screen. A ref changes without re-rendering.
- *Why an uncontrolled input here?* We only need the value on submit, and `FormData` plus `form.reset()` avoids re-rendering on every keystroke. A controlled input is also fine.
- *Why a real `id` as `key`?* So state and DOM follow the item when the list changes (the index-key bug is in 4.4).
- *How would you persist it?* `useLocalStorage` (E2).

### E2 · A `useLocalStorage` hook

**Task:** like `useState`, but the value survives a page refresh.

```tsx
export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}
```

**Talking points:** the **lazy initialiser** reads storage once, not on every render. The effect **synchronises** state to an external system, which is the correct use of an effect. `try/catch` covers invalid JSON, blocked storage, and private mode. `as const` makes the return a tuple, not `(T | Dispatch)[]`. **SSR caveat:** the server has no `localStorage`, and a client first render that differs from the server's causes a hydration mismatch. Read storage after hydration (an effect) in server-rendered apps. Other tabs: listen to the `storage` event, or use `useSyncExternalStore`.

### E3 · A `useClickOutside` hook and a dropdown

**Task:** close a dropdown when the user clicks anywhere outside it.

```tsx
export function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  const onOutsideEvent = useEffectEvent(onOutside);          // always the latest callback, never a dependency
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutsideEvent();
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);
  return ref;
}

export function Dropdown() {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  return (
    <div ref={ref}>
      <button aria-expanded={open} onClick={() => setOpen((o) => !o)}>Menu</button>
      {open && <ul role="menu"><li role="menuitem">One</li></ul>}
    </div>
  );
}
```

**Talking points:** a document listener is an **external system**, so an effect is right, and **cleanup** removes it. `useEffectEvent` means the effect doesn't need `onOutside` as a dependency, so it isn't re-subscribed when the parent passes a new function each render. (Before 19.2, store the latest callback in a ref.) Clicks **inside** are ignored using `contains`. Improvements: also close on `Escape`, use `pointerdown`, and handle `focusout` for keyboard users.

## 4.2 Medium problems

### M1 · Debounced typeahead search

**Task:** an input that searches an API as you type. Don't spam the server, ignore stale responses, and show idle, loading, error and result states.

**What they look for:** debounce, **cancellation** (`AbortController`) or an ignore flag, a **discriminated union** for status, cleanup in the effect, and not fetching for tiny inputs.

```tsx
export function useDebounce<T>(value: T, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

type SearchState = { status: 'idle' } | { status: 'loading' } | { status: 'ok'; items: string[] } | { status: 'error' };

export function Search({ search, delay = 300 }: {
  search: (q: string, signal: AbortSignal) => Promise<string[]>; delay?: number;
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), delay);
  const [state, setState] = useState<SearchState>({ status: 'idle' });

  useEffect(() => {
    if (debounced.length < 2) { setState({ status: 'idle' }); return; }
    const ctrl = new AbortController();
    setState({ status: 'loading' });
    search(debounced, ctrl.signal)
      .then((items) => setState({ status: 'ok', items }))
      .catch((err) => { if (err.name !== 'AbortError') setState({ status: 'error' }); });   // aborts are expected
    return () => ctrl.abort();                                                              // cancel the stale request
  }, [debounced, search]);

  return (
    <div>
      <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search" />
      {state.status === 'loading' && <p>Searching...</p>}
      {state.status === 'error' && <p role="alert">Something went wrong</p>}
      {state.status === 'ok' && <ul>{state.items.map((i) => <li key={i}>{i}</li>)}</ul>}
    </div>
  );
}
```

The test confirmed: nothing is requested for one character, typing "ab" then "abc" aborts the "ab" request (`signal.aborted` is `true`), only "abc" results are shown, and an error shows the alert.

**Follow-ups**

- *Why the effect cleanup?* If the query changes, the previous request is aborted and its late response can't overwrite the newer one. That is the **race condition** (2.1).
- *Why ignore `AbortError`?* It isn't a failure, it's our own cancellation.
- *The `search` prop is in the dependency array.* The caller must pass a **stable** function (module-level, or `useCallback`), otherwise the effect re-runs every render. Say it out loud.
- *Debounce vs `useDeferredValue`?* Debounce reduces *requests*. Deferring keeps *rendering* responsive. For network calls, debounce.
- *The TanStack Query version:* `useQuery({ queryKey: ['search', debounced], queryFn: ({ signal }) => search(debounced, signal), enabled: debounced.length >= 2 })`. Caching, cancellation and loading/error flags come for free. In real code, this is the better answer.

### M2 · An accessible modal

**Task:** `<Modal open onClose title actions>` rendered above the page, closable with `Escape` and the backdrop, that manages focus properly.

```tsx
export function Modal({ open, onClose, title, children, actions }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; actions?: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseEvent = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseEvent(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused?.focus();                            // give focus back to what opened the modal
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        onClick={(e) => e.stopPropagation()}                 // clicks inside must not reach the backdrop
      >
        <header><h2 id={titleId}>{title}</h2><button type="button" aria-label="Close" onClick={onClose}>×</button></header>
        <section>{children}</section>
        {actions && <footer>{actions}</footer>}
      </div>
    </div>,
    document.body,
  );
}
```

```tsx
<Modal open={show} onClose={() => setShow(false)} title="Delete project?" actions={<button onClick={confirm}>Confirm</button>}>
  <p>This cannot be undone.</p>
</Modal>
```

We verified: the dialog is rendered under `document.body`, it has the accessible name from its title, it receives focus on open, a click inside doesn't close it, `Escape` and the backdrop do, and focus returns to the opener.

**Talking points:** **portal** so z-index and overflow of ancestors can't clip it (events still bubble through the *React* tree). `role="dialog"`, `aria-modal`, `aria-labelledby` with `useId`. **Focus management** is the part most candidates forget. Slots (`actions`) are just props that hold elements. **Missing and how you'd add it:** a real *focus trap* (Tab cycling inside), scroll lock, and `inert` on the background. The native `<dialog>` with `showModal()`, **Radix Dialog** or **React Aria** do all of that, and using one in production is the right call.

### M3 · Registration form with validation

**Task:** username (required, at least 3 characters, must not be taken, checked asynchronously), password (at least 8), confirm password must match. Submit disabled until valid. Show errors only after the field was touched.

**What they look for:** **errors derived during render** (not stored in state), "touched" tracking, an **async check with debounce and cancellation**, disabling submit while checking.

```tsx
export function Signup({ isTaken, onSaved, delay = 300 }: {
  isTaken: (name: string, signal: AbortSignal) => Promise<boolean>;
  onSaved: (v: { username: string; password: string }) => void;
  delay?: number;
}) {
  const [values, setValues] = useState({ username: '', password: '', confirm: '' });
  const [touched, setTouched] = useState({ username: false, password: false, confirm: false });
  const [availability, setAvailability] = useState<'unknown' | 'checking' | 'free' | 'taken'>('unknown');
  const debouncedName = useDebounce(values.username, delay);

  useEffect(() => {
    if (debouncedName.length < 3) { setAvailability('unknown'); return; }
    const ctrl = new AbortController();
    setAvailability('checking');
    isTaken(debouncedName, ctrl.signal)
      .then((taken) => setAvailability(taken ? 'taken' : 'free'))
      .catch(() => {});
    return () => ctrl.abort();
  }, [debouncedName, isTaken]);

  // Errors are DERIVED during render: no state to keep in sync.
  const errors = {
    username: !values.username ? 'Required'
      : values.username.length < 3 ? 'At least 3 characters'
      : availability === 'taken' ? 'Already taken' : undefined,
    password: !values.password ? 'Required' : values.password.length < 8 ? 'At least 8 characters' : undefined,
    confirm: values.confirm !== values.password ? 'Passwords do not match' : undefined,
  };
  const valid = !errors.username && !errors.password && !errors.confirm
    && availability !== 'checking' && availability !== 'unknown';

  const change = (k: keyof typeof values) => (e: ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));
  const blur = (k: keyof typeof values) => () => setTouched((t) => ({ ...t, [k]: true }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) { setTouched({ username: true, password: true, confirm: true }); return; }
    onSaved({ username: values.username, password: values.password });
  }

  return (
    <form onSubmit={submit} noValidate>
      <label>Username <input value={values.username} onChange={change('username')} onBlur={blur('username')}
                              aria-invalid={touched.username && !!errors.username} /></label>
      {touched.username && errors.username && <small role="alert">{errors.username}</small>}
      {availability === 'checking' && <small>Checking...</small>}
      <label>Password <input type="password" value={values.password} onChange={change('password')} onBlur={blur('password')} /></label>
      {touched.password && errors.password && <small role="alert">{errors.password}</small>}
      <label>Confirm <input type="password" value={values.confirm} onChange={change('confirm')} onBlur={blur('confirm')} /></label>
      {touched.confirm && errors.confirm && <small role="alert">{errors.confirm}</small>}
      <button disabled={!valid}>Create account</button>
    </form>
  );
}
```

**Talking points**

- **Derive, don't store:** an `errors` state would need updating in every handler. Computing during render means it can never be stale.
- **`touched`** prevents shouting "Required" before the user has typed. On a failed submit, mark everything touched so all errors appear.
- **Async validity** is an *effect* (external system: the server). It's debounced, and aborted when the name changes. The submit button stays disabled while `checking`.
- A server check is **advisory**. The real uniqueness check happens on submit on the server, which must handle "taken" as an error too.
- **With libraries:** React Hook Form + Zod (`schema.refine` / an async `validate`) for bigger forms. **With React 19 Actions:** `useActionState` returns field errors from the server, and `useFormStatus` drives the pending state (2.8).
- Each input is **labelled** (a wrapping `<label>`), errors use `role="alert"`, and `aria-invalid` is set. Mention `autocomplete` attributes and password managers if you have time.

### M4 · Accessible Tabs (compound components)

**Task:** `<Tabs>`, `<Tabs.List>`, `<Tabs.Tab>`, `<Tabs.Panel>` sharing state implicitly, with keyboard support.

```tsx
const TabsContext = createContext<{ value: string; select: (v: string) => void; base: string } | null>(null);
function useTabs() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error('Tabs parts must be used inside <Tabs>');
  return ctx;
}

export function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [value, setValue] = useState(defaultValue);
  const base = useId();
  return <TabsContext value={{ value, select: setValue, base }}>{children}</TabsContext>;
}

Tabs.List = function TabList({ children, label }: { children: ReactNode; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tabs = [...ref.current!.querySelectorAll<HTMLElement>('[role="tab"]')];
    const i = tabs.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length
      : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length
      : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();                                       // automatic activation
  }
  return <div ref={ref} role="tablist" aria-label={label} onKeyDown={onKeyDown}>{children}</div>;
};

Tabs.Tab = function Tab({ value, children }: { value: string; children: ReactNode }) {
  const { value: active, select, base } = useTabs();
  const selected = active === value;
  return (
    <button
      role="tab" id={`${base}-tab-${value}`} aria-controls={`${base}-panel-${value}`}
      aria-selected={selected} tabIndex={selected ? 0 : -1}   // roving tabindex: one tab stop for the whole list
      onClick={() => select(value)}
    >{children}</button>
  );
};

Tabs.Panel = function Panel({ value, children }: { value: string; children: ReactNode }) {
  const { value: active, base } = useTabs();
  if (active !== value) return null;
  return <div role="tabpanel" id={`${base}-panel-${value}`} aria-labelledby={`${base}-tab-${value}`}>{children}</div>;
};
```

```tsx
<Tabs defaultValue="a">
  <Tabs.List label="Sections"><Tabs.Tab value="a">A</Tabs.Tab><Tabs.Tab value="b">B</Tabs.Tab></Tabs.List>
  <Tabs.Panel value="a">First</Tabs.Panel>
  <Tabs.Panel value="b">Second</Tabs.Panel>
</Tabs>
```

We checked: roles and `aria-selected`, only the selected tab has `tabindex=0`, the panel's accessible name is its tab, `ArrowRight` moves focus and shows the next panel, arrows wrap around, and using a part outside `<Tabs>` throws a clear error.

**Talking points:** **compound components** give consumers layout freedom (they can put anything between the parts) while the parent owns the state through context. The `useTabs` hook throws a helpful error instead of failing on a `null`. Follow the **WAI-ARIA tabs pattern**: roles, `aria-selected`, `aria-controls`/`aria-labelledby`, roving tabindex, arrow keys. `useId` keeps ids unique and SSR-safe. To keep inactive panels' state (a form in a tab), render them inside `<Activity mode="hidden">` instead of returning `null`. The context value is a fresh object each render, which is fine for a small component (and handled by the Compiler), but mention `useMemo` for large trees.

### M5 · Paginated list with TanStack Query

**Task:** a paged user list with Prev/Next, loading and error states, retry. The old page must stay visible (and the pager must not jump) while the next page loads.

```tsx
export interface Page<T> { items: T[]; total: number }

export function Users({ fetchPage, size = 10 }: {
  fetchPage: (page: number, size: number) => Promise<Page<string>>; size?: number;
}) {
  const [page, setPage] = useState(1);
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } = useQuery({
    queryKey: ['users', page, size],
    queryFn: () => fetchPage(page, size),
    placeholderData: keepPreviousData,                        // keep showing the old page while the next loads
  });
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / size));

  return (
    <div>
      {isPending && <p>Loading...</p>}
      {isError && <p role="alert">Failed <button onClick={() => refetch()}>Retry</button></p>}
      {data && <ul style={{ opacity: isPlaceholderData ? 0.5 : 1 }}>{data.items.map((u) => <li key={u}>{u}</li>)}</ul>}
      <button onClick={() => setPage((p) => p - 1)} disabled={page === 1}>Prev</button>
      <span>{page} / {totalPages}</span>
      <button onClick={() => setPage((p) => p + 1)} disabled={isPlaceholderData || page >= totalPages}>Next</button>
      {isFetching && <small>updating</small>}
    </div>
  );
}
```

**Talking points:** `page` is in the **query key**, so each page is cached separately (going back is instant). `placeholderData: keepPreviousData` shows the old data (flagged by `isPlaceholderData`) instead of flashing a spinner. In the test, after clicking Next the old page was still visible, the pager already read "2 / 3", and Next was disabled until the response arrived. Disable Next while the data is a placeholder, to avoid skipping pages with fast clicks. `isPending` is the *first-load* state, `isFetching` is any request. Without a library you'd write the request lifecycle, caching and race handling by hand (2.1).

### M6 · "In view" hook for infinite scroll

**Task:** load the next page when a sentinel element at the bottom of the list scrolls into view.

```tsx
export function useInView<T extends Element>(onEnter: () => void) {
  const ref = useRef<T>(null);
  const onEnterEvent = useEffectEvent(onEnter);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onEnterEvent(); },
      { rootMargin: '200px' },                                // start loading before it is actually visible
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function InfiniteList({ load }: { load: (cursor: number) => Promise<{ items: string[]; next?: number }> }) {
  const [items, setItems] = useState<string[]>([]);
  const [next, setNext] = useState<number | undefined>(0);
  const loading = useRef(false);

  async function loadMore() {
    if (loading.current || next === undefined) return;        // one request at a time, and stop at the end
    loading.current = true;
    try {
      const page = await load(next);
      setItems((l) => [...l, ...page.items]);
      setNext(page.next);
    } finally {
      loading.current = false;
    }
  }
  const sentinel = useInView<HTMLDivElement>(loadMore);
  return (
    <div>
      <ul>{items.map((i) => <li key={i}>{i}</li>)}</ul>
      {next !== undefined && <div ref={sentinel} />}
    </div>
  );
}
```

We checked: two simultaneous intersection events caused **one** request, the sentinel disappears after the last page, and the observer is disconnected on unmount.

**Talking points:** `IntersectionObserver` instead of a scroll handler (which fires constantly). The `loading` **ref** guards against duplicate requests (a ref, because it must change *without* re-rendering and be read synchronously). `useEffectEvent` lets the observer always call the **latest** `loadMore` (with the latest `next`) without recreating the observer. The effect has an empty dependency array because the sentinel exists from the first render. If it were conditional, use a **ref callback** instead. The TanStack Query version is `useInfiniteQuery` + this hook calling `fetchNextPage`. For thousands of rows, add virtualisation.

## 4.3 Hard problems

### H1 · A generic, reusable data table

**Task:** `<DataTable rows columns>` for any row type. Text filter, click-to-sort, pagination. Must not mutate its props.

```tsx
export interface Column<T> { key: keyof T & string; header: string }

export function DataTable<T extends Record<string, unknown>>({ rows, columns, pageSize = 10 }: {
  rows: T[]; columns: Column<T>[]; pageSize?: number;
}) {
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q))) : rows;
    if (!sort) return filtered;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {                     // copy: never sort props or state in place
      const x = a[sort.key] as any, y = b[sort.key] as any;
      return (x < y ? -1 : x > y ? 1 : 0) * dir;
    });
  }, [rows, filter, sort]);

  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  const current = Math.min(page, pageCount);                  // clamp if the data shrank
  const pageRows = visible.slice((current - 1) * pageSize, current * pageSize);

  const sortBy = (key: string) => {
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
    setPage(1);                                               // reset in the event handler, not in an effect
  };

  return (
    <div>
      <input placeholder="Filter" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} />
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} onClick={() => sortBy(c.key)}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => (
            <tr key={i}>{columns.map((c) => <td key={c.key}>{String(row[c.key])}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <button onClick={() => setPage(current - 1)} disabled={current === 1}>Prev</button>
      <span>{current} / {pageCount}</span>
      <button onClick={() => setPage(current + 1)} disabled={current >= pageCount}>Next</button>
    </div>
  );
}
```

```tsx
<DataTable rows={users} columns={[{ key: 'name', header: 'Name' }, { key: 'age', header: 'Age' }]} />
```

We checked: 25 rows with a page size of 10 gives "1 / 3". After going to page 3 and typing a filter it resets to "1 / 1". Sorting twice gives `aria-sort="descending"` with the right first row, and the input array is unchanged after all that.

**Talking points**

- **Derived pipeline**: `visible` is computed from `rows`, `filter` and `sort`. Nothing is stored twice. `useMemo` is reasonable here (the dataset may be big). With the Compiler you could drop it.
- **Resetting the page**: do it in the **event handlers** that change the filter or sort, not in an effect (`useEffect(() => setPage(1), [filter])` costs an extra render). Clamping with `Math.min(page, pageCount)` also protects against data that shrinks. If `rows` itself is replaced, the parent can give the table a `key`.
- **`.sort()` mutates**. Sorting `rows` directly would reorder the *parent's* array. Copy first.
- **Generics**: `T extends Record<string, unknown>` and `keyof T & string` keep column keys type-safe.
- **`key={i}`** for the rows is acceptable *in this read-only table* (rows have no state). With stateful rows (inputs, expanded details), use a real id.
- **Scaling**: past a few thousand rows use server-side filter/sort/page (the M5 pattern), or virtualise (TanStack Virtual). Extensions: custom cell renderers (`render?: (row) => ReactNode` on the column), multi-sort, selection, column resize.

### H2 · API client with token refresh

**Task:** attach a token to every request. On `401`, refresh the token **once** (even when many requests fail together), retry the failed request, and never loop on the refresh call itself.

```tsx
export function createApi(auth: { getToken: () => string | null; refresh: () => Promise<string> }) {
  let refreshing: Promise<string> | null = null;
  const refresh = () => (refreshing ??= auth.refresh().finally(() => { refreshing = null; }));   // one refresh for everyone

  async function request(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
    const token = auth.getToken();
    const res = await fetch(url, {
      ...init,
      headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    if (res.status === 401 && !retried && !url.startsWith('/auth/')) {
      await refresh();
      return request(url, init, true);                        // retry exactly once with the new token
    }
    return res;
  }
  return { request };
}
```

We tested with three parallel requests that all get `401`: **one** refresh call, and all three succeed on the retry with the new token. We also tested that a retry that is *also* `401` returns the `401` after exactly 2 calls (no infinite loop).

**Talking points:** **the race**: ten requests fire, all get `401`. Without sharing, you refresh ten times (and with rotating refresh tokens, nine of those fail and the user is logged out). The shared in-flight promise fixes it, and clearing it in `finally` allows a later refresh. **No loop**: skip `/auth/` URLs and retry once. **If the refresh fails**: clear the session and redirect to login. **Security**: prefer a refresh token in an `HttpOnly` cookie and an in-memory access token. It's a plain module, so you can use it from TanStack Query's `queryFn`, from a Redux thunk or from a component.

### H3 · Undo / redo

**Task:** a reusable `useHistory` hook with `set`, `undo`, `redo`, `canUndo`, `canRedo`.

```tsx
type History<T> = { past: T[]; present: T; future: T[] };
type HistoryAction<T> = { type: 'set'; value: T } | { type: 'undo' } | { type: 'redo' };

function historyReducer<T>(s: History<T>, a: HistoryAction<T>): History<T> {
  switch (a.type) {
    case 'set': return { past: [...s.past, s.present], present: a.value, future: [] };   // a new edit clears redo
    case 'undo': {
      if (!s.past.length) return s;
      return { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] };
    }
    case 'redo': {
      if (!s.future.length) return s;
      return { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) };
    }
  }
}

export function useHistory<T>(initial: T) {
  const [state, dispatch] = useReducer(
    historyReducer as (s: History<T>, a: HistoryAction<T>) => History<T>,
    { past: [], present: initial, future: [] },
  );
  return {
    value: state.present,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    set: useCallback((value: T) => dispatch({ type: 'set', value }), []),
    undo: useCallback(() => dispatch({ type: 'undo' }), []),
    redo: useCallback(() => dispatch({ type: 'redo' }), []),
  };
}
```

**Talking points:** this is a textbook **`useReducer`** case: the transitions are interrelated, pure and testable without React. A **new edit clears the redo stack**. State is immutable, which makes snapshots safe. `dispatch` is stable, so the returned functions can be stable too. For large state, cap the history length or store patches. The cast on `historyReducer` is only there because TypeScript can't pass a generic function to `useReducer` and infer `T`.

### H4 · Optimistic update with `useOptimistic`

**Task:** toggle a todo instantly, send the request, and if it fails, undo the change and tell the user.

```tsx
export function OptimisticTodos({ initial, save }: {
  initial: Todo[]; save: (id: number, done: boolean) => Promise<void>;
}) {
  const [todos, setTodos] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, toggleOptimistic] = useOptimistic(todos, (current, id: number) =>
    current.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  function toggle(id: number) {
    const target = todos.find((t) => t.id === id)!;
    startTransition(async () => {
      setError(null);
      toggleOptimistic(id);                                   // shown immediately
      try {
        await save(id, !target.done);
        startTransition(() => setTodos((l) => l.map((t) => (t.id === id ? { ...t, done: !t.done } : t))));  // real state, wrapped after the await
      } catch {
        setError('Could not save. Your change was undone.');  // the optimistic value reverts by itself
      }
    });
  }
  return (
    <div>
      <ul>
        {optimistic.map((t) => (
          <li key={t.id}><input type="checkbox" checked={t.done} onChange={() => toggle(t.id)} aria-label={t.title} /></li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
```

We checked both paths: on success the box is checked at once and stays checked; on failure it is checked at once, then **reverts automatically** when the action finishes, and the message appears.

**Talking points:** **the optimistic value is temporary**. It's layered on top of real state *while the action runs*, so rollback is automatic: you only update the real state on success. **The `startTransition` after the `await` is required** (2.8): without it we measured the list showing the item twice for a moment. Weak point to mention: two quick toggles can interleave. Fixes: disable the row while pending, or queue the requests per id. The **TanStack Query version** uses `onMutate`, `onError` rollback and `onSettled` invalidation (3.1), and is the better fit if you already use it.

## 4.4 Find the bug

For each snippet, say what is wrong, why, and the fix. Those marked ✔ were reproduced in a real React 19.3 project.

**1. A component defined inside a component** ✔

```tsx
function Parent() {
  const [n, setN] = useState(0);
  function Child() {                       // ❌ a new component type on every render
    const [v, setV] = useState('');
    return <input value={v} onChange={(e) => setV(e.target.value)} />;
  }
  return <><button onClick={() => setN(n + 1)}>re-render</button><Child /></>;
}
```

`Child` is a **new function each render**, so React sees a different component type, destroys the old instance and mounts a new one. State and focus are lost whenever `Parent` renders (typed text was cleared as soon as the parent re-rendered). Move `Child` to module level and pass props.

**2. `0` shows up on the page** ✔

```tsx
{items.length && <List items={items} />}   // ❌ renders the number 0 when empty
```

`0 && x` evaluates to `0`, and React renders numbers. Use `items.length > 0 && ...`, or a ternary.

**3. State initialised from a prop** ✔

```tsx
function Card({ name }: { name: string }) {
  const [n] = useState(name);               // ❌ only the first value is ever used
  return <p>{n}</p>;
}
```

`useState` uses its argument only on the first render, so later prop changes are ignored. Use the prop directly, or give the component a `key={name}` to reset it.

**4. A conditional hook** ✔

```tsx
function C({ on }: { on: boolean }) {
  if (on) useState(0);                     // ❌
  useState(1);
}
```

Hook calls are matched by order. When the order changes, React throws *"Rendered more hooks than during the previous render"* (we triggered it). Move the condition *inside* the hook, or into a child component.

**5. An unstable dependency** ✔

```tsx
const options = { a: 1 };                  // ❌ a new object each render
useEffect(() => { connect(options); }, [options]);
```

The effect re-runs after *every* render (three runs after two clicks, plus the mount). Move `options` outside the component, build it inside the effect, depend on its primitives, or memoise it.

**6. `setState` during render** ✔

```tsx
function C() {
  const [n, setN] = useState(0);
  setN(n + 1);                             // ❌ every render triggers another render
  return <p>{n}</p>;
}
```

React throws *"Too many re-renders"*. Update state in an event handler or an effect. An unconditional `setState` inside an effect that depends on that state doesn't throw, it **loops forever**. We saw the test hang, which is worse than an error.

**7. `onClick={fn()}`** ✔

```tsx
<button onClick={handleClick()}>OK</button>   // ❌ runs during render
```

It calls the function at render time and passes its *result* as the handler. Write `onClick={handleClick}` or `onClick={() => handleClick(id)}`.

**8. An `async` effect callback** ✔

```tsx
useEffect(async () => { const d = await load(); setData(d); }, []);    // ❌
```

An `async` function returns a Promise, but React expects nothing or a cleanup function. React warns *"An effect function must not return anything besides a function"*, and in our test **unmounting threw `destroy is not a function`**. Define an async function inside the effect and call it:

```tsx
useEffect(() => { let ignore = false; (async () => { const d = await load(); if (!ignore) setData(d); })(); return () => { ignore = true; }; }, []);
```

**9. Derived state in an effect** ✔

```tsx
const [total, setTotal] = useState(0);
useEffect(() => { setTotal(items.reduce((a, b) => a + b, 0)); }, [items]);   // ❌
```

The component renders with the stale `total` (0), then renders again after the effect. Compute during render: `const total = items.reduce(...)`.

**10. A new object as context value** ✔

```tsx
<Ctx value={{ user, setUser }}>{children}</Ctx>        // ❌ new object every render
```

Every consumer re-renders whenever the provider's parent does, even with `memo`. Memoise the value (or let the Compiler do it), or split the context.

**11. `key={Math.random()}`** ✔

```tsx
{items.map((i) => <Row key={Math.random()} item={i} />)}   // ❌
```

A new key each render means every row is unmounted and remounted every time. State, focus and animations are lost, and it is slow. Use a stable id.

**12. The index key** ✔

```tsx
{items.map((item, i) => <Row key={i} item={item} />)}      // ❌ when the list can change
```

Delete the first row and the second row's component takes over position 0's state. We typed into row A, removed A, and row B then showed A's text. Use `key={item.id}`.

**13. Stale closure in an interval** ✔

```tsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);   // ❌ count is always the first render's value
  return () => clearInterval(id);
}, []);
```

The counter sticks at 1 (we ran it for five ticks and it reached 1, where the functional update reached 5). Use `setCount((c) => c + 1)`.

**14. A race condition in a fetch effect** ✔

```tsx
useEffect(() => { fetchUser(id).then(setUser); }, [id]);     // ❌
```

If the response for the *old* `id` arrives last, it overwrites the newer one. Cancel with `AbortController`, or use an `ignore` flag in the cleanup (we reproduced the late response being dropped).

**15. Mutating state** ✔

```tsx
list.push(item); setList(list);                              // ❌ same reference: React bails out
```

Nothing re-renders (we counted the renders). A later unrelated update then makes the mutation appear "by accident", which is the worst kind of bug. Use `setList([...list, item])`.

**16. An optimistic update without `startTransition` after `await`** ✔

```tsx
startTransition(async () => {
  addOptimistic('new');
  await save();
  setItems((l) => [...l, 'new']);                            // ❌ not part of the transition
});
```

The real state commits while the optimistic overlay is still applied, so the item appears twice for a moment (we saw a length of 2). Wrap the update after the `await` in `startTransition` again.

**17. Errors in event handlers**

```tsx
<ErrorBoundary fallback={<p>Oops</p>}><button onClick={() => { throw new Error('x'); }}>go</button></ErrorBoundary>
```

The fallback never appears. Boundaries catch errors **during rendering**, not in event handlers (we confirmed the error went to `window.onerror` and the boundary stayed hidden). Use `try/catch` and set error state.

**18. Missing cleanup**

```tsx
useEffect(() => { window.addEventListener('resize', onResize); }, []);   // ❌ never removed
```

The listener outlives the component, and StrictMode shows it by registering it twice. Return a cleanup that calls `removeEventListener`.

## 4.5 Scenario and design questions

Answer each in 60 to 90 seconds. A good shape is: **requirements, structure, data flow, edge cases, trade-offs**.

**A multi-step form wizard (5 steps, can go back, resumable).**
One parent owns the form state with `useReducer` (or a store), and a `step` index (or a route per step so the browser Back button works). Each step validates its own slice, and "Next" is disabled until it is valid. Keep earlier steps' state when going back, either by lifting state up or by rendering steps in `<Activity>`. Persist the draft to `sessionStorage` or the server for resume. Lazy-load heavy steps, and warn about unsaved changes (`useBlocker` in React Router).

**The dashboard is slow.**
Measure first (React DevTools Profiler, browser Performance tab, Web Vitals). Typical culprits: state too high up so everything re-renders, big lists without virtualisation, expensive work in render, context churn, a huge bundle, unoptimised images, and too many requests. Fix the largest cost first: move state down, `memo` or the Compiler, virtualise, `lazy` the below-the-fold widgets, cache with TanStack Query, and move heavy work to a Web Worker. Add bundle budgets so it doesn't regress.

**Authentication end to end.**
Login form (a Server Action or a mutation), a session cookie or tokens (`HttpOnly` cookie preferred), an API client that attaches credentials and refreshes on `401` once (H2), an auth context or query for the current user, a protected-route layout that redirects to login and returns the user to where they were, role-based UI, and logout that clears caches. The server is the authority: client guards are for UX only.

**Migrating a class-component and Redux codebase to modern React.**
Upgrade React one major at a time, keeping it green. Use `StrictMode` to expose unsafe patterns. Convert components **leaf-first and feature by feature** (not a big bang). Replace HOCs and `connect` with hooks, Redux with RTK (slices first, then maybe move server data to TanStack Query), remove `defaultProps`/`propTypes`, and migrate `forwardRef` when convenient. Switch from Create React App to Vite. Add the React Compiler later, once the code follows the rules. Keep class **error boundaries** (or use `react-error-boundary`).

**Real-time data (WebSocket or SSE).**
Wrap the connection in a custom hook or store, with reconnection and backoff, and clean up on unmount (and handle StrictMode's double mount). Use `useSyncExternalStore` to subscribe, or push messages into the TanStack Query cache with `setQueryData`. Handle ordering, missed messages after reconnect (resync from a cursor), and what the UI shows while disconnected.

**A table with 10,000 rows.**
Don't render 10,000 DOM rows. Server-side pagination or filtering if you control the API. Otherwise **virtualise** (TanStack Virtual / react-window), `memo` the rows with stable props, key by id, and avoid per-row inline objects. Keep selection as a `Set` of ids in one place, not on every row.

**A shared component library across several apps.**
A separate package with TypeScript types, small composable components (compound components and slots over dozens of props), accessibility built in (build on Radix/React Aria for the hard widgets), design tokens as CSS variables, **Storybook** for docs and visual tests, tests per component, semantic versioning with a changelog, and `peerDependencies` on `react`. Support controlled and uncontrolled use.

**Feature flags and A/B tests.**
A flags context (or store) loaded before the first render, a `useFlag('x')` hook, and a `<Feature flag="x">` wrapper. Gate whole routes with lazy loading. With SSR, evaluate the flags on the server so the first render matches the client (otherwise: hydration mismatch and flicker).

**Error handling across the app.**
Root and per-section error boundaries, a reporter wired into `createRoot`'s `onCaughtError`/`onUncaughtError`, query/mutation error states with retry, `try/catch` in event handlers, a toast system for user-facing messages, and a monitoring service (Sentry). Never swallow errors silently.

**You own a form-heavy app. How do you keep it maintainable?**
React Hook Form + Zod with one schema per form, reusable field components that handle label, error and `aria-*` wiring, shared validators, forms separated from API DTOs by mapping functions, and tests on validation logic. For simple mutations, use React 19 Actions rather than a library.

### What to do when you get stuck

- Say what you *would* do: "I'd normally use TanStack Query here." Naming the right tool counts for a lot.
- Write the **types or data shape** first. It forces a decision and gives you something concrete.
- Start with a hard-coded, working version and make it dynamic. A working simple version beats a half-finished clever one.
- If you see a React warning or error, **read it aloud**. React's messages ("Too many re-renders", "Rendered more hooks…", "Each child in a list should have a unique key") are specific, and interviewers like to see you debugging calmly.
