# Level 1 · Foundations

## 1.1 What Angular is and how an app is structured

**Angular is a full, opinionated framework** for building single-page applications in TypeScript. Unlike a UI library (React, for example), it ships the whole toolbox: components and templates, dependency injection, routing, forms, an HTTP client, testing utilities, a CLI and a compiler. You rarely need to choose a third-party library for the basics.

| Piece | Role |
|---|---|
| **Component** | A class + HTML template + styles. The unit of UI |
| **Template** | HTML with Angular syntax: bindings, control flow, pipes |
| **Directive** | Adds behaviour to an existing element (attribute directive) or changes the DOM structure |
| **Pipe** | Transforms a value for display: `{{ price \| currency }}` |
| **Service** | A class that holds logic or state, shared through dependency injection |
| **Router** | Maps URLs to components, handles guards, lazy loading, params |
| **Forms** | Template-driven, reactive, and (new) Signal Forms |
| **HttpClient** | Typed HTTP with interceptors |

**The compile model.** Angular templates are compiled **ahead of time (AOT)** during the build into plain JavaScript instructions (the compiler is called **Ivy**). That gives smaller bundles, early template errors (type-checked templates) and faster startup than compiling in the browser (JIT).

**Bootstrapping a standalone app:**

```ts
// main.ts
bootstrapApplication(App, appConfig);   // appConfig lists app-wide providers
```

**Standalone vs NgModule.** Before Angular 14, every component had to be declared in an `NgModule`, which also listed what it imported and exported. Now a component declares what it needs directly:

```ts
@Component({
  selector: 'app-user-card',
  imports: [DatePipe, RouterLink],          // what this template uses
  template: `<a [routerLink]="['/users', user().id]">{{ user().name }}</a>`,
})
export class UserCard { user = input.required<User>(); }
```

The old way, which you will still meet in older code:

```ts
@NgModule({
  declarations: [UserCardComponent],
  imports: [CommonModule, RouterModule],
  exports: [UserCardComponent],
})
export class UserModule {}
```

| | NgModule (legacy) | Standalone (current) |
|---|---|---|
| Where dependencies are listed | The module | The component's own `imports` |
| Boilerplate | More: every component belongs to exactly one module | Less |
| Lazy loading | `loadChildren: () => import('./x.module')` | `loadComponent` or `loadChildren` pointing at a routes array |
| Providers | `providers` in modules | `ApplicationConfig`, route `providers`, or `providedIn: 'root'` |
| Status | Still supported, not deprecated, but no longer the recommended default | Default since v19 |

> **Interview line:** "NgModules were Angular's original way to group and compile related code. Standalone components make each component self-describing, which removes a layer of indirection and makes lazy loading and tree-shaking simpler. Existing NgModule apps keep working and can be migrated gradually with `ng generate @angular/core:standalone`."

## 1.2 Components

A component is a **class** with a `@Component` decorator that ties it to a **template**, **styles** and a **selector**.

```ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-counter',                // use as <app-counter />
  template: `
    <button (click)="inc()">Clicked {{ count() }} times</button>
  `,
  styles: `button { padding: 8px 16px; }`,
})
export class Counter {
  protected readonly count = signal(0);
  protected inc() { this.count.update((c) => c + 1); }
}
```

**Key metadata**

| Field | Meaning |
|---|---|
| `selector` | The HTML tag (or attribute) that instantiates it. Use an app prefix (`app-`, `acme-`) to avoid clashing with real HTML elements |
| `template` / `templateUrl` | Inline or external HTML. Inline for small components |
| `styles` / `styleUrl` | Component-scoped CSS |
| `imports` | Other standalone components, directives, pipes this template uses |
| `providers` | Services scoped to this component and its children (a new instance per component) |
| `viewProviders` | Like `providers`, but not visible to projected content |
| `changeDetection` | `OnPush` (default since v22) or `Eager` (the old default, called `Default` before v22) |
| `encapsulation` | How styles are scoped (below) |
| `host` | Bindings and listeners on the component's own element |
| `hostDirectives` | Directives applied to the host element automatically (see 1.8) |

**Style encapsulation** (`ViewEncapsulation`)

| Mode | What happens |
|---|---|
| `Emulated` (default) | Angular adds unique attributes (`_ngcontent-abc`) to elements and rewrites selectors so component CSS only matches its own template |
| `ShadowDom` | Uses the browser's native shadow DOM |
| `None` | Styles are global |

Child components are **not** affected by parent styles in `Emulated` mode. Pass data or CSS custom properties (`--brand-color`) instead of reaching into children. `::ng-deep` pierces encapsulation but is **deprecated**, so avoid it.

**Host bindings.** Prefer the `host` metadata over the older `@HostBinding` / `@HostListener` decorators:

```ts
@Component({
  selector: 'app-tab',
  host: {
    role: 'tab',
    '[class.active]': 'active()',
    '[attr.aria-selected]': 'active()',
    '(keydown.enter)': 'select()',
  },
  template: `<ng-content />`,
})
export class Tab { active = input(false); select() { /* ... */ } }
```

**Conventions worth stating** (from the official style guide): one concept per file; file names in kebab-case matching the class (`user-profile.ts` holds `UserProfile`); organise by **feature area**, not by type (avoid top-level `components/`, `services/` folders); `protected` for members used only by the template; `readonly` for inputs, outputs, queries and signals that should never be reassigned.

## 1.3 Templates and data binding

**The four binding forms**

| Direction | Syntax | Example |
|---|---|---|
| Component → view | `{{ expr }}` interpolation | `{{ user().name }}` |
| Component → view | `[prop]="expr"` property binding | `<img [src]="avatarUrl()" />` |
| View → component | `(event)="handler($event)"` event binding | `<button (click)="save()">` |
| Both ways | `[(x)]="value"` two-way binding | `<app-rating [(value)]="stars" />` |

`[(x)]` is just sugar for `[x]="v"` plus `(xChange)="v = $event"`. This is how both `[(ngModel)]` and `model()` work (see 1.5).

**Property vs attribute binding.** HTML **attributes** initialise a DOM element. DOM **properties** are its live state. Angular binds to properties. When no property exists (for example `colspan`, or any `aria-*`), bind the attribute:

```html
<input [value]="name()" [disabled]="busy()" />       <!-- DOM properties -->
<td [attr.colspan]="span()"></td>                    <!-- attribute -->
<button [attr.aria-label]="'Delete ' + item().name"></button>
```

**Class and style bindings** (prefer these over `ngClass` / `ngStyle`: simpler and faster):

```html
<div [class.active]="isActive()" [style.width.px]="width()"></div>
<div [class]="{ admin: isAdmin(), dense: density() === 'high' }"></div>
```

**Template reference variables and `@let`**

```html
<input #search placeholder="Search" />
<button (click)="find(search.value)">Go</button>

@let fullName = user().first + ' ' + user().last;
<h1>{{ fullName }}</h1>
```

`#search` refers to the DOM element (or the component instance, if placed on a component). `@let` declares a read-only local variable, which is good for avoiding repeated expressions and for unwrapping an async value once.

**Safe navigation and non-null.** `user()?.address?.city` stops at `null` or `undefined` instead of throwing. In strict templates, `value!` tells the type checker "this is not null". Use it sparingly, because it silences a real check.

**Template expressions are deliberately limited**: no assignment (except in event handlers), no `new`, no chaining with `;`, no increment operators, and no access to globals like `window`. Keep them simple and move logic into `computed()` signals. Since v22, inline **arrow functions** are allowed (`items().filter(i => i.done).length`) and so are **spread** (`{ ...base, hot: isHot() }`) and **comments inside element tags**. Keep them short.

## 1.4 Built-in control flow

Angular 17 added block syntax that replaced the structural directives `*ngIf`, `*ngFor` and `*ngSwitch`. It is built into the compiler, so you do not import anything, it is faster, and it is type-narrowing friendly.

```html
@if (user(); as u) {
  <p>Hello {{ u.name }}</p>
} @else if (loading()) {
  <p>Loading…</p>
} @else {
  <p>Please sign in</p>
}

<ul>
  @for (todo of todos(); track todo.id; let i = $index, last = $last) {
    <li [class.done]="todo.done">{{ i + 1 }}. {{ todo.title }}{{ last ? ' (last)' : '' }}</li>
  } @empty {
    <li>Nothing to do</li>
  }
</ul>

@switch (status()) {
  @case ('pending') @case ('processing') { <span class="blue">In progress</span> }
  @case ('shipped') { <span class="green">Shipped</span> }
  @default { <span>Unknown</span> }
}
```

**`@for` essentials**

- **`track` is required.** It tells Angular how to identify an item between renders so it can reuse DOM nodes instead of destroying and recreating them. This was the optional `trackBy` of `*ngFor`.
- Track a **stable unique id** (`track item.id`). `track $index` is acceptable only for static lists that never reorder, insert or delete. Tracking by object identity (`track item`) is the compiler's fallback and is fine for primitives.
- Context variables: `$index`, `$count`, `$first`, `$last`, `$even`, `$odd`.
- `@empty` renders when the collection is empty.

**v22 `@switch` additions** (verified): several `@case` blocks can share one body (as above), and `@default never;` gives a compile-time exhaustiveness check on union types, so adding a new union member without handling it becomes a build error.

**Legacy syntax (still very common in existing apps, and still works)**

```html
<div *ngIf="user; else loadingTpl">{{ user.name }}</div>
<ng-template #loadingTpl><p>Loading…</p></ng-template>

<li *ngFor="let t of todos; trackBy: trackById; let i = index">{{ t.title }}</li>

<div [ngSwitch]="status">
  <span *ngSwitchCase="'a'">A</span>
  <span *ngSwitchDefault>?</span>
</div>
```

These need `NgIf`, `NgFor` (or `CommonModule`) in `imports`. Migrate with `ng generate @angular/core:control-flow`.

### `@defer`: lazy-load part of a template

`@defer` code-splits everything inside it (components, directives, pipes) into a separate chunk, loaded on a trigger.

```html
@defer (on viewport; prefetch on idle) {
  <app-comments [postId]="id()" />
} @placeholder (minimum 500ms) {
  <div class="skeleton"></div>
} @loading (after 100ms; minimum 1s) {
  <app-spinner />
} @error {
  <p>Could not load comments</p>
}
```

| Trigger | Fires when |
|---|---|
| `on idle` (default) | The browser is idle |
| `on viewport` | The placeholder (or a referenced element) scrolls into view |
| `on interaction` / `on hover` | The user clicks or hovers the placeholder |
| `on immediate` | Right away, after the rest of the page renders |
| `on timer(5s)` | After a delay |
| `when expr` | The boolean expression becomes true (once) |

`prefetch on …` downloads the chunk earlier without rendering it. **Rules:** the deferred things must be standalone, and they must not be referenced outside the block in the same file (otherwise they are bundled eagerly). `@placeholder` is what renders before the trigger. `minimum` and `after` stop flicker. `@defer` is the answer to "how do you reduce initial bundle size for a heavy widget?".

## 1.5 Component communication

**Signal-based inputs, outputs and `model`** (stable since v19, the current recommended style):

```ts
@Component({
  selector: 'app-rating',
  template: `
    @for (star of stars(); track star) {
      <button (click)="value.set(star)" [class.on]="star <= value()">★</button>
    }
    <button (click)="cleared.emit()">clear</button>
  `,
})
export class Rating {
  readonly max = input(5, { transform: numberAttribute });   // optional with default, string "5" → 5
  readonly label = input.required<string>();                 // parent must bind it
  readonly value = model(0);                                 // two-way: parent can use [(value)]
  readonly cleared = output<void>();                         // event to the parent

  protected readonly stars = computed(() => Array.from({ length: this.max() }, (_, i) => i + 1));
}
```

```html
<app-rating label="Quality" max="5" [(value)]="stars" (cleared)="reset()" />
```

I compiled and ran this pattern: a string attribute `age="42"` with `transform: numberAttribute` arrives as the number `42`, `(picked)` receives `$event`, and `[(count)]` updates the parent signal.

| API | What it is | Notes |
|---|---|---|
| `input<T>()` / `input(default)` | Read-only signal input | Optional. Read with `name()` |
| `input.required<T>()` | Required signal input | The compiler errors if the parent does not bind it |
| `input(v, { transform })` | Converts the bound value | `booleanAttribute`, `numberAttribute` are built in |
| `input(v, { alias })` | Public name differs from the field name | Prefer not to alias |
| `output<T>()` | Event emitter | `.emit(value)`. Not an RxJS Subject |
| `model<T>()` | Writable input + output pair | Enables `[(x)]`. The child can call `.set()` |

**Legacy decorators** (still everywhere in older code):

```ts
@Input() name = '';
@Input({ required: true }) id!: number;
@Output() saved = new EventEmitter<User>();
```

**Why signal inputs are better:** they are signals, so you derive state with `computed()` instead of `ngOnChanges`, they are type-safe (required inputs are checked at compile time), and they work with zoneless change detection.

**The four communication patterns**

| Direction | Mechanism |
|---|---|
| Parent → child | Inputs |
| Child → parent | Outputs (events) |
| Parent reads child | Template reference (`#child`) or `viewChild()` query. Use sparingly, it couples the two |
| Unrelated components (siblings, distant) | A **shared service** holding signals or observables, or a state library |

> **Rule of thumb:** data flows **down** through inputs, and events flow **up** through outputs. If you are passing the same value through four levels of components ("prop drilling"), move it into a service.

**Queries** (signal-based): `viewChild()`, `viewChildren()`, `contentChild()`, `contentChildren()`. They return signals, so they work inside `computed`/`effect`. The `.required` variants throw if the element is missing.

```ts
readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box');
readonly firstTab = contentChild(Tab);
focus() { this.box().nativeElement.focus(); }
```

`viewChild` looks in **this component's own template**. `contentChild` looks at what the parent **projected in** via `<ng-content>` (see 1.6).

## 1.6 Content projection

Projection lets a component accept markup from its parent, like a "slot" in other frameworks.

```ts
@Component({
  selector: 'app-card',
  template: `
    <header><ng-content select="[card-title]" /></header>
    <section><ng-content /></section>                    <!-- default slot: everything else -->
    <footer><ng-content select="footer" /></footer>
  `,
})
export class Card {}
```

```html
<app-card>
  <h2 card-title>Orders</h2>
  <p>Body goes to the default slot.</p>
  <footer>Footer goes to the footer slot.</footer>
</app-card>
```

I ran this and each piece landed in its slot. A few facts interviewers like:

- `select` takes a CSS selector (tag, attribute, class). `ngProjectAs` lets an `ng-container` pretend to match a selector.
- **The parent creates projected content, not the child.** Projected components are created and initialised by the parent whether or not the child ever shows the slot, even if the `<ng-content>` sits inside an `@if` that is false. If you need **lazy** content, project an `<ng-template>` instead and let the child decide when to stamp it out.
- **`<ng-container>`** renders no DOM element. It is a grouping node for structural logic. **`<ng-template>`** is a template that is not rendered until you instantiate it.

**Template projection** (a parent supplies a template, the child stamps it out with context, like "render props"):

```ts
@Component({
  selector: 'app-list',
  imports: [NgTemplateOutlet],
  template: `
    @for (item of items(); track item.id) {
      <ng-container
        [ngTemplateOutlet]="rowTpl() ?? defaultRow"
        [ngTemplateOutletContext]="{ $implicit: item, index: $index }" />
    }
    <ng-template #defaultRow let-item>{{ item.name }}</ng-template>
  `,
})
export class List {
  items = input.required<{ id: number; name: string }[]>();
  rowTpl = contentChild(TemplateRef);
}
```

```html
<app-list [items]="users()">
  <ng-template let-u let-i="index">{{ i }}. <b>{{ u.name }}</b></ng-template>
</app-list>
```

## 1.7 Lifecycle hooks

In the order they run for a component:

| # | Hook | Runs | Typical use |
|---|---|---|---|
| 0 | `constructor` | Once, at creation | Dependency injection, field initialisers, set up `effect()`. **Inputs are not available yet** |
| 1 | `ngOnChanges` | When a bound input changes (before `ngOnInit`) | React to input changes (with signal inputs prefer `computed`/`effect`) |
| 2 | `ngOnInit` | Once, after the first `ngOnChanges` | Initial setup that needs input values |
| 3 | `ngDoCheck` | Every change detection run | Custom change detection. Rare, keep it cheap |
| 4 | `ngAfterContentInit` | Once, after projected content is initialised | Work with `contentChild` |
| 5 | `ngAfterContentChecked` | After every check of projected content | Rare |
| 6 | `ngAfterViewInit` | Once, after the component's view and children are initialised | Work with `viewChild`, DOM measurement |
| 7 | `ngAfterViewChecked` | After every check of the view | Rare |
| 8 | `ngOnDestroy` | Once, before destruction | Clean up |

I verified the start of this order by logging each hook: `constructor → ngOnChanges → ngOnInit → ngDoCheck → ngAfterViewInit`, and `ngOnChanges` still fires for bound **signal** inputs.

**Modern replacements**

- **`afterNextRender(() => …)`** runs once after the next render, **only in the browser** (never during SSR). Use it for DOM measurement, third-party widgets, `window` or `document` access. **`afterEveryRender`** runs after every render, and **`afterRenderEffect`** is a signal-aware version of it.
- **`inject(DestroyRef).onDestroy(() => …)`** registers cleanup anywhere (in a service, a function, a constructor). It replaces most `ngOnDestroy` code.
- **`effect()`** replaces many `ngOnChanges` and `ngOnInit` data-sync patterns (see 2.1).

**`constructor` vs `ngOnInit`.** The constructor runs before inputs are set, so it should only wire things up (injection, signals, effects). Anything that reads an `@Input` value belongs in `ngOnInit` (or in a `computed`). Do **not** put HTTP calls or heavy logic in the constructor, because it makes the component hard to test.

**Cleanup checklist** (what you must release): manual `subscribe()` calls, `setInterval`/`setTimeout`, event listeners added with `addEventListener`, `ResizeObserver`/`IntersectionObserver`, WebSocket connections. The `async` pipe, `toSignal`, `takeUntilDestroyed`, and template event bindings clean up automatically.

## 1.8 Directives and pipes

**Three kinds of directive**

| Kind | Changes | Example |
|---|---|---|
| **Component** | It is a directive *with a template* | Everything |
| **Attribute directive** | Appearance or behaviour of an element | `[ngClass]`, `[routerLink]`, your own `[appHighlight]` |
| **Structural directive** | The DOM structure by adding/removing elements | `*ngIf`, `*ngFor` (legacy), custom `*appHasRole` |

A custom attribute directive:

```ts
@Directive({
  selector: '[appHighlight]',
  host: { '[style.background]': 'color()', '(mouseenter)': 'color.set("yellow")', '(mouseleave)': 'color.set("")' },
})
export class Highlight {
  protected readonly color = signal('');
}
```

```html
<p appHighlight>Hover me</p>
```

**Host directives** compose behaviour without inheritance. The component (or directive) lists directives that are applied to its host element automatically:

```ts
@Component({
  selector: 'app-menu-item',
  hostDirectives: [{ directive: Highlight }],
  template: `<ng-content />`,
})
export class MenuItem {}
```

I applied a `Bold` directive through `hostDirectives` and confirmed its host class was on the component's element. Since v22, a directive that matches both in the template and as a host directive is de-duplicated and the template match wins.

**Pipes** transform values for display.

```html
{{ price | currency:'USD' }}  {{ born | date:'mediumDate' }}  {{ name | uppercase }}
{{ items | slice:0:3 }}  {{ obj | json }}  {{ ratio | percent:'1.0-1' }}
@for (kv of map | keyvalue; track kv.key) { {{ kv.key }}={{ kv.value }} }
```

Built-in: `date`, `currency`, `number`, `percent`, `json`, `slice`, `uppercase`, `lowercase`, `titlecase`, `keyvalue`, `async`, `i18nPlural`, `i18nSelect`.

```ts
@Pipe({ name: 'truncate' })                       // pure by default
export class TruncatePipe implements PipeTransform {
  transform(value: string, max = 20): string {
    return value.length > max ? value.slice(0, max) + '…' : value;
  }
}
```

| | Pure pipe (default) | Impure pipe (`pure: false`) |
|---|---|---|
| Re-runs when | The **input reference or primitive value** changes | **Every change detection run** |
| Cost | Cheap, effectively memoised | Can be expensive |
| Example | `date`, `currency`, `uppercase` | `async` |

A pure pipe will not notice if you mutate an array in place and pass the same reference. Create a new array, or prefer a `computed()`. **Pipe vs method call in a template:** a pure pipe is cached, while `{{ format(x) }}` runs on every check of that template, so pipes (or `computed`) are better for anything non-trivial.

**The `async` pipe** subscribes to an Observable (or Promise), renders the latest value, unsubscribes automatically on destroy, and marks the view for check. In signal-based code, `toSignal(obs$)` does the same job with less template noise.

## 1.9 Dependency injection (DI)

**What it is.** A component declares *what* it needs, and Angular's injector supplies it. You never write `new HttpClient()`. **Why:** loose coupling, easy testing (swap a real service for a fake), and controlled lifetimes and sharing.

```ts
@Injectable({ providedIn: 'root' })        // one app-wide instance, tree-shakable
export class UserApi {
  private readonly http = inject(HttpClient);
  getUser(id: number) { return this.http.get<User>(`/api/users/${id}`); }
}

@Component({ /* … */ })
export class Profile {
  private readonly api = inject(UserApi);          // modern style
  // constructor(private api: UserApi) {}          // legacy style, still valid
}
```

**`inject()` vs constructor injection.** `inject()` is the style guide's recommendation: shorter, better type inference, works in field initialisers and **functions** (functional guards, interceptors, resolvers), and avoids long constructor parameter lists. It only works in an **injection context** (constructor, field initialiser, `runInInjectionContext`, a provider factory). Calling it elsewhere throws error `NG0203`, which I confirmed.

**New in v22: `@Service()`.** A shorter way to declare an app-wide singleton:

```ts
@Service()
export class BasicDataStore {
  private data: string[] = [];
  add(item: string) { this.data.push(item); }
}
```

It is equivalent to `@Injectable({ providedIn: 'root' })` for the common case. Per the release notes, `@Injectable` is still available for deeper configuration or constructor injection. I verified `TestBed.inject(Store)` returns the same instance twice. You will still see `@Injectable({ providedIn: 'root' })` in nearly every codebase.

**The injector hierarchy.** Angular looks for a provider walking **up**:

1. **Element injectors**: the component or directive itself (`providers` / `viewProviders`), then its parents in the DOM tree.
2. **Environment injectors**: route-level `providers`, lazy-loaded route injectors, then the **root** environment injector (`providedIn: 'root'`, `ApplicationConfig.providers`).
3. The **platform** injector, then a "null" injector that throws `NullInjectorError`.

So **where you provide a service sets its scope and lifetime**:

| Provided in | Scope |
|---|---|
| `providedIn: 'root'` | One instance for the whole app (and tree-shaken if unused) |
| A route's `providers` | One per route injector. Destroyed with it |
| A component's `providers` | **A new instance per component instance**, shared with its children. I confirmed two `<app-x />` siblings got different instances while the root service was shared |

**Provider recipes**

```ts
providers: [
  { provide: Logger, useClass: ConsoleLogger },           // swap implementation (abstract class as token)
  { provide: API_URL, useValue: 'https://api.example.com' }, // constant
  { provide: Cache, useFactory: () => new Cache(inject(CONFIG).size) },
  { provide: OldLogger, useExisting: Logger },            // alias
  { provide: HTTP_HOOKS, useValue: hookA, multi: true },  // collect many into an array
]
```

**`InjectionToken`** is how you inject things that have no class (strings, config objects, interfaces):

```ts
export const API_URL = new InjectionToken<string>('API_URL', {
  providedIn: 'root',
  factory: () => 'https://api.example.com',      // default, tree-shakable
});
```

**Resolution modifiers** (as options to `inject`): `{ optional: true }` returns `null` instead of throwing. `{ self: true }` looks only at the current element injector. `{ skipSelf: true }` starts at the parent (useful to find a parent instance of the same type). `{ host: true }` stops at the host element.

**New in v22: `injectAsync()`** lazy-loads a service's code on first use:

```ts
export class Report {
  private readonly exporter = injectAsync(() => import('./report-exporter'), { prefetch: onIdle });
  async export() { (await this.exporter()).export(); }
}
```

The loaded service must be auto-provided (`@Service()` does that). I wrote a `@Service()` class in a separate file and confirmed the dynamic import resolves to a working instance.

**Common DI errors**

- `NullInjectorError: No provider for X`: the service is not `providedIn: 'root'` and nobody listed it in `providers`.
- Circular dependency: A injects B injects A. Break it by extracting shared logic into a third service.
- A service provided in a component, expected to be shared app-wide: each component gets its own copy.

## 1.10 Quick-fire Q&A (Foundations)

**What is Angular, and how is it different from React?** A full framework (router, forms, HTTP, DI and CLI included, TypeScript-first, opinionated) versus React, a UI library where you assemble the rest.

**What is a standalone component?** One that declares its own template dependencies in `imports` and needs no `NgModule`. It is the default since v19.

**Difference between a component and a directive?** A component is a directive with a template. Directives add behaviour to existing elements.

**What does `track` do in `@for`?** It gives each item an identity so Angular can reuse DOM nodes when the list changes instead of rebuilding them.

**`ng-container` vs `ng-template` vs `ng-content`?** A grouping node that renders no element, a template that renders only when instantiated, and a projection slot for parent-supplied content.

**Property binding vs interpolation?** Interpolation always converts to a string. Property binding passes the actual value (a boolean to `disabled`, an object to an input).

**What is a pure pipe?** One that re-runs only when its inputs change by reference or primitive value. Cached across change detection runs.

**What is the difference between `ngOnInit` and the constructor?** The constructor runs at class creation (for DI and field setup), before inputs are set. `ngOnInit` runs after the first input binding.

**Why prefer `inject()` over constructor parameters?** Readability, type inference, usable in functions, and no long parameter lists.

**What does `providedIn: 'root'` mean?** The service is registered in the root injector as a singleton and tree-shaken if never used.

**How would you share state between two unrelated components?** A service in the root injector that holds a signal (or a `BehaviorSubject`).

**What is view encapsulation?** How component CSS is scoped. `Emulated` (default) rewrites selectors using generated attributes, `ShadowDom` uses native shadow DOM, `None` is global.

**`@ViewChild` vs `@ContentChild`?** View queries look in the component's own template. Content queries look at projected content.

**What is `@defer` for?** Lazy-loading part of a template (and its dependencies) on a trigger such as viewport, interaction or idle, to cut the initial bundle.

**How do you avoid memory leaks from subscriptions?** `async` pipe, `toSignal`, `takeUntilDestroyed()`, or `DestroyRef`. Also remove event listeners and timers.

**What is `ng-content` `select` for?** Multi-slot projection: route different pieces of parent markup into different places in the child.

**What is a host directive?** A directive applied to a component's host element through `hostDirectives`, a composition tool instead of inheritance.
