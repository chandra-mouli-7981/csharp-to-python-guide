# Level 1 · Foundations

## 1.1 JSX

JSX is **syntax that looks like HTML but is JavaScript**. A build tool (Babel, SWC, esbuild) turns it into function calls that create *elements* (plain objects describing UI).

```tsx
const el = <h1 className="title">Hello, {name}</h1>;
// roughly: jsx('h1', { className: 'title', children: ['Hello, ', name] })
```

**Rules and differences from HTML**

| Rule | Example |
|---|---|
| A component returns **one root** (use a fragment) | `<>...</>` or `<Fragment key={id}>` |
| `{}` embeds any JavaScript **expression**, not a statement | `{items.length}`, `{cond ? a : b}`. No `if` or `for` inside |
| Attributes are camelCase | `className`, `htmlFor`, `onClick`, `tabIndex` |
| Every tag must be closed | `<input />`, `<br />` |
| `style` takes an object | `style={{ color: 'red', fontSize: 14 }}` |
| Components start with a **capital letter** | `<Card />` is a component, `<card />` is an HTML tag |
| Booleans/`null`/`undefined` render **nothing** | `{false}` renders nothing. **`{0}` renders `0`** |

**Why `{count && <List />}` is a classic bug:** when `count` is `0`, the expression is `0`, and React renders the number. Write `{count > 0 && <List />}`, or use a ternary.

**Is JSX safe from XSS?** Yes by default. Values embedded in `{}` are **escaped** before they reach the DOM. The risk comes from `dangerouslySetInnerHTML`, from `href={userInput}` (a `javascript:` URL), and from your own code. See 3.9.

## 1.2 Components and props

A component is a **function that takes props and returns UI**. It must be a **pure function of its props and state**: same input, same output, no side effects while rendering.

```tsx
type ButtonProps = { label: string; onClick: () => void; disabled?: boolean };

function Button({ label, onClick, disabled = false }: ButtonProps) {
  return <button onClick={onClick} disabled={disabled}>{label}</button>;
}
```

- **Props are read-only.** Never do `props.x = 1`. If a child needs to change something, the parent passes a callback.
- **Defaults** use JavaScript default values in the destructuring. (`Component.defaultProps` was removed for function components in React 19.)
- **`children`** is a special prop for the content between the tags (see 1.10).
- **Spreading props**: `<Input {...rest} />` is convenient for wrapper components, but it forwards everything. Be deliberate.
- In React 19, **`ref` is just a prop** for function components. No `forwardRef` needed:

```tsx
function TextInput({ ref, ...props }: React.ComponentProps<'input'>) {
  return <input ref={ref} {...props} />;
}
```

**Never define a component inside another component.** Each render creates a *new* component type, so React throws the old one away and mounts a new one: its state and DOM are lost on every parent render (a bug we reproduce in 4.4). Define components at module level and pass data as props.

## 1.3 State

State is **memory a component keeps between renders**. A normal variable resets every render, and changing it doesn't trigger one. `useState` does both.

```tsx
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Clicked {count} times</button>;
}
```

### State is a snapshot

Inside one render, `count` **never changes**. `setCount` schedules a new render with a new value; it doesn't update the variable you're holding.

```tsx
function handleClick() {
  setCount(count + 1);
  setCount(count + 1);
  setCount(count + 1);
}   // count goes up by 1, not 3: all three calls use the same snapshot (count = 0)

function handleClick() {
  setCount((c) => c + 1);
  setCount((c) => c + 1);
  setCount((c) => c + 1);
}   // count goes up by 3: each updater receives the latest queued value
```

**Rule of thumb:** when the new state depends on the previous state, use the **functional updater**.

### Updating objects and arrays: never mutate

React decides whether to re-render by comparing the new state to the old one **by reference** (`Object.is`). Mutating in place keeps the same reference, so React bails out and nothing updates.

```tsx
// ❌ mutation: same array, no re-render
list.push(item); setList(list);

// ✅ new array
setList([...list, item]);                              // add
setList(list.filter((x) => x.id !== id));              // remove
setList(list.map((x) => (x.id === id ? { ...x, done: true } : x)));   // update one
setUser({ ...user, address: { ...user.address, city: 'Pune' } });     // nested object
```

If the nested copying gets painful, use **Immer** (`useImmerReducer`, or Redux Toolkit, which has it built in) so you can write "mutating" code that produces immutable updates.

### Other `useState` details

- **Lazy initial state:** `useState(() => expensive())` runs the function **once**. `useState(expensive())` calls it on every render and throws the result away.
- **`useState(props.x)` only reads the prop on the first render.** Later prop changes are ignored. Either derive the value from props directly, or reset the state with a `key` (see 1.9).
- **Bail-out:** setting state to the same value (by `Object.is`) doesn't re-render.
- **Batching:** since React 18, updates are batched everywhere (event handlers, timeouts, promises). Several `setState` calls in one tick cause **one** render.

### What belongs in state?

Keep state **minimal**. Don't store what you can compute:

| Don't store | Compute instead |
|---|---|
| `filteredItems` (when you have `items` and `filter`) | `const filtered = items.filter(...)` during render |
| `fullName` (when you have first and last) | `const fullName = first + ' ' + last` |
| A copy of a prop | Use the prop |
| `selectedItem` (an object) when you have a list | Store `selectedId`, then `items.find(...)`. It can't go stale |

## 1.4 Events

```tsx
<button onClick={handleClick}>OK</button>            // ✅ pass the function
<button onClick={() => remove(id)}>Delete</button>   // ✅ wrap it to pass arguments
<button onClick={handleClick()}>OK</button>          // ❌ calls it during render
```

- Handlers receive a **SyntheticEvent**, a cross-browser wrapper that has the usual `preventDefault()`, `stopPropagation()` and `target`.
- React attaches its listeners at the **root**, not on each element (event delegation), and events **bubble** like in the DOM. Use `onClickCapture` for the capture phase.
- **Event handlers can have side effects.** That is what they are for. (Rendering can't.)
- **An error thrown in an event handler is not caught by an error boundary.** Boundaries catch errors during *rendering*. Wrap handlers in `try/catch` and set state to show an error.
- A handler is a **closure over the render that created it** (the snapshot idea again). That is why a `setTimeout` inside a handler sees old state.

Typing in TypeScript: `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent<HTMLButtonElement>`, `React.FormEvent<HTMLFormElement>`.

## 1.5 Lists and keys

```tsx
<ul>
  {todos.map((t) => <li key={t.id}>{t.title}</li>)}
</ul>
```

**What is `key` for?** It tells React **which item is which** between renders, so it can reuse the right DOM node and component state, and move nodes instead of rebuilding them.

| Key choice | Result |
|---|---|
| A stable id from your data (`t.id`) | ✅ Correct |
| The array index | ⚠️ OK for a static list that is never reordered, filtered or inserted into. **Wrong otherwise** |
| `Math.random()` or a new id each render | ❌ Every item is remounted on every render. State and focus are lost |

**The index-key bug:** delete the first item from a list of inputs keyed by index, and the *second item's component instance takes over the first's key*. Typed text and other state **stays at the position, not with the item**. With `key={item.id}` it follows the item correctly (reproduced in 4.4).

Keys must be **unique among siblings** (not globally) and are **not passed as a prop** (`props.key` is `undefined`). Put the key on the outermost element returned in the `map`, and on `<Fragment key={...}>` when you need a fragment.

## 1.6 Conditional rendering

```tsx
if (loading) return <Spinner />;                       // early return
return (
  <>
    {error && <ErrorMessage error={error} />}          // && when there is no else
    {user ? <Profile user={user} /> : <LoginButton />} // ternary for either/or
    {items.length > 0 && <List items={items} />}       // NOT {items.length && ...}
  </>
);
```

- **Hiding vs unmounting:** `{show && <Panel />}` **unmounts** the panel, so its state is lost. CSS `display: none` keeps the DOM and state but still runs its effects. React 19.2's **`<Activity mode="hidden">`** hides the UI, **keeps the state**, and *cleans up the effects* while hidden (see 2.9).
- For several states (idle, loading, error, success), model them as one **discriminated union** and `switch` on it, instead of several booleans that can contradict each other:

```tsx
type State = { status: 'loading' } | { status: 'error'; error: Error } | { status: 'ok'; data: User[] };
```

## 1.7 Forms: controlled and uncontrolled

**Controlled:** React state is the source of truth, and the input shows `value` and updates through `onChange`.

```tsx
const [email, setEmail] = useState('');
<input value={email} onChange={(e) => setEmail(e.target.value)} />
```

**Uncontrolled:** the DOM keeps the value. You read it when you need it (a `ref`, or `FormData` on submit).

```tsx
function onSubmit(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  const data = new FormData(e.currentTarget);
  save(Object.fromEntries(data));
}
<form onSubmit={onSubmit}><input name="email" defaultValue="" /></form>
```

| | Controlled | Uncontrolled |
|---|---|---|
| Live validation, formatting, dependent fields | ✅ Easy | Harder |
| Re-renders on every keystroke | Yes | No |
| Simple "read on submit" forms, file inputs | More code than needed | ✅ Simple |
| Initial value | `value` | `defaultValue` |

- Switching an input from uncontrolled to controlled (`value` going from `undefined` to a string) gives a warning. Initialise state with `''`, not `undefined`.
- A `value` **without** `onChange` makes the input read-only (React warns).
- **React 19 form Actions** (`<form action={fn}>`) are an uncontrolled-by-default option that handles pending state, errors and resets for you. See 2.8.
- For large forms, libraries such as **React Hook Form** (uncontrolled under the hood, fewer re-renders) with **Zod** for validation are the common choice. Know *why*, rather than just the names (3.2).

## 1.8 How rendering works

Three phases: **trigger → render → commit**.

1. **Trigger:** the first render (`createRoot(el).render(<App />)`), or a **state update** in a component (or a parent re-render, or a context change).
2. **Render:** React calls your component functions to compute the new tree. This must be **pure**: no DOM access, no mutation, no network calls.
3. **Commit:** React applies the *minimal* set of DOM changes, runs layout effects, lets the browser paint, then runs regular effects.

**What makes a component re-render?**

1. Its own **state** changed.
2. Its **parent re-rendered**. **Children re-render even if their props are identical**, unless wrapped in `memo` (or compiled by the React Compiler).
3. A **context** it reads changed (`memo` doesn't stop this).

What does **not** cause a re-render: changing a `ref`, a plain variable, or mutating state in place.

> **Re-rendering is not the same as touching the DOM.** A render is a JavaScript calculation. Only *differences* reach the DOM. Re-renders are usually cheap, and "optimise" only after measuring.

**Why must render be pure?** React may call your component more than once, pause it, throw the result away, or run it in a different order (concurrent rendering, Suspense, transitions). In development, **StrictMode renders every component twice** and also runs each effect's setup, cleanup, setup again, to *expose* impure code. If it behaves differently the second time, it has a bug (reproduced in 4.4). StrictMode does nothing in production.

```tsx
let counter = 0;
function Bad() { counter++; return <p>{counter}</p>; }      // ❌ mutates something outside while rendering
```

## 1.9 Reconciliation: how React decides to keep or rebuild

When a component re-renders, React compares the **new element tree to the previous one** (the "diff"):

- **Same type at the same position** → keep the instance and its state, update the changed props/attributes.
- **Different type at the same position** → **destroy** the old subtree (state lost) and build a new one.
- For **lists**, items are matched by **`key`**.

Two consequences you can use deliberately:

```tsx
// 1. A `key` resets state: change the key, get a fresh instance
<Profile key={userId} userId={userId} />      // a new user means brand-new state, no stale form data

// 2. Position matters: this does NOT reset, because it's the same type in the same spot
{isAdmin ? <Panel role="admin" /> : <Panel role="user" />}
```

**Resetting state on a prop change** is the one place a `key` beats an effect. Don't write `useEffect(() => setDraft(''), [userId])`; use `key={userId}` (see 2.4).

## 1.10 Composition and sharing state

**`children` and composition.** Prefer composition over inheritance and over a long list of props. Let the parent decide what goes inside:

```tsx
function Card({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      <div>{children}</div>
      {footer && <footer>{footer}</footer>}
    </section>
  );
}

<Card title="Profile" footer={<button>Save</button>}><Avatar /><Bio /></Card>
```

Passing **components or elements as props** ("slots") like `footer` is React's version of Angular's named content projection.

**Lifting state up.** If two components need the same data, move the state to their **closest common parent** and pass the value and a setter down. Keep state **as close as possible** to where it's used, and no higher.

**Prop drilling** (passing props through many layers that don't use them) has fixes, in this order:

1. **Composition**: pass the *rendered element* (`<Avatar user={user} />`) down as `children`/a prop, so the middle layers never see `user`.
2. **Context** for data many components need (theme, current user, locale).
3. **A state library** (Zustand, Redux Toolkit) for complex, frequently changing global state.

**Container / presentational split.** A "container" fetches data and holds state, a "presentational" component just renders props. Hooks have mostly replaced this with *custom hooks* (2.5), but it is still a useful way to talk about it.

## 1.11 Class components (legacy)

You will see them in older code, and in **error boundaries**, which still require a class. Know the mapping:

| Class | Hooks equivalent |
|---|---|
| `this.state`, `this.setState` | `useState`, `useReducer` |
| `componentDidMount` | `useEffect(() => {...}, [])` |
| `componentDidUpdate` | `useEffect` with dependencies |
| `componentWillUnmount` | The cleanup function returned from `useEffect` |
| `shouldComponentUpdate`, `PureComponent` | `memo` |
| `static getDerivedStateFromError`, `componentDidCatch` | **No hook equivalent.** Error boundaries are still classes (or use the `react-error-boundary` library) |

Why hooks won: logic can be **shared without wrappers** (custom hooks instead of HOCs and render props), related code stays together (a subscription and its cleanup in one place), and there is no `this`.

## 1.12 Quick-fire Q&A (Foundations)

**What is the virtual DOM?** A lightweight JavaScript description of the UI (the element tree). React compares the new tree with the previous one and updates only the real DOM nodes that changed. It is a means to a declarative model, not magic speed.

**Props vs state?** Props are passed *in* by the parent and are read-only. State is owned by the component and changes over time. Changing either triggers a render.

**Why shouldn't you mutate state?** React compares references to detect change, so a mutated object looks unchanged, and it also breaks `memo`, effects' dependency checks, and anything that relies on previous values (undo, `useOptimistic` rollbacks).

**Why are keys needed?** To identify items across renders, so React preserves the right component state and moves nodes rather than recreating them.

**Is it bad to use the index as a key?** Only when the list can be reordered, filtered or have items added or removed in the middle. It's fine for a static list.

**What is the difference between controlled and uncontrolled components?** Controlled: React state drives the input's value. Uncontrolled: the DOM holds it, and you read it with a ref or `FormData`.

**What is lifting state up?** Moving shared state to the closest common ancestor and passing it down with callbacks to change it.

**Why do hooks have rules?** React stores hook state in an ordered list per component and matches each call by its **position**. Calling hooks conditionally or in loops would change the order, and state would attach to the wrong hook.

**What does StrictMode do?** In development it double-invokes renders and effect setup/cleanup to reveal impure code and missing cleanups. It doesn't affect production.

**Does `setState` update the value immediately?** No. State is a snapshot for that render. The new value shows up in the next render. Use the functional form for updates based on the previous value.

**Why does my child re-render when the parent does?** React re-renders children by default. `memo` (with stable props) or the React Compiler skips it. Measure before adding either.

**How do you reset a component's state?** Give it a different `key`.

**What is the difference between an element and a component?** A component is a function (or class). An element is the plain object `<Component />` evaluates to: a description of what to render.

**What is a fragment?** `<>...</>`, a way to return several siblings without an extra DOM node.

**How do you render raw HTML?** `dangerouslySetInnerHTML={{ __html: html }}`, and only with HTML you've sanitised (for example with DOMPurify).
