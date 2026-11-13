# Level 3 · Advanced

## 3.1 Performance

Always answer performance questions in the order **measure → find the bottleneck → fix**. The three buckets are **load** time, **runtime** (change detection, rendering) and **memory**.

### Load performance (bundle size and first paint)

| Technique | What it does |
|---|---|
| **Lazy-load routes** (`loadComponent` / `loadChildren`) | Each route becomes its own chunk, downloaded on first visit |
| **`@defer`** | Lazy-load heavy parts of a template (charts, editors, comments) |
| **Preloading** (`withPreloading(...)`) | Fetch lazy chunks in the background after startup |
| **`injectAsync()`** (v22) | Lazy-load a heavy *service* on first use |
| **Tree-shaking** | Use `providedIn: 'root'` / `@Service()`, import only what you use. `import { debounce } from 'lodash-es'`, not all of `lodash` |
| **Budgets** in `angular.json` | Fail the build when a bundle grows past a limit |
| **Bundle analysis** | `ng build --stats-json`, then a visualiser (for example esbuild's bundle analyzer or `source-map-explorer`) to see what is in each chunk |
| **`NgOptimizedImage`** | `<img ngSrc="hero.jpg" width="800" height="600" priority />` sets lazy loading and `fetchpriority`, can generate a `srcset` when an image loader is configured, and warns about missing dimensions (layout shift) and oversized images. Use `priority` on the LCP image |
| **SSR / SSG + hydration** (3.4) | Send rendered HTML so users see content before JavaScript runs |
| **Fonts and third-party scripts** | Preload fonts, defer analytics and chat widgets |

### Runtime performance

- **`OnPush` + signals** (the default in v22) so only components whose data changed are checked.
- **Zoneless** to remove the "check everything after every event" cost and the zone.js payload.
- **`track` in `@for`** with a stable id, so DOM nodes are reused rather than recreated.
- **No heavy work in templates.** A method call in a template runs on every check. Use `computed()`, a **pure pipe**, or precompute. Small arrow functions are fine, heavy loops are not.
- **Virtual scrolling** for very long lists (`@angular/cdk/scrolling`): `<cdk-virtual-scroll-viewport itemSize="48">` plus `*cdkVirtualFor`. It renders only what is visible.
- **Debounce and throttle** input events and resize/scroll handlers.
- **Web Workers** for CPU-heavy work (`ng generate web-worker`), so the main thread stays responsive.
- In zone-based apps: **`NgZone.runOutsideAngular`** for high-frequency events.
- **Avoid layout thrashing**: do not read layout (`offsetHeight`) and write styles in alternation in a loop.
- **Immutable updates** keep `OnPush` and signal equality checks cheap.

### Memory

Leaks come from forgotten subscriptions, `setInterval`, global event listeners, detached DOM nodes held by closures, and large caches. Use `takeUntilDestroyed`, `DestroyRef`, `async` pipe, `toSignal`. Check with the **Memory** tab in Chrome DevTools (take heap snapshots before and after navigating away and back, and look for retained component instances).

### Tools

- **Angular DevTools** (Chrome extension): component tree, profiler to see which components re-render and why.
- **Chrome DevTools Performance** panel and Lighthouse for web vitals (LCP, INP, CLS).
- Angular also adds custom tracks to the Chrome performance profiler, so you can see Angular work in the flame chart.

> **The strong answer to "the page is slow, what do you do?":** "First reproduce and measure: Lighthouse for load, the Performance and Angular DevTools profiler for runtime. If it is load: look at bundle size, lazy routes, images, SSR. If it is runtime: look for components re-rendering too often, template method calls, missing `track`, and large lists. Then fix the biggest one and measure again."

## 3.2 State management

**First question to ask: do you need a library?** Most apps do not. Angular's built-in tools cover most cases.

| Level | Tool | When |
|---|---|---|
| Local UI state | `signal()` in the component | A toggle, a form's local state |
| Shared across a few components | A service with signals | A cart, current user, a feature's data |
| Server state (fetch, cache, loading, error) | `resource` / `httpResource`, or a data layer | Anything that comes from an API |
| Large app, many teams, complex flows, audit trail | **NgRx Store** | When you need strict structure, time-travel debugging, predictable updates |
| Feature-level state with less ceremony | **NgRx SignalStore** | A middle ground between a plain service and the global Store |

### Service with signals (the default for most apps)

Shown in 2.1 (`CartStore`). Rules: keep the writable signal **private**, expose a **read-only** view (`asReadonly()`) and **methods** that change it. Components never mutate state directly.

### NgRx Store (Redux pattern)

One immutable state tree. **Actions** describe what happened, **reducers** compute the next state, **selectors** read derived slices, **effects** handle side effects such as HTTP.

```ts
export const CartActions = createActionGroup({
  source: 'Cart',
  events: { 'Add Item': props<{ item: CartItem }>(), 'Clear': emptyProps() },
});

export const cartFeature = createFeature({
  name: 'cart',
  reducer: createReducer(
    { items: [] as CartItem[] },
    on(CartActions.addItem, (s, { item }) => ({ ...s, items: [...s.items, item] })),
    on(CartActions.clear, (s) => ({ ...s, items: [] })),
  ),
  extraSelectors: ({ selectItems }) => ({
    total: createSelector(selectItems, (items) => items.reduce((t, i) => t + i.price * i.qty, 0)),
  }),
});

// app.config.ts
provideStore({ [cartFeature.name]: cartFeature.reducer }), provideEffects(UserEffects)
```

```ts
const store = inject(Store);
readonly total = store.selectSignal(cartFeature.total);     // a Signal<number>
store.dispatch(CartActions.addItem({ item }));
```

I ran this with `@ngrx/store` 22.0.1: adding `{price: 10, qty: 3}` and `{price: 5, qty: 2}` gave a total of `40`, and `clear()` brought it back to `0`. (Note that `createFeature` auto-generates `selectItems` and `selectCartState`, while selectors from `extraSelectors` are exposed under the name you give them, here `cartFeature.total`.)

**Effects** keep reducers pure by handling side effects:

```ts
export class UserEffects {
  private readonly actions$ = inject(Actions);
  private readonly api = inject(UserApi);

  load$ = createEffect(() =>
    this.actions$.pipe(
      ofType(UserActions.load),
      switchMap(() => this.api.list().pipe(
        map((users) => UserActions.loadSuccess({ users })),
        catchError((e) => of(UserActions.loadFailure({ error: String(e) }))),   // keep the effect alive
      )),
    ));
}
```

Dispatching `load()` in my test produced `loadSuccess`, which filled the state and cleared the `loading` flag. The error is handled **inside** the inner observable so one failure does not kill the effect stream (same rule as in 2.4).

**Pros:** predictable, debuggable (Redux DevTools, time travel), testable reducers and selectors, strict conventions for large teams. **Cons:** boilerplate, a learning curve, and overkill for small apps.

**When is NgRx justified?** Many features reading and writing the same data, complex async flows, a need for an audit trail or undo, or a big team that benefits from strict structure. If you can say "I would start with signals and a service, and move to NgRx if the complexity demanded it", that is a mature answer.

### NgRx SignalStore

A lighter, signals-first store built with composable features:

```ts
export const TodoStore = signalStore(
  { providedIn: 'root' },
  withState({ todos: [] as Todo[], filter: 'all' as 'all' | 'open' | 'done' }),
  withComputed(({ todos, filter }) => ({
    visible: computed(() => todos().filter((t) => filter() === 'all' || (filter() === 'done') === t.done)),
    openCount: computed(() => todos().filter((t) => !t.done).length),
  })),
  withMethods((store) => ({
    add(title: string) { patchState(store, (s) => ({ todos: [...s.todos, { id: s.todos.length + 1, title, done: false }] })); },
    toggle(id: number) { patchState(store, (s) => ({ todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) })); },
    setFilter(filter: 'all' | 'open' | 'done') { patchState(store, { filter }); },
  })),
  withHooks({ onInit(store) { store.add('seed'); } }),
);
```

Each state property becomes a signal (`store.todos()`), computed values and methods sit on the same object. Verified: the `onInit` hook ran, toggling and filtering produced the expected `visible()` list.

**Other options you may be asked about:** Akita, Elf, NGXS (older/alternative libraries), TanStack Query for Angular (server-state caching), and plain RxJS `BehaviorSubject` services (the pre-signals default).

## 3.3 Testing

**The test pyramid:** many fast **unit tests** (services, pipes, pure functions, component logic), fewer **component/integration tests** (component + template via `TestBed`), and a few **end-to-end tests** (Playwright or Cypress) for critical user journeys.

**Tooling:** from v21 new projects use **Vitest** (`ng test`) with jsdom. Karma (deprecated by its own maintainers since 2023) with Jasmine is still supported by the Angular team, and you will see it in older projects. An experimental Karma-to-Vitest migration tool exists. The syntax is nearly the same (`describe`, `it`, `expect`), but mocks use `vi.fn()` instead of `jasmine.createSpy()`.

### A component test

```ts
describe('Rating', () => {
  it('shows the stars and updates the model', async () => {
    const fixture = TestBed.createComponent(Rating);
    fixture.componentRef.setInput('label', 'Quality');      // set signal inputs this way
    await fixture.whenStable();                              // zoneless: wait for rendering

    const stars = fixture.nativeElement.querySelectorAll('.s');
    (stars[1] as HTMLElement).click();
    expect(fixture.componentInstance.value()).toBe(2);
  });
});
```

- **Signal inputs cannot be assigned directly**, use `fixture.componentRef.setInput(name, value)`.
- In zoneless apps, `await fixture.whenStable()` flushes change detection. Calling `fixture.detectChanges()` also works but can hide bugs because it forces a check that the app itself would not have scheduled.
- **Effects** run during change detection, so use `TestBed.tick()` to flush them in a service test.
- Components have `ChangeDetectionStrategy.OnPush` by default in v22, so a test that sets a plain field and expects the view to change will fail the same way the real app would. That is a feature. In a zoneless test, `fixture.detectChanges()` after changing a plain field does not even refresh the view, and in dev mode it reports `NG0100`.
- **`whenStable()` waits for in-flight `HttpClient` requests.** If you use `HttpTestingController` and `await fixture.whenStable()` *before* flushing the request, the test hangs and times out. Use `fixture.detectChanges()` plus `TestBed.tick()` while a request is pending, flush it, and then await. I hit exactly this testing a paginated `httpResource`.

### A service test with HTTP

```ts
TestBed.configureTestingModule({
  providers: [provideHttpClient(), provideHttpClientTesting()],
});
const api = TestBed.inject(UserApi);
const http = TestBed.inject(HttpTestingController);

const result = firstValueFrom(api.get(1));
http.expectOne('/api/users/1').flush({ id: 1, name: 'Ann' });
expect(await result).toEqual({ id: 1, name: 'Ann' });
http.verify();                                   // fails if any request was unexpected or unflushed
```

### Mocking

```ts
const get = vi.fn().mockReturnValue(of(user));
TestBed.configureTestingModule({ providers: [{ provide: UserApi, useValue: { get } }] });
// ...
expect(get).toHaveBeenCalledWith(7);
```

This is why DI matters: replacing a dependency is one provider entry. Prefer fakes and `useValue` over mocking modules.

### More testing tools

- **Fake timers:** `vi.useFakeTimers()` and `vi.advanceTimersByTime(1000)` replace Angular's `fakeAsync`/`tick` (which needs zone.js). I verified a 1000ms `setTimeout` firing under fake timers.
- **Router:** `RouterTestingHarness` (`await RouterTestingHarness.create(); await harness.navigateByUrl('/admin')`), then assert on `harness.routeNativeElement` and `router.url`. I tested a functional guard redirect and a resolver this way.
- **`@defer` blocks:** by default `TestBed` renders them as if triggered, so tests see the deferred content (I confirmed this). To step through the placeholder and loading states, set `deferBlockBehavior` in `TestBed.configureTestingModule` and drive the blocks manually.
- **Component harnesses** (`@angular/cdk/testing`, Material's `MatButtonHarness`, and so on) give a stable API for interacting with component libraries without depending on their DOM.
- **Errors:** `TestBed` **rethrows** errors that reach the application error handler, so a throwing click handler fails your test. To test a custom `ErrorHandler`, set `rethrowApplicationErrors: false` in `configureTestingModule` (I hit exactly this).
- **Coverage:** `ng test --coverage`.
- **End-to-end:** Playwright or Cypress against a running app. Angular no longer ships Protractor (it was removed).

### What to test (and not)

Test **behaviour users or callers rely on**: rendered output for given inputs, emitted events, navigation, calls to collaborators. Do not test the framework (that `@if` works) or private implementation details. A good unit test is fast, deterministic and fails for one reason.

## 3.4 Server-side rendering (SSR), SSG and hydration

**Why:** faster first contentful paint and LCP (HTML arrives ready), SEO and link previews (crawlers see content), and a better experience on slow devices.

**Modes**

| Mode | Rendered | Use for |
|---|---|---|
| **CSR** (client-side rendering) | In the browser | Dashboards behind a login |
| **SSR** | On the server, per request | Personalised or frequently changing public pages |
| **SSG / prerender** | At build time | Marketing pages, docs, blogs |
| **Hybrid** | Mixed, **per route** | Most real apps |

**Setup:** `ng add @angular/ssr` (or `ng new --ssr`). This is the generated per-route configuration in a v22 project:

```ts
// app.routes.server.ts
import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: '**', renderMode: RenderMode.Prerender },
];
// RenderMode has three values: Server, Client, Prerender
```

```ts
// app.config.server.ts
provideServerRendering(withRoutes(serverRoutes))
// app.config.ts
provideClientHydration()
```

You change `renderMode` per path (`{ path: 'dashboard', renderMode: RenderMode.Client }`, `{ path: 'blog/:slug', renderMode: RenderMode.Prerender, getPrerenderParams }`, `{ path: 'account', renderMode: RenderMode.Server }`).

**Hydration.** After the server HTML loads, the client app **reuses** the existing DOM instead of destroying and recreating it, and attaches listeners. This avoids a flash and preserves state. Mismatches between server and client HTML (usually from reading `window`, `Date.now()` or random values during render) cause hydration errors (`NG0500` family).

- **Incremental hydration:** with `@defer (hydrate on viewport) { ... }` parts of the page stay dehydrated (just HTML) until a trigger. **From v22 it is enabled by default with `provideClientHydration()`**, and `withIncrementalHydration()` is **deprecated** (I read it in the 22.2.5 typings). Incremental hydration also enables event replay, so clicks made before hydration are replayed afterwards.
- **HTTP transfer cache:** responses fetched during SSR are serialised into the page and reused by the browser, so the client does not repeat the same request. Configure with `withHttpTransferCacheOptions` or disable with `withNoHttpTransferCache()`.

**Writing SSR-safe code**

- No direct `window`, `document`, `localStorage` or `navigator` in constructors or at module level. Inject `DOCUMENT`, use `isPlatformBrowser(inject(PLATFORM_ID))`, or put browser-only code in **`afterNextRender`/`afterEveryRender`**, which never runs on the server.
- Avoid non-deterministic render output (random ids, current time) or wrap it in a browser-only hook.
- Avoid manual DOM manipulation (`innerHTML` through `nativeElement`), which can break hydration. If a component cannot hydrate, mark it with `ngSkipHydration`.
- For per-request data on the server, use the request context and avoid module-level mutable state, because the same process serves many users.
- Avoid fetching the same data twice: `HttpClient` responses are transferred to the browser automatically by the HTTP transfer cache, and `TransferState` covers other data you computed on the server.

**Trade-off to state:** SSR adds server cost and complexity (a Node server, caching strategy, security of server-side code). Do not use it for an internal app that is behind a login and does not need SEO.

## 3.5 Security

| Threat | What Angular does | What you must do |
|---|---|---|
| **XSS** (cross-site scripting) | Treats **all values as untrusted** and sanitises/escapes them by context (HTML, style, URL, resource URL). Templates are compiled ahead of time, so there is no runtime template injection from user input | Never build templates from user input. Avoid `bypassSecurityTrust*`. Do not write `nativeElement.innerHTML = userInput`. Do not concatenate user input into URLs without validation |
| **CSRF/XSRF** | `HttpClient` reads the `XSRF-TOKEN` cookie and sends the `X-XSRF-TOKEN` header on mutating same-origin requests | The **server** must validate it. Use `SameSite` cookies |
| **Token theft** | Nothing automatic | Prefer **HttpOnly, Secure, SameSite cookies** for session tokens (not readable by JS). A token in `localStorage` is readable by any XSS, so the safest posture is strict CSP plus short-lived tokens |
| **Clickjacking, injection of scripts** | Supports a CSP **nonce** (`ngCspNonce` / `CSP_NONCE`) for inline styles it adds | Set `Content-Security-Policy` and `X-Frame-Options`/`frame-ancestors` headers on the server |
| **Untrusted dependencies** | Nothing | `npm audit`, lockfile, review packages, keep Angular updated |
| **Broken access control** | Nothing | **Authorise on the server.** Route guards are UX only |

I demonstrated the sanitiser: binding `'<b>ok</b><img src=x onerror="alert(1)"><script>alert(2)</script>'` to `[innerHTML]` kept `<b>ok</b>` but stripped the `onerror` attribute and the `<script>`. Binding `javascript:alert(1)` to `[href]` was rewritten to `unsafe:javascript:alert(1)`. And `DomSanitizer.bypassSecurityTrustHtml(...)` kept the `onerror`, which is why it is dangerous: you are telling Angular "I vouch for this".

**Interview answer to "where do you store the JWT?":** "An HttpOnly, Secure, SameSite cookie is safest against XSS because JavaScript cannot read it, but then I need CSRF protection. If I use an `Authorization` header with a token in memory (and a refresh token in an HttpOnly cookie), I avoid CSRF and limit XSS exposure. Storing a long-lived token in `localStorage` is the weakest option. Whatever I choose, the backend validates every request."

Also mention **Trusted Types** support, subresource integrity, and keeping Angular patched (security fixes ship in supported versions only).

## 3.6 Application architecture

**Structure by feature, not by type** (the official style guide):

```text
src/app/
  core/            # app-wide singletons: auth, interceptors, config, layout shell
  shared/          # reusable dumb UI: buttons, pipes, directives (no business logic)
  features/
    orders/
      order-list/
      order-detail/
      orders.routes.ts      # lazy-loaded
      orders.store.ts
      orders-api.ts
    customers/
```

**Smart (container) vs presentational (dumb) components**

| | Container ("smart") | Presentational ("dumb") |
|---|---|---|
| Knows about | Services, store, router | Only its inputs and outputs |
| Gets data from | Services/store | `input()` |
| Reports changes via | Calls services | `output()` |
| Change detection | `OnPush` | `OnPush` |
| Reuse | Low | High, easy to test |

Why: dumb components are reusable and trivial to test, and smart ones are the only place that knows where data comes from.

**Other patterns:** a **facade** service that hides a store and API behind a simple interface, **feature libraries** with enforced dependency rules (Nx `enforce-module-boundaries`) so `shared` cannot import a feature, **barrel files** (`index.ts`) used sparingly because deep barrels can hurt tree-shaking and cause circular imports, and **single responsibility**: a component renders, a service holds logic, a store holds state.

**Monorepo:** an Angular CLI workspace can hold several apps and libraries (`ng generate library`). Nx adds task caching and affected-only builds, which matters at scale.

**Micro-frontends:** independently deployed apps composed at runtime, usually with **Module Federation** or **Native Federation** (a build-tool-agnostic variant that fits esbuild better; the Webpack-based builders are deprecated in v22). Trade-offs: team autonomy and independent releases versus shared-dependency version conflicts, UX consistency, and operational complexity. Do not use micro-frontends for a small team.

**Environment configuration:** build-time (`fileReplacements`, one build per environment) versus **runtime config** (fetch `/config.json` before bootstrap with `provideAppInitializer`, so a single build artifact runs in every environment). I verified `provideAppInitializer(async () => { ... })` runs before the app is used:

```ts
provideAppInitializer(async () => {
  const cfg = await firstValueFrom(inject(HttpClient).get<Config>('/config.json'));
  inject(ConfigService).set(cfg);
});
```

(`APP_INITIALIZER` is the older, deprecated token form.)

## 3.7 Error handling

Handle errors at the right layer:

| Layer | Mechanism | Example |
|---|---|---|
| **Operation** | `catchError` in the stream, error state of a `resource` | Show an inline "Could not load, retry" |
| **HTTP (global)** | An interceptor | 401 → sign out, 5xx → toast, retry with backoff |
| **Template** | `@boundary { } @error (let err) { }` (v22, developer preview) | Isolate a failing widget so the rest of the page stays alive |
| **Routing** | `withNavigationErrorHandler(...)`, an error route | Navigation or lazy-load failure |
| **Global** | A custom `ErrorHandler` (and `provideBrowserGlobalErrorListeners()`) | Log to Sentry/App Insights, show a generic message |

```ts
@Injectable({ providedIn: 'root' })
export class GlobalErrorHandler implements ErrorHandler {
  private readonly log = inject(LoggingService);
  handleError(error: unknown) {
    this.log.report(error);            // send to monitoring
    console.error(error);
  }
}
// providers: [{ provide: ErrorHandler, useClass: GlobalErrorHandler }]
```

I confirmed a custom `ErrorHandler` receives an exception thrown from a click handler. `provideBrowserGlobalErrorListeners()` (in every new project) additionally forwards uncaught window `error` and `unhandledrejection` events to the same handler.

**`@boundary`** in my 22.2.5 test caught an error thrown while rendering a child and showed the `@error` fallback, while a sibling element kept rendering:

```html
@boundary {
  <app-promotional-widget />
} @error (let err) {
  <app-default-promo />
}
<app-checkout-flow />
```

The release announcement described it as a developer preview, so check the current docs before relying on it in production.

**User experience of errors:** show actionable messages, never raw server errors, preserve the user's input, offer retry, and log with a correlation id so support can find the trace.

## 3.8 Accessibility (a11y) and internationalisation (i18n)

### Accessibility

- **Semantic HTML first** (`<button>`, `<nav>`, `<label for>`), then ARIA only where HTML cannot express it. A `<div (click)>` is not a button (no keyboard, no role).
- **Keyboard:** every interaction works with Tab, Enter, Space, Escape, arrow keys. Visible focus styles. Manage **focus** after route changes and when opening or closing dialogs.
- **Forms:** associate every input with a `<label>`, link error messages with `aria-describedby`, and announce validation errors (`role="alert"`).
- **Dynamic content:** `LiveAnnouncer` from `@angular/cdk/a11y` for screen-reader announcements, `FocusTrap` for modals.
- **Router:** `routerLinkActive` with `ariaCurrentWhenActive="page"` marks the current link.
- **Angular Aria** (stable in v22): headless, unstyled directives that give you accessible behaviour (keyboard handling and ARIA roles) for common widgets, so you supply only the styling. It launched in v21 with eight patterns (accordion, combobox, grid, listbox, menu, tabs, toolbar, tree), and the v22 announcement says twelve are now production-ready.
- **Testing:** axe (`@axe-core/playwright` or `jest-axe`-style checks), manual keyboard pass, and a screen reader on key flows. Contrast ratio at least 4.5:1 for body text.

### Internationalisation

Two approaches:

| | Angular built-in (`@angular/localize`) | Runtime libraries (Transloco, ngx-translate) |
|---|---|---|
| When translated | **At build time** | At runtime |
| Output | One build per locale | One build, switch language live |
| Mark text with | `i18n` attribute, `$localize` tag | Keys and pipes/directives |
| Performance | Best, no runtime cost | Small runtime cost |
| Switching language | Reload / different URL | Instant |

```html
<h1 i18n="@@welcome">Welcome</h1>
<p i18n>Updated {minutes, plural, =0 {just now} =1 {one minute ago} other {{{minutes}} minutes ago}}</p>
```

`ng extract-i18n` produces a translation source file. Locale-aware pipes (`date`, `currency`, `number`) use `LOCALE_ID`. Right-to-left languages need CSS logical properties (`margin-inline-start`). With SSR, enable i18n hydration support (`withI18nSupport()`).

## 3.9 Dynamic components and advanced DI

**Creating components at runtime** (dialogs, dashboards, plugins):

```ts
// 1. Declarative: render a component class chosen at runtime
//    <ng-container *ngComponentOutlet="cmp(); inputs: { label: 'hi' }" />

// 2. Imperative: into a ViewContainerRef
readonly host = viewChild.required('host', { read: ViewContainerRef });
open() {
  const ref = this.host().createComponent(Toast);
  ref.setInput('message', 'Saved');        // works with signal inputs
  ref.onDestroy(() => {/* cleanup */});
}

// 3. Standalone creation attached to the app (portals, overlays)
const ref = createComponent(Dialog, { environmentInjector: inject(EnvironmentInjector), hostElement });
inject(ApplicationRef).attachView(ref.hostView);
```

I verified `NgComponentOutlet` with an `inputs` object rendering `w:hi`, and `createComponent` into a `ViewContainerRef`. The CDK `Overlay`/`Dialog` and Material's `MatDialog` wrap this for you.

**Running code in an injection context outside a constructor:**

```ts
const injector = inject(Injector);
setTimeout(() => runInInjectionContext(injector, () => { const s = inject(Service); /* ... */ }));
```

**Initialisers:** `provideAppInitializer(fn)` (before the app starts), `provideEnvironmentInitializer(fn)` (when an environment injector is created, for example a lazy route).

**`viewProviders` vs `providers`:** `viewProviders` are visible to the component's own view but **not** to projected content.

**`forwardRef`** resolves a class referenced before it is defined (typical for `NG_VALUE_ACCESSOR` on the same class).

**Injection tokens for configuration, abstract classes for swappable behaviour.** Prefer an abstract class as the DI token for a contract (`Logger`), and swap implementations per environment or in tests.

## 3.10 Tooling, builds and upgrades

**The CLI:** `ng new`, `ng serve`, `ng build`, `ng test`, `ng generate component|service|pipe|guard|...`, `ng add <lib>` (installs and configures, for example `@angular/material` or `@angular/ssr`), `ng update`.

**Builders.** The default application builder is `@angular/build:application`, based on **esbuild** and Vite (fast builds, fast dev server with HMR). The **Webpack-based builders** (`@angular-devkit/build-angular`) and `@ngtools/webpack` are **deprecated in v22**. If a project still uses them, plan the move to the application builder.

**Upgrading Angular**

1. Go **one major version at a time**: `ng update @angular/core@21 @angular/cli@21`, run tests, commit, then the next. The official **update guide** (`angular.dev/update-guide`) lists version-specific steps.
2. `ng update` runs **migration schematics** that rewrite code for you.
3. Upgrade third-party libraries that have Angular peer dependencies (Material, NgRx, and others) in the same step.
4. Check the **Node** and **TypeScript** requirements of the target version (for example the Angular 22.2 CLI refuses to run on Node 24.11 and wants at least 24.15, 22.22 or 26.0).

**Migrations you can run today** (I listed them from the installed `@angular/core` 22.2.5; each is `ng generate @angular/core:<name>`):

| Schematic | Does |
|---|---|
| `standalone` | NgModules to standalone components |
| `control-flow` | `*ngIf/*ngFor/*ngSwitch` to `@if/@for/@switch` |
| `inject` | Constructor injection to `inject()` |
| `signal-input`, `outputs`, `signal-queries` | `@Input`, `@Output`, `@ViewChild` to signal APIs. `signals` bundles them |
| `service` | `@Injectable` to `@Service` where applicable |
| `route-lazy-loading` | Eager route components to `loadComponent` |
| `self-closing-tag`, `cleanup-unused-imports`, `common-to-standalone` | Tidy-ups |
| `ngclass-to-class`, `ngstyle-to-style` | `[ngClass]`/`[ngStyle]` to `class`/`style` bindings |

**Support and versions:** Angular supports each major for a limited window (active, then long-term support). Starting with v22 the plan is roughly one major per year. Always check `angular.dev/reference/releases` for current dates.

**Quality gates:** ESLint with `angular-eslint`, Prettier, strict TypeScript (`strict: true`, `strictTemplates`), Husky/lint-staged, and CI running lint, unit tests and a production build.

**Developing with AI tools:** Angular ships an MCP server and "agent skills" so coding assistants can follow current best practices. Worth a mention in a conversation about how you work, but it will not replace understanding the framework.

## 3.11 Comparisons interviewers ask

**Angular vs AngularJS (1.x)?** Different frameworks that share a name. AngularJS (2010) was JavaScript with two-way binding via digest cycles and controllers/`$scope`. Angular (2016+) is TypeScript, component-based, AOT-compiled, uses DI and a modern change detection (now signals). AngularJS long-term support ended in January 2022.

**Angular vs React.**

| | Angular | React |
|---|---|---|
| Nature | Full framework | UI library |
| Language | TypeScript (required) | JS or TS |
| Templating | HTML templates with control-flow syntax | JSX |
| State | Signals, services, RxJS, NgRx | Hooks, context, plus libraries (Redux, Zustand, TanStack Query) |
| DI | Built in | None (context, hooks) |
| Forms, routing, HTTP | Built in | Third-party |
| Reactivity | Signals (fine-grained, plus zoneless) | Re-render a component and diff the virtual DOM |
| Opinionated structure | Strong | Weak, you choose |

Say it neutrally: "Angular gives me one consistent way to do everything, which scales well across big teams. React gives more freedom and a larger ecosystem, and the cost is more decisions. I have worked with Angular, and I understand React's model of re-rendering and hooks." (The React module in this guide covers that model.)

**Angular vs Vue?** Vue is also template-based and has reactive primitives similar in spirit to signals (`ref`, `computed`), with a gentler learning curve and a lighter core. Angular is more batteries-included.

## 3.12 Quick-fire Q&A (Advanced)

**How do you reduce initial load time?** Lazy routes, `@defer`, preloading, tree-shaking and budgets, `NgOptimizedImage`, SSR/SSG, trimming dependencies.

**How do you improve runtime performance?** `OnPush` + signals (default in v22), `track`, no template method calls, virtual scroll, debouncing, zoneless.

**When would you use NgRx?** Large apps with complex shared state and many contributors. Otherwise signals in services, or SignalStore.

**Difference between NgRx Store and SignalStore?** Store is Redux-style (actions, reducers, effects), global, with DevTools. SignalStore is composable and signal-first, with less boilerplate, often scoped to a feature.

**How do you test a component with signal inputs?** `fixture.componentRef.setInput(...)`, then `await fixture.whenStable()`.

**How do you mock HTTP?** `provideHttpClientTesting()` and `HttpTestingController` (`expectOne`, `flush`, `verify`).

**What is hydration?** Reusing server-rendered DOM on the client rather than rebuilding it.

**SSR vs SSG?** SSR renders per request on a server. SSG renders once at build time to static files.

**How does Angular protect against XSS?** Context-aware sanitisation of bound values, AOT compilation, and no string-based templates. You must avoid bypassing it.

**Where do you store tokens?** HttpOnly Secure SameSite cookies where possible, or in-memory access tokens with a cookie refresh token. Not long-lived tokens in `localStorage`. Server enforces authorisation.

**Smart vs dumb components?** Containers know about data sources, presentational components only take inputs and emit outputs.

**How do you handle global errors?** `ErrorHandler`, HTTP interceptor, `@boundary` for template-level isolation, and monitoring.

**How do you upgrade between major versions?** One major at a time with `ng update`, run the migrations, update libraries, test, repeat.

**How do you pass config at runtime without rebuilding?** Fetch `/config.json` in `provideAppInitializer`, and keep one artifact for all environments.

**What changed in Angular 22?** Signal Forms, `resource`/`httpResource` and Angular Aria stable. `OnPush` is the default and `Default` became `Eager`. `@Service()` and `injectAsync()`. Template spread, arrow functions and multi-case/exhaustive `@switch`. Incremental hydration on by default. `withFetch()` and the Webpack builders deprecated. TypeScript 6 support.
