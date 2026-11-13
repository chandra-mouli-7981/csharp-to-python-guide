# Level 5 · Reference

## 5.1 Legacy to modern cheat sheet

Real codebases mix both styles. Be able to read the left column and write the right column.

| Topic | Legacy (still common) | Modern (v20 to v22) |
|---|---|---|
| Structure | `NgModule` with `declarations`, `imports` | Standalone components, `imports: []` on the component, `bootstrapApplication` |
| Conditionals | `*ngIf="x; else tpl"` | `@if (x) { } @else { }` |
| Loops | `*ngFor="let i of items; trackBy: fn"` | `@for (i of items; track i.id) { } @empty { }` |
| Switch | `[ngSwitch]` / `*ngSwitchCase` | `@switch (x) { @case (...) { } @default { } }` |
| Lazy template | none (custom directive) | `@defer (on viewport) { } @placeholder { }` |
| Template variable | `*ngIf="x as y"`, `ng-container` tricks | `@let y = x;` |
| Inputs | `@Input() name!: string` | `name = input<string>()`, `input.required<string>()` |
| Outputs | `@Output() saved = new EventEmitter<T>()` | `saved = output<T>()` |
| Two-way | `@Input() v` + `@Output() vChange` | `v = model<T>()` and `[(v)]` |
| Queries | `@ViewChild`, `@ContentChildren` | `viewChild()`, `viewChildren()`, `contentChild()` |
| Injection | `constructor(private http: HttpClient)` | `private readonly http = inject(HttpClient)` |
| Host binding | `@HostBinding`, `@HostListener` | `host: { '[class.x]': '...', '(click)': '...' }` |
| Component state | Plain fields, `BehaviorSubject` | `signal`, `computed`, `linkedSignal` |
| Derived values | Getter or `combineLatest` + `map` | `computed` |
| Side effects | `ngOnChanges`, `subscribe` | `effect` (sparingly) |
| Async data in templates | `observable$ \| async` | `toSignal(obs$)`, `resource`, `httpResource` |
| Subscriptions cleanup | `Subject` + `takeUntil(destroy$)` | `takeUntilDestroyed()`, `toSignal` |
| HTTP | `HttpClientModule` | `provideHttpClient(withInterceptors([...]))` |
| Interceptors | Class implementing `HttpInterceptor` | `HttpInterceptorFn` |
| Guards, resolvers | Classes (`CanActivate`) | Functions (`CanActivateFn`, `ResolveFn`) |
| Route params | `ActivatedRoute.paramMap.subscribe` | `withComponentInputBinding()` and `id = input<string>()` |
| Lazy routes | `loadChildren: () => import(...).then(m => m.Module)` | `loadComponent`, `loadChildren: () => import('./routes')` |
| Forms | Template-driven or reactive | Typed reactive forms, **Signal Forms** (stable in v22) |
| Change detection | `Default` plus zone.js | `OnPush` (default in v22), signals, zoneless (default since v21) |
| Init work | `APP_INITIALIZER` token | `provideAppInitializer(...)` |
| Tests | Karma and Jasmine | Vitest (default since v21), `TestBed`, `provideHttpClientTesting()` |
| Class names | `AppComponent` in `app.component.ts` | `App` in `app.ts` (v20 CLI naming, no suffix) |
| `Default` strategy | `ChangeDetectionStrategy.Default` | `ChangeDetectionStrategy.Eager` (same behaviour, new name) |

> **How to say it in an interview:** "I'm comfortable with both. In a new project I'd use the modern column. In an existing one I'd migrate feature by feature with the `ng generate` schematics rather than rewrite it."

## 5.2 Version timeline

| Version | Date | Highlights |
|---|---|---|
| **v14** | Jun 2022 | Standalone components (preview), typed forms, `inject()` |
| **v16** | May 2023 | Signals (preview), required inputs, `takeUntilDestroyed`, hydration (preview) |
| **v17** | Nov 2023 | `@if`/`@for`/`@switch`, `@defer`, new build with Vite and esbuild, signals stable |
| **v18** | May 2024 | Control flow and `@defer` stable, `@let` arrives (18.1), zoneless (experimental) |
| **v19** | Nov 2024 | Standalone **by default**, signal inputs/outputs/queries stable, `linkedSignal` and `resource` (experimental), incremental hydration (preview) |
| **v20** | May 2025 | `effect`, `linkedSignal`, `toSignal` stable, zoneless in developer preview, new file/class naming, host-binding type checking |
| **v21** | Nov 2025 | **Zoneless by default**, **Vitest** by default, Signal Forms (experimental), Angular Aria (developer preview) |
| **v22** | Jun 2026 | Signal Forms, `resource`/`httpResource` and Angular Aria **stable**, `OnPush` default, `@Service()`, `injectAsync()`, template spread/arrow functions, incremental hydration default |

Angular ships a major release roughly every 6 months (v22 moves toward a 12-month rhythm), each supported for about 18 months (6 active plus 12 LTS). Always check the current support table on angular.dev before quoting dates for a version you aren't certain about.

## 5.3 Error codes you should recognise

| Code | Meaning | Typical cause |
|---|---|---|
| `NG0100` | `ExpressionChangedAfterItHasBeenChecked` | A value changed during change detection (dev mode). In zoneless code: state changed without a signal, so the view is stale |
| `NG0203` | `inject()` called outside an injection context | `inject` in a callback, `setTimeout`, or a method. Use `runInInjectionContext` or pass the dependency in |
| `NG0950` | Required input read before it was set | Reading `input.required()` in the constructor or too early |
| `NG8118` | Compile error for the same case | Reading a required input directly in a field initialiser or constructor |
| `NG0200` | Circular dependency in DI | Two services injecting each other. Break with an interface or an event |
| `NG0201` | No provider found | Missing `providedIn: 'root'` or `providers: []` |
| `NG0303`/`NG8002` | Unknown property or can't bind | Directive or component missing from the component's `imports` |
## 5.4 Gotchas that interviewers love

1. **`async` pipe vs `subscribe`**: `async` cleans up on its own. `subscribe` needs manual cleanup (or `takeUntilDestroyed`).
2. **`switchMap` vs `mergeMap` vs `concatMap` vs `exhaustMap`**: latest wins and cancels, run in parallel, queue in order, ignore while busy. Search is `switchMap`, saves are `concatMap`, a login button is `exhaustMap`.
3. **Cold vs hot**: HTTP is cold (one request per subscriber). Use `shareReplay` or a signal to share a result.
4. **Pure pipes vs methods in templates**: pipes only re-run when input changes, methods run on every change-detection pass.
5. **`OnPush` and mutation**: new references, or signals, otherwise the view doesn't update.
6. **Signals notify by `Object.is`**: mutating an array or object in place is not a change.
7. **`effect` is for side effects**, not for deriving state. Use `computed` or `linkedSignal`.
8. **`resource.value()` throws in the error state**: check `hasValue()` or `error()` first.
9. **`ngOnInit` is not called again on a param change**: bind the param as an input, or watch the route stream.
10. **`track` needs a stable unique key**: `track $index` on stateful lists corrupts row state.
11. **Component-level `providers` create a new instance** per component. Use root for shared state.
12. **Don't call `bypassSecurityTrust*` on user data.**
13. **Browser APIs on the server**: guard with `afterNextRender`, `isPlatformBrowser`, or inject `DOCUMENT` rather than using `window`.
14. **`HttpClient` observables do nothing until subscribed**, and each subscription is a new request.
15. **Lazy routes only help if nothing eager imports them.** One stray import and the chunk lands in the main bundle.
16. **`ngOnChanges` still fires for signal inputs**, but prefer `computed` and `effect`.
17. **`TestBed` needs `await fixture.whenStable()`** for async work, but it also waits for pending HTTP, so flush your requests first.

## 5.5 Answering strategy

**For "explain X" questions** use this shape: **what it is** (one sentence), **why it exists** (the problem it solves), **a small example**, **a trade-off or gotcha**. Stop there, and let them ask a follow-up.

**For "what's the difference between A and B"**: one sentence each, then *when you'd pick each*. The "when" is the part that's graded.

**For design questions**: requirements → structure (components, services, routes) → data flow → edge cases (loading, empty, error, permissions) → performance → testing.

**When you don't know**: say "I haven't used that in production, but my understanding is… and I'd verify it in the docs". Honest, and still shows reasoning.

**Always have 3 stories ready** from your own work: a performance problem you fixed, a bug that took time to find, and something you built that others used or maintained. Stories beat definitions.

**Questions to ask them**: which Angular version and are signals used yet, how they structure state, how they test (unit, component, e2e), how releases and upgrades are handled.

## 5.6 The day-before checklist

**Foundations**
- [ ] I can explain standalone vs NgModule, and what `bootstrapApplication` does
- [ ] I can list the lifecycle hooks in order and say what each is for
- [ ] I can explain content projection (`ng-content`, `select`, `ng-template`)
- [ ] I can explain `inject()`, the provider hierarchy, and `providedIn: 'root'`
- [ ] I know the new control flow and why `track` is required

**Core**
- [ ] I can explain signals, `computed`, `effect`, `linkedSignal`, and when to use each
- [ ] I can explain `resource`/`httpResource` and the `hasValue()` trap
- [ ] I can explain `OnPush`, zoneless, and what triggers a view update
- [ ] I can explain `switchMap`/`mergeMap`/`concatMap`/`exhaustMap` with an example each
- [ ] I can build a typed reactive form with a cross-field and an async validator
- [ ] I can set up lazy routes, a functional guard, and a resolver

**Advanced**
- [ ] I can list five ways to improve performance and say how I'd find the problem first
- [ ] I can say when I'd choose signals-in-a-service, NgRx, or SignalStore
- [ ] I can test a component, a service with HTTP, and a guard
- [ ] I can explain SSR, hydration, and what breaks them
- [ ] I can explain XSS protection and where to store tokens
- [ ] I know what changed in the last three major versions

**Practice**
- [ ] I have written the todo list, typeahead, and data table from a blank file
- [ ] I can spot the bugs in the "find the bug" list within 30 seconds each
- [ ] I have two or three stories from my own work ready

**On the day**
- [ ] Ask clarifying questions before coding
- [ ] Think out loud
- [ ] Get a working version first, then improve it
- [ ] Mention testing, accessibility, and error states even if you don't have time to build them
