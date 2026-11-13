# Level 2 · Core

## 2.1 Signals

A **signal** is a wrapper around a value that tells Angular (and anything else that reads it) when the value changes. Reading a signal is a function call: `count()`.

```ts
import { signal, computed, effect } from '@angular/core';

const count = signal(0);                 // WritableSignal<number>
count.set(5);                            // replace
count.update((c) => c + 1);              // derive from the previous value
console.log(count());                    // 6

const double = computed(() => count() * 2);   // read-only, derived
```

### `computed`: derived state

- **Lazy**: it does not run until someone reads it.
- **Memoised**: it re-runs only if a signal it read has changed.
- **Dynamic dependencies**: it tracks whatever it actually read during the last run.
- **Read-only**: you cannot `.set()` it.

I verified all three behaviours: a `computed` that had not been read ran zero times, two reads ran it once, and when a branch was not taken, changing the signal in the untaken branch did not trigger a recompute.

```ts
const flag = signal(true);
const a = signal('A');
const b = signal('B');
const shown = computed(() => (flag() ? a() : b()));
shown();          // reads flag and a
b.set('B2');      // b was not read, so shown does not recompute
flag.set(false);
shown();          // 'B2'
```

### Equality and the immutability rule

A signal notifies only when its value changes by `Object.is` (reference for objects, value for primitives). **Mutating an object or array in place does not notify.**

```ts
const list = signal<number[]>([1]);
const len = computed(() => list().length);
len();                              // 1
list().push(2);                     // mutation: signal does not know
len();                              // still 1 (stale!)
list.update((x) => [...x, 3]);      // new reference
len();                              // 3
```

That output (1, then still 1, then 3) is from a real run. Always create **new** arrays and objects: `[...arr, x]`, `{ ...obj, a: 1 }`, `arr.filter(...)`, `arr.map(...)`. You can pass `{ equal: (a, b) => ... }` to customise equality.

### `effect`: side effects, not state derivation

An effect runs a function when the signals it reads change. It is for **side effects**: logging, syncing to `localStorage`, calling a non-Angular library, drawing to a canvas.

```ts
@Component({ /* … */ })
export class Settings {
  readonly theme = signal<'light' | 'dark'>('light');

  constructor() {
    effect(() => {
      localStorage.setItem('theme', this.theme());        // re-runs when theme changes
    });
  }
}
```

Facts to know (all verified by running them):

- **An effect does not run synchronously on `.set()`.** It is scheduled and runs during change detection (in tests, after `TestBed.tick()`).
- It runs at least once, and re-runs when a signal it **read** changes.
- Wrap reads you do not want tracked in `untracked(() => …)`. I confirmed a signal read inside `untracked` did not retrigger the effect.
- Register cleanup with `onCleanup`. It runs **before the next run** and on destroy:

```ts
effect((onCleanup) => {
  const id = this.id();
  const timer = setInterval(() => poll(id), 5000);
  onCleanup(() => clearInterval(timer));          // run: start 1, cleanup 1, start 2
});
```

- An effect needs an **injection context** (constructor or field initialiser) so it is destroyed with the component. Elsewhere, pass `{ injector }`.
- Since v19 you can **write signals inside effects**: the old `allowSignalWrites` option is deprecated and no longer required. You still usually should not.

> **The anti-pattern interviewers probe:** using `effect` to copy one signal into another (`effect(() => b.set(a() * 2))`). Use `computed` (read-only derivation) or `linkedSignal` (derivation you can also override). Effects are for leaving the signal world, not for staying in it.

### `linkedSignal`: derived but writable

A `linkedSignal` is a writable signal that **resets** whenever its source changes. The classic use is "selected item that must stay valid when the list changes".

```ts
const options = signal(['a', 'b', 'c']);
const selected = linkedSignal<string[], string>({
  source: options,
  computation: (opts, previous) =>
    previous && opts.includes(previous.value) ? previous.value : opts[0],
});

selected();                 // 'a'
selected.set('c');          // user picks c
options.set(['c', 'd']);    // 'c' still exists → stays 'c'
options.set(['x', 'y']);    // 'c' is gone → resets to 'x'
```

The shorthand `linkedSignal(() => count() * 2)` behaves like a `computed` you can temporarily override with `.set()`, until the source changes again.

### Which one?

| Need | Use |
|---|---|
| Hold mutable state | `signal` |
| Derive a value from other signals | `computed` |
| Derived value the user can also override | `linkedSignal` |
| Async data from a function or URL | `resource` / `httpResource` (2.2) |
| React with a side effect (storage, logging, third-party lib) | `effect` |
| Read without subscribing | `untracked` |

### Signals vs RxJS

| | Signal | Observable |
|---|---|---|
| Has a current value | **Always** | Not necessarily |
| Read | Synchronously, `s()` | `subscribe` or `async` pipe |
| Cleanup | Automatic (garbage collected, no subscriptions) | You must unsubscribe |
| Good for | **State** and derived state | **Events over time**: HTTP, user input, WebSockets, debounce, retry |
| Operators | None (use `computed`) | Hundreds |

They interoperate (`@angular/core/rxjs-interop`):

```ts
const user = toSignal(this.http.get<User>('/api/me'));                    // Signal<User | undefined>
const withDefault = toSignal(obs$, { initialValue: [] });                 // no undefined
const synchronous = toSignal(behaviorSubject$, { requireSync: true });    // errors if it does not emit immediately
const query$ = toObservable(this.query);                                  // Observable<string>
this.query$.pipe(debounceTime(300), switchMap(q => this.api.search(q)));
```

I verified: `toSignal` of a `BehaviorSubject` reads its current value immediately, one that has not emitted is `undefined` unless you give `initialValue`, and `requireSync` reads a synchronous source. `toSignal` unsubscribes automatically when its injection context is destroyed.

**Pattern:** keep **state** in signals, convert an input signal to an Observable only where you need a time-based operator (debounce, switchMap), then convert the result back with `toSignal`.

### A service-with-signals store

```ts
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly _items = signal<CartItem[]>([]);
  readonly items = this._items.asReadonly();                         // expose read-only
  readonly total = computed(() => this._items().reduce((s, i) => s + i.price * i.qty, 0));
  readonly count = computed(() => this._items().length);

  add(item: CartItem) { this._items.update((list) => [...list, item]); }
  remove(id: number) { this._items.update((list) => list.filter((i) => i.id !== id)); }
  clear() { this._items.set([]); }
}
```

This is how most mid-sized apps manage state now, without NgRx. It is simple, testable, and reactive.

## 2.2 Async data with `resource` and `httpResource`

`resource` turns an **async function** into signals: value, loading flag, error. It re-runs automatically when the signals it depends on change. **Stable since v22** (it was experimental in v19 to v21; older tutorials call the dependency option `request`, it is now `params`).

```ts
const userId = signal(1);

const user = resource({
  params: () => ({ id: userId() }),                      // reactive: re-runs when userId changes
  loader: async ({ params, abortSignal }) => {
    const res = await fetch(`/api/users/${params.id}`, { signal: abortSignal });
    if (!res.ok) throw new Error('Failed');
    return (await res.json()) as User;
  },
});
```

```html
@if (user.isLoading()) { <app-spinner /> }
@else if (user.error()) { <p>Failed. <button (click)="user.reload()">Retry</button></p> }
@else if (user.hasValue()) { <h1>{{ user.value().name }}</h1> }
```

| Member | Meaning |
|---|---|
| `value()` | The latest value (or `undefined`) |
| `status()` | `'idle'`, `'loading'`, `'reloading'`, `'resolved'`, `'error'` or `'local'` (set manually) |
| `isLoading()` | A load or reload is in flight |
| `error()` | The error thrown by the loader |
| `hasValue()` | A value exists. Narrows `value()` in templates. **Guard with it**: reading `value()` while the resource is in the `error` state **throws** |
| `reload()` | Force a re-run |
| `set()` / `update()` | Override the value locally (optimistic update, status becomes `'local'`) |

Behaviours I confirmed by running it: the loader ran once initially, once more when `userId` changed, and once more on `reload()`. If `params` returns `undefined`, the resource stays **`idle`** and the loader is **not called**, which is how you say "do not fetch yet". A new run **aborts** the previous one via `abortSignal`, so stale responses cannot overwrite fresh ones (this fixes the classic race condition).

**`httpResource`** is `resource` built on `HttpClient` (so interceptors, testing and SSR transfer cache work):

```ts
export class UserDetail {
  readonly id = input.required<number>();

  readonly user = httpResource<User>(() => `/api/users/${this.id()}`);        // GET, reactive to id()

  readonly search = httpResource<Page<User>>(() => ({                         // full request object
    url: '/api/users',
    params: { q: this.query(), page: this.page() },
  }));

  readonly created = httpResource<User>(() => ({ url: '/api/users', method: 'POST', body: this.draft() }));
}
```

- Return `undefined` from the function to skip the request.
- Options: `parse` (validate/transform the response, for example with Zod), `defaultValue`.
- Variants: `httpResource.text()`, `.blob()`, `.arrayBuffer()`.
- Read with `user.value()`, `user.isLoading()`, `user.error()`, `user.headers()`, `user.statusCode()`.
- I tested it with `HttpTestingController`: changing the signal from `1` to `2` issued a new request for `/api/u/2` automatically.

**`rxResource`** (from `@angular/core/rxjs-interop`) is the same idea with an Observable loader (`stream` option) for sources that emit more than once.

**When not to use `httpResource`:** for **mutations** (create/update/delete triggered by a click). `httpResource` is for *reads that depend on state*. For writes, call `HttpClient` directly and update state in `subscribe`/`firstValueFrom`.

> **Interview framing:** "`resource` solves the problem of keeping asynchronous data in sync with reactive state, including cancellation of stale requests, without hand-rolling `switchMap` pipelines."

## 2.3 Change detection

**Change detection (CD)** is how Angular finds out that data changed and updates the DOM. The questions: **when does it run, and which components get checked?**

### The traditional model (zone.js)

`zone.js` monkey-patches browser async APIs (`setTimeout`, `Promise`, DOM events, XHR). After any of them completes, it tells Angular "something may have changed", and Angular checks the **whole component tree top-down**. This is simple ("it just works"), but:

- It checks everything after every event, even when nothing relevant changed.
- It adds payload size and startup cost, and makes stack traces harder to read.
- `async`/`await` cannot be patched, so the build has to downlevel it.

### `OnPush` vs `Eager` (the old `Default`)

| | `Eager` (called `Default` before v22) | `OnPush` (**default from v22**) |
|---|---|---|
| Component is checked | Every CD run | Only when **marked dirty** |
| Marked dirty by | Always | An `@Input` **reference** changed, an event handler in the component or its template ran, `async` pipe emitted, `markForCheck()` was called, or **a signal read in the template changed** |
| Cost | Higher | Lower |

```ts
@Component({
  selector: 'app-user',
  changeDetection: ChangeDetectionStrategy.OnPush,   // optional in v22+, required in v21 and earlier to opt in
  template: `{{ user().name }}`,
})
export class UserView { user = input.required<User>(); }
```

I confirmed the v22 enum: `OnPush = 0`, `Eager = 1`, and `Default = 1` is **deprecated**.

**The classic `OnPush` bug:** mutating an object that was passed as an input (`this.user.name = 'x'`) does not change the reference, so the child does not update. Fix it by passing a new object (`{ ...user, name: 'x' }`), or use signals.

### Zoneless (stable v20.2, default for new apps from v21)

Remove `zone.js` entirely. Angular then runs change detection only when it is **notified**. The notifications are:

- A **signal read in a template** changes.
- `ChangeDetectorRef.markForCheck()` (the `async` pipe calls it for you).
- `ComponentRef.setInput()` is called.
- A **bound event listener** (host or template) runs.
- A view marked dirty is attached.

```ts
// v20: opt in. v21+: already the default for new apps.
bootstrapApplication(App, { providers: [provideZonelessChangeDetection()] });
```

I demonstrated the central rule in a real zoneless test: setting a plain field (`this.title = 'two'`) **does not update the view**, while setting a signal that the template reads **does**.

```ts
title = 'one';           // template shows {{ title }}
setTimeout(() => this.title = 'two', 1000);   // ❌ zoneless: view stays 'one'

title = signal('one');   // template shows {{ title() }}
setTimeout(() => this.title.set('two'), 1000); // ✅ view updates
```

**Migrating to zoneless**

1. Use signals for state that the template reads, or `markForCheck()` / the `async` pipe.
2. Remove uses of `NgZone.onMicrotaskEmpty`, `onStable` and `onUnstable`: they **never emit** in zoneless apps, and `NgZone.isStable` is always `true`. Use `afterNextRender`/`afterEveryRender` or direct DOM APIs instead.
3. Remove `zone.js` from `polyfills`/`angular.json`.
4. **Reactive forms** update state but do **not** notify CD by themselves: bridge with `markForCheck()` or mirror values in signals.
5. In tests, `await fixture.whenStable()` instead of `fixture.detectChanges()` loops.

Benefits: smaller bundle, better Core Web Vitals, cleaner stack traces, and `async/await` stays native. There is an `onpush_zoneless_migration` tool in the Angular MCP server for AI-assisted migration.

### `ChangeDetectorRef`

| Method | Use |
|---|---|
| `markForCheck()` | Mark this view and its ancestors dirty so they are checked in the next CD run (the standard `OnPush` fix) |
| `detectChanges()` | Run CD on this view and its children **now**, synchronously |
| `detach()` / `reattach()` | Remove or restore the view in the CD tree |
| `checkNoChanges()` | Dev-mode verification pass |

### `ExpressionChangedAfterItHasBeenCheckedError` (NG0100)

In development mode Angular runs a second pass to verify that nothing changed during CD. If a binding's value differs between the two passes, you get this error. **Typical cause:** a child changes something a parent already rendered (for example, setting a parent's property in `ngAfterViewInit`, or a getter returning a new value each call such as `new Date()` or `Math.random()`). **Fixes:** compute the value before rendering (in `ngOnInit`/`computed`), restructure so data flows down, or schedule the change after the check with `afterNextRender`. Do not "fix" it by wrapping in `setTimeout` without understanding the flow.

### Performance angles (zone mode)

`NgZone.runOutsideAngular(() => …)` runs high-frequency work (scroll, `mousemove`, animation loops, third-party chart libs) without triggering CD. In zoneless apps you do not need it. Prefer `OnPush`, signals, `track` in `@for`, pure pipes, and `computed` over template method calls.

## 2.4 RxJS

Angular uses **RxJS** for HttpClient, the router, forms' `valueChanges`, and event streams. You need to be comfortable reading and writing RxJS pipelines.

### Observable vs Promise

| | Promise | Observable |
|---|---|---|
| Values | **One** | Zero, one, or many over time |
| Start | **Eager** (runs when created) | **Lazy** (runs only when subscribed) |
| Cancel | No | **Yes** (`unsubscribe`) |
| Operators | `then`/`catch` | `map`, `switchMap`, `debounceTime`, `retry`, … |
| Multicast | Shared result | Each subscriber triggers its own execution by default (cold) |

Convert with `firstValueFrom(obs$)` / `lastValueFrom(obs$)` (to await), and `from(promise)` (to start a stream).

### Cold vs hot, and the Subject family

A **cold** observable starts a new execution per subscriber (`http.get()` fires one request per subscription). A **hot** one shares a single source (DOM events, a `Subject`). I confirmed it: two subscriptions to a cold observable ran the producer twice, and adding `shareReplay(1)` brought the total to one extra run for the shared pair.

| Type | Behaviour for a **late** subscriber |
|---|---|
| `Subject` | Gets nothing from the past, only new values |
| `BehaviorSubject(initial)` | Immediately gets the **latest** value. Always has a value |
| `ReplaySubject(n)` | Gets the last **n** values |
| `AsyncSubject` | Gets only the **last** value, on completion |

Verified: after emitting 1, 2, 3 and then subscribing late, a `Subject` received `[]`, a `BehaviorSubject` received `[3]`, and a `ReplaySubject(2)` received `[2, 3]`.

### The operators you must know

| Category | Operators |
|---|---|
| Transform | `map`, `scan` (`pluck` is deprecated, use `map`) |
| Filter | `filter`, `take`, `takeUntil`, `first`, `distinctUntilChanged`, `debounceTime`, `throttleTime` |
| Flatten (higher-order) | `switchMap`, `mergeMap`, `concatMap`, `exhaustMap` |
| Combine | `combineLatest`, `forkJoin`, `zip`, `merge`, `withLatestFrom`, `startWith` |
| Errors | `catchError`, `retry`, `throwError` |
| Utility | `tap`, `finalize`, `delay`, `shareReplay` |

### The four flattening operators (an interview favourite)

All four take each outer value, start an **inner** observable, and flatten the results. They differ in what they do when a new outer value arrives while an inner one is still running.

| Operator | New outer value arrives while inner is running | Typical use |
|---|---|---|
| **`switchMap`** | **Cancels** the old inner, switches to the new | Search-as-you-type, route param → load data. Latest wins |
| **`mergeMap`** | Runs them **in parallel**, emits as each finishes | Independent fire-and-forget work |
| **`concatMap`** | **Queues**, runs one after another, keeps order | Ordered saves, sequential writes |
| **`exhaustMap`** | **Ignores** new outer values until the current inner finishes | Login or submit button (stop double-clicks) |

I ran this experiment: values `1` then `2` arrive, where inner `r1` takes 20ms and `r2` takes 5ms. Results: `switchMap → ['r2']` (r1 cancelled), `mergeMap → ['r2','r1']` (completion order), `concatMap → ['r1','r2']`, `exhaustMap → ['r1']`.

### Combination: `combineLatest` vs `forkJoin` vs `zip`

| Operator | Emits | Completes |
|---|---|---|
| `combineLatest([a$, b$])` | Every time **any** source emits, using the latest of each, after all have emitted once | When all complete |
| `forkJoin([a$, b$])` | **Once**, with each source's **last** value | After all complete. Perfect for parallel HTTP calls |
| `zip([a$, b$])` | Pairs the 1st with the 1st, 2nd with the 2nd, … | When one runs out |

Test: `a` emits 1, 2 and `b` emits 10, 20 gave `combineLatest → [[2,10],[2,20]]` and `zip → [[1,10],[2,20]]`. `forkJoin([of(1,2), of('a','b')])` gave `[2,'b']`. **Trap:** `forkJoin` never emits if any source never completes (a `Subject`, a WebSocket, `valueChanges`).

### Error handling

```ts
this.http.get<User[]>('/api/users').pipe(
  retry({ count: 2, delay: 500 }),                          // retry transient failures
  catchError((err) => {
    this.toast.error('Could not load users');
    return of([]);                                          // fall back, stream completes normally
  }),
  finalize(() => this.loading.set(false)),                  // always runs
);
```

**Trap:** an error terminates an observable. If you put `catchError` on the **outer** stream (for example a click stream), it dies after the first error. Put `catchError` on the **inner** observable inside `switchMap` so the outer stream survives:

```ts
search$.pipe(
  switchMap((q) => this.api.search(q).pipe(catchError(() => of([])))),   // ✅ inner
);
```

### Unsubscribing and memory leaks

A subscription that outlives its component leaks memory and keeps running callbacks. **Options, best first:**

1. **Do not subscribe manually**: use the `async` pipe or `toSignal()`.
2. **`takeUntilDestroyed()`**: `source$.pipe(takeUntilDestroyed()).subscribe(...)`. In an injection context it needs no argument, otherwise pass a `DestroyRef`. I verified the subscription count drops to zero when the component is destroyed.
3. **`takeUntil(destroy$)`** with a Subject completed in `ngOnDestroy` (the older pattern).
4. Keep the `Subscription` and call `.unsubscribe()` in `ngOnDestroy`.

**What does not need unsubscribing:** `HttpClient` calls (they complete after one response), observables that complete (`of`, `take(1)`), and the router's `ActivatedRoute` observables (the router owns them).

### `shareReplay` and the "multiple requests" bug

Two `async` pipes on the same cold `http.get()` fire **two requests**. Share one execution:

```ts
readonly users$ = this.http.get<User[]>('/api/users').pipe(shareReplay({ bufferSize: 1, refCount: true }));
```

Prefer `{ bufferSize: 1, refCount: true }`: with `refCount` the source is released when nobody is subscribed, so you do not leak the connection.

### Typeahead (the standard example)

```ts
results = toSignal(
  toObservable(this.query).pipe(
    debounceTime(300),                     // wait for a pause in typing
    distinctUntilChanged(),                // skip identical consecutive values
    filter((q) => q.length >= 2),
    switchMap((q) => this.api.search(q).pipe(catchError(() => of([])))),  // cancel stale requests
  ),
  { initialValue: [] },
);
```

## 2.5 HttpClient

```ts
// app.config.ts
provideHttpClient(withInterceptors([authInterceptor, errorInterceptor]));
```

**Transport:** older versions used `XMLHttpRequest` by default and you opted in to the browser Fetch API with `withFetch()` (recommended, and required in practice for SSR). In v22 `withFetch()` is **deprecated because it is no longer needed**: `FetchBackend` is now the default `HttpBackend`. In an older codebase you will still see `provideHttpClient(withFetch())`, which is harmless.

```ts
@Injectable({ providedIn: 'root' })
export class UserApi {
  private readonly http = inject(HttpClient);

  list(page: number) {
    return this.http.get<Page<User>>('/api/users', { params: { page, size: 20 } });
  }
  get(id: number) { return this.http.get<User>(`/api/users/${id}`); }
  create(u: NewUser) { return this.http.post<User>('/api/users', u); }
  update(id: number, patch: Partial<User>) { return this.http.patch<User>(`/api/users/${id}`, patch); }
  remove(id: number) { return this.http.delete<void>(`/api/users/${id}`); }
}
```

**Things interviewers probe**

- **The generic is a compile-time lie.** `get<User>()` does not validate the response shape at runtime. Validate with a schema library (Zod, Valibot) in `httpResource({ parse })` or a `map`, when the API is untrusted.
- Observables from `HttpClient` are **cold**: nothing is sent until someone subscribes. Each subscription sends a new request.
- `HttpParams` and `HttpHeaders` are **immutable**: `params.set()` returns a new instance. A plain object works too (`{ params: { page: 1 } }`).
- Responses complete after one value, so there is no need to unsubscribe (though you may still want `takeUntilDestroyed` to cancel an in-flight request when the user leaves).
- Observe the full response or events: `{ observe: 'response' }` for headers and status, `{ reportProgress: true, observe: 'events' }` for upload progress.

### Interceptors

Functional interceptors (current style) are plain functions:

```ts
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req);
};

export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) inject(Router).navigate(['/login']);
      return throwError(() => err);
    }),
  );
```

- **Requests are immutable**: `req.clone({...})` to change anything.
- **Order:** interceptors run in the order listed for the **request**, and in **reverse** for the response.
- Common uses: attach auth tokens, global error handling and logging, loading indicators, retries, caching, adding base URLs, correlation ids.
- Class-based interceptors (`implements HttpInterceptor` plus the `HTTP_INTERCEPTORS` token) are the legacy form. They still work via `withInterceptorsFromDi()`.

In my test, two chained interceptors added an `Authorization` header and rewrote a 500 error into `Error('E500')`, and both ran as expected.

**Refresh-token flow (a favourite scenario):** on a 401, one in-flight refresh is shared (`shareReplay`/a `BehaviorSubject` gate), other requests wait for it, then retry with the new token. If the refresh fails, log the user out.

**XSRF:** with cookie-based sessions, `HttpClient` automatically reads the `XSRF-TOKEN` cookie and sends it as an `X-XSRF-TOKEN` header on mutating requests to same-origin URLs. Configure with `withXsrfConfiguration()`. A JWT in the `Authorization` header is not vulnerable to CSRF, but it is exposed to XSS if stored in `localStorage`.

## 2.6 Routing

```ts
// app.routes.ts
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: Home, title: 'Home' },
  { path: 'users/:id', component: UserPage, resolve: { user: userResolver } },
  { path: 'admin', canMatch: [adminGuard], loadChildren: () => import('./admin/routes').then((m) => m.ADMIN_ROUTES) },
  { path: 'reports', loadComponent: () => import('./reports/reports').then((m) => m.Reports) },
  { path: '**', component: NotFound },                      // keep last
];

// app.config.ts
provideRouter(routes, withComponentInputBinding(), withPreloading(PreloadAllModules));
```

```html
<nav>
  <a routerLink="/home" routerLinkActive="active" ariaCurrentWhenActive="page">Home</a>
  <a [routerLink]="['/users', user.id]" [queryParams]="{ tab: 'info' }">Profile</a>
</nav>
<router-outlet />
```

### Reading route data

| Source | Example | How to read |
|---|---|---|
| Path param | `/users/:id` | `input()` (with `withComponentInputBinding`), or `ActivatedRoute.paramMap` |
| Query param | `?tab=info` | `input()` or `queryParamMap` |
| Static `data` | `data: { role: 'admin' }` | `input()` or `route.data` |
| Resolved data | `resolve: { user: fn }` | `input()` or `route.data` |

With `withComponentInputBinding()`, **route params, query params, and resolver data bind straight to signal inputs**, which removes most `ActivatedRoute` code. I tested `/users/7?q=hi` with a resolver and the component displayed `user 7 / hi / T7`.

```ts
export class UserPage {
  readonly id = input<string>();           // from :id
  readonly q = input<string>();            // from ?q=
  readonly user = input<User>();           // from resolve: { user }
}
```

Param values are always **strings**. Convert with `input(0, { transform: numberAttribute })`. **Trap:** navigating from `/users/1` to `/users/2` **reuses** the same component instance and does not recreate it, so `ngOnInit` does not rerun. React to changes with inputs, `computed`, `effect`, or a `paramMap` observable, not a one-time read of `snapshot`.

### Lazy loading

`loadComponent` and `loadChildren` use dynamic `import()`, so the route's code is a separate chunk downloaded on first navigation. Preload strategies (`withPreloading(PreloadAllModules)` or a custom strategy) fetch lazy chunks in the background after startup. Lazy loading is the first lever for initial load time.

### Guards (functional, current style)

| Guard | Question it answers | Runs |
|---|---|---|
| `canActivate` | May the user enter this route? | Before activation |
| `canActivateChild` | May the user enter any child route? | Before child activation |
| `canMatch` | Should this route even be considered a match? (also prevents the lazy chunk download) | During matching |
| `canDeactivate` | May the user leave? (unsaved changes) | Before leaving |
| `resolve` | Fetch data before the route activates | After guards pass |

```ts
export const authGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isLoggedIn()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });   // redirect, not "false"
};

export const unsavedGuard: CanDeactivateFn<EditPage> = (component) =>
  component.dirty() ? confirm('Discard changes?') : true;
```

- A guard can return `boolean`, a **`UrlTree`** (redirect), a `RedirectCommand`, or an `Observable`/`Promise` of those. Returning a `UrlTree` is the recommended way to redirect.
- **Class-based guards** (`class AuthGuard implements CanActivate`, listed by class in `canActivate: [AuthGuard]`) are the older style. The router typings call a class or token in these arrays a `DeprecatedGuard`, so prefer functions. If you have existing guard classes, `inject(AuthGuard).canActivate(...)` inside a function (or the `mapToCanActivate([AuthGuard])` helper) bridges them. The old **`canLoad`** is deprecated in favour of **`canMatch`**.
- I tested the guard above: an unauthenticated visit to `/admin` ended up at `/login?returnUrl=%2Fadmin`, and after setting the flag the same URL rendered the admin page. A resolver returning `new RedirectCommand(...)` also redirected.

> **Security note:** guards and `*ngIf` are **UX, not security**. Anyone can read your JavaScript. Authorise every request on the **server**.

### Resolvers

```ts
export const userResolver: ResolveFn<User> = (route) => inject(UserApi).get(Number(route.paramMap.get('id')));
```

Resolvers block navigation until data arrives. That avoids a half-empty page but makes the click feel slow, because nothing happens until the data returns. The modern alternative is to navigate immediately and load with `httpResource`/`resource` plus a skeleton.

### Other topics that come up

- **`Router.navigate(['/users', id], { queryParams: {…} })`** vs **`navigateByUrl('/users/1')`**. The former builds from segments, and relative navigation is possible with `{ relativeTo: this.route }`.
- **Child routes** and nested `<router-outlet>`, **named outlets**, and the empty-path pattern for layouts (a parent route with `component: Layout` and `children`).
- **`pathMatch: 'full'`** is needed on `path: ''` redirects, otherwise the empty path matches everything as a prefix.
- **Router events** (`NavigationStart`, `NavigationEnd`, `NavigationError`, …) for analytics and global loading bars.
- **Route reuse** via a custom `RouteReuseStrategy` to cache pages (scroll position, tabs). Since v22.2 there is `withAutoCleanupInjectors()` (opt-in, it destroys route injectors of routes that are no longer active, and works with `RouteReuseStrategy.shouldDestroyInjector`) and `destroyDetachedRouteHandle()` to dispose of cached routes properly. The v22.0 announcement called the first one `withExperimentalAutoCleanupInjectors()`. In 22.2 that name is **deprecated** in favour of `withAutoCleanupInjectors()`, a good example of why you should check the installed typings rather than a blog post.
- **Hash vs path location:** path (`/users/1`) needs the server to return `index.html` for unknown paths. `withHashLocation()` (`/#/users/1`) works on any static host.
- **Scroll restoration:** `withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })`.
- **Title:** the `title` route property (or a `TitleStrategy`) sets the document title.

## 2.7 Forms

Angular has three forms systems. Know all three and when to pick each.

| | Template-driven | Reactive | **Signal Forms** (stable v22) |
|---|---|---|---|
| Source of truth | The template (`ngModel`) | A `FormGroup` object in the class | **A signal holding your data model** |
| Defined in | HTML directives | TypeScript | TypeScript (`form()` + schema) |
| Validation | Directives in the template | Validator functions on controls | A **schema** of rules bound to paths |
| Typing | Weak | Typed forms (v14+) | **Fully typed field tree** |
| Dynamic fields | Hard | Good (`FormArray`) | Good (arrays of the model) |
| Testing | Needs rendering | Easy, no DOM | Easy |
| Best for | Tiny, simple forms | Existing apps, complex forms (most codebases today) | **New** forms in signal-based apps |

### Reactive forms (the one you will meet most)

```ts
@Component({
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="save()">
      <input formControlName="email" />
      @if (form.controls.email.touched && form.controls.email.errors?.['email']) { <small>Invalid email</small> }
      <button [disabled]="form.invalid">Save</button>
    </form>`,
})
export class Signup {
  private readonly fb = inject(NonNullableFormBuilder);
  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirm: [''],
    tags: this.fb.array<string>([]),
  }, { validators: passwordsMatch });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value = this.form.getRawValue();     // fully typed: { email: string; password: string; ... }
  }
}
```

**Building blocks:** `FormControl` (one field), `FormGroup` (named controls), `FormArray` (a list), `FormBuilder` / `NonNullableFormBuilder` (shorthand). `NonNullableFormBuilder` makes `reset()` return the initial value instead of `null`.

**Control state**

| Property | Meaning |
|---|---|
| `valid` / `invalid` / `pending` / `disabled` | Validation status (`pending` while async validators run) |
| `touched` / `untouched` | Has the user focused and left it? |
| `dirty` / `pristine` | Has the user changed the value? |
| `value` / `getRawValue()` | Value (excludes disabled controls) / all values |
| `errors` | Object of error keys, or `null` |

Angular also adds CSS classes (`ng-valid`, `ng-invalid`, `ng-touched`, `ng-dirty`, …) so you can style states.

**Methods:** `setValue` requires every field. `patchValue` accepts a subset. `reset()`, `disable()`/`enable()`, `markAllAsTouched()`, `updateValueAndValidity()`. Observe changes with `valueChanges` and `statusChanges`. Control **when** validation runs with `updateOn: 'change' | 'blur' | 'submit'`.

**Custom and cross-field validators**

```ts
export const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const { password, confirm } = group.value;
  return password === confirm ? null : { mismatch: true };       // error on the *group*
};

export const usernameFree = (api: UserApi): AsyncValidatorFn => (control) =>
  timer(300).pipe(                                               // debounce
    switchMap(() => api.exists(control.value)),
    map((taken) => (taken ? { taken: true } : null)),
  );
```

I ran a typed group with a cross-field validator and an async validator: patching `pw: 'a', confirm: 'b'` produced `{ mismatch: true }` on the group, and the async check returned `{ taken: true }` after it resolved. Async validators run only if all **sync** validators pass, and they set the control to `pending`.

**Template-driven forms** use `FormsModule`, `[(ngModel)]`, `name`, `#f="ngForm"`. Fine for a login box. Hard to test and to scale.

**`ControlValueAccessor` (CVA)** is the interface that lets any custom component act as a form control with `formControlName` / `ngModel`. You implement `writeValue`, `registerOnChange`, `registerOnTouched` (and optionally `setDisabledState`) and provide it with `NG_VALUE_ACCESSOR`. It is the standard "build a custom input" question for reactive forms. Know the four methods.

### Signal Forms

Your data lives in a **signal**; `form()` wraps it in a typed **field tree**; `[formField]` binds inputs.

```ts
interface Login { email: string; password: string; remember: boolean }

@Component({
  imports: [FormField],
  template: `
    <form (submit)="onSubmit($event)">
      <input type="email" [formField]="loginForm.email" />
      @if (loginForm.email().touched() && loginForm.email().invalid()) {
        @for (e of loginForm.email().errors(); track e) { <small>{{ e.message }}</small> }
      }
      <input type="password" [formField]="loginForm.password" />
      <label><input type="checkbox" [formField]="loginForm.remember" /> Remember me</label>
      <button [disabled]="loginForm().invalid()">Sign in</button>
    </form>`,
})
export class LoginForm {
  readonly model = signal<Login>({ email: '', password: '', remember: false });

  readonly loginForm = form(this.model, (p) => {
    required(p.email, { message: 'Email required' });
    email(p.email, { message: 'Enter a valid email' });
    minLength(p.password, 8, { message: 'At least 8 characters' });
    validate(p.password, ({ value }) =>
      value() === 'password' ? { kind: 'weak', message: 'Too weak' } : null);
  });

  onSubmit(e: Event) {
    e.preventDefault();
    submit(this.loginForm, async () => { await this.auth.login(this.model()); });
  }
}
```

Imports come from `@angular/forms/signals`: `form`, `FormField`, `required`, `email`, `min`, `max`, `minLength`, `maxLength`, `pattern`, `validate`, `validateAsync`, `validateHttp`, `validateStandardSchema` (works with Zod and Valibot), `applyEach`, `apply`, `disabled`, `hidden`, `readonly`, `debounce`, `submit`.

I compiled and ran this exact shape. What I observed:

- **Two-way sync:** typing in the input updated `model().email`, and `loginForm.email().value.set('a@b.co')` updated the input. The model signal **is** the state.
- **State is signals:** `valid()`, `invalid()`, `pending()`, `touched()`, `dirty()`, `disabled()`, `readonly()`, `errors()`, `value()`. Each node (even the root, `loginForm()`) has the same API.
- **Errors carry `kind` and `message`.**
- **`submit()` does not call your action while the form is invalid**, and it marks the fields touched so errors show.
- **Conditional logic** is declarative in the schema:

```ts
form(order, (p) => {
  disabled(p.note, ({ valueOf }) => (valueOf(p.express) ? false : 'Only for express'));   // reason string when disabled
  applyEach(p.lines, (line) => { min(line.qty, 1, { message: 'Quantity must be at least 1' }); });
  validate(p.b, ({ value, valueOf }) => (value() === valueOf(p.a) ? null : { kind: 'mismatch', message: 'Must match' }));
});
```

(Verified: toggling `express` flipped `note().disabled()`, `applyEach` validated each array element, and the cross-field rule produced a `mismatch` error.)

**Custom controls:** a component implements `FormValueControl<T>` with a `value = model<T>()`, and other optional inputs (`disabled`, `errors`, `touched`, …) are filled in automatically. `FormCheckboxControl` is the boolean (`checked`) variant. This replaces `ControlValueAccessor` boilerplate.

**Reactive Forms vs Signal Forms, what to say:** "Signal Forms are stable as of v22 and I would choose them for new signal-based code: one typed model signal, schema validation in one place, no `valueChanges` subscriptions. For existing apps, Reactive Forms remain fully supported and the Angular docs describe interop so a large form can migrate gradually. I would not rewrite working forms just for novelty." (The docs say Reactive forms "remain a solid choice" for existing applications.)

> If your team is on v20 or below, Signal Forms are not available (they arrived experimental in v21), so Reactive Forms is the answer.

## 2.8 Quick-fire Q&A (Core)

**signal vs computed vs effect?** State you can set, derived read-only state, a side effect that re-runs when the signals it reads change.

**Why is `effect` called a last resort for state?** It runs later, hides data flow, and derived state belongs in `computed`/`linkedSignal`. Use it for external side effects only.

**What does `OnPush` check?** The component only runs when an input reference changes, an event fires in it, an `async` pipe emits, `markForCheck` is called, or a signal it reads changes.

**What is zoneless?** Running without zone.js. Angular is notified by signals, `markForCheck`, `setInput`, listeners, and so on. Default for new apps from v21.

**Why did my view not update in zoneless?** You mutated a plain field from an async callback. Use a signal.

**`switchMap` vs `mergeMap` vs `concatMap` vs `exhaustMap`?** Cancel the old, run in parallel, queue in order, ignore new while busy.

**`combineLatest` vs `forkJoin` vs `zip`?** Latest-of-each on every emit, last-of-each once at completion, index-matched pairs.

**How do you avoid memory leaks with RxJS?** `async` pipe, `toSignal`, `takeUntilDestroyed`. Never leave a manual subscription without cleanup.

**Do you need to unsubscribe from `HttpClient`?** Not for leaks (it completes), but you may cancel in-flight requests when leaving.

**Interceptor order?** Request in listed order, response in reverse order.

**`canActivate` vs `canMatch`?** `canActivate` runs after the route matched. `canMatch` decides whether the route matches at all, so a failed `canMatch` also avoids loading the lazy chunk.

**How do you read route params the modern way?** `withComponentInputBinding()` then `id = input<string>()`.

**Reactive vs template-driven forms?** Model in the class and unit-testable, versus model in the template. Reactive for anything non-trivial.

**What is `ControlValueAccessor`?** The adapter that lets a custom component participate in forms.

**How do you validate across fields?** A validator on the parent `FormGroup`, or a schema `validate` that reads another field.

**`setValue` vs `patchValue`?** Full object required versus a partial.

**What is `ExpressionChangedAfterItHasBeenChecked`?** A binding changed between the dev-mode check passes, usually because a child mutated state the parent already rendered.

**What is `resource`?** Signals-based async loading that re-runs on dependency change, cancels stale runs, and exposes `value`, `isLoading`, `error`.

**Signal Forms stable?** Yes, in v22. Experimental in v21.
