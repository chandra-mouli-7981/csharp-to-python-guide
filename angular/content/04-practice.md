# Level 4 · Practice

## 4.0 How to attack a coding round

Mid-level Angular rounds are usually "build a small component" (30 to 45 minutes) or "review this code and tell me what's wrong". The interviewer is grading how you think, not whether you finish.

1. **Clarify first.** Inputs and outputs? Empty, loading and error states? Does it need to be reusable? Accessibility?
2. **Model the state.** What is the *source* state (a signal), and what is *derived* (a `computed`)? Never store something you can compute.
3. **Name the data flow.** Data down through `input()`, events up through `output()`. Say it out loud.
4. **Build the happy path, then the edges.** Empty list, double click, slow network, error, rapid typing, destroying the component.
5. **Mention what you'd add with more time**: tests, a11y, `OnPush`, virtualisation, error reporting. That shows seniority without costing minutes.

Every solution below was compiled and run in an Angular 22.2.5 project with Vitest. The style is current: standalone, signals, `inject()`, the new control flow, and the v22 naming (no `Component` suffix on class names). Imports are left out to keep the code short, and they all come from `@angular/core`, `@angular/common/http`, `@angular/forms` and `rxjs`.

> **Tip:** if the company is on an older version, say so, then write the same solution with `*ngIf`/`*ngFor`, constructor injection and `@Input()`/`@Output()`. Knowing both is the point of this guide.

## 4.1 Easy problems

### E1 · Todo list

**Task:** add items, toggle done, remove, filter by all/open/done, and show how many are left.

**What they look for:** immutable updates of a signal, `computed` for derived values, `@for` with `track` on a real id, `@empty`.

```typescript
export interface Todo { id: number; title: string; done: boolean }
export type Filter = 'all' | 'open' | 'done';

@Component({
  selector: 'app-todos',
  template: `
    <form (submit)="add($event, box)">
      <input #box placeholder="What needs doing?" />
      <button>Add</button>
    </form>
    <nav>
      @for (f of filters; track f) {
        <button type="button" [class.active]="filter() === f" (click)="filter.set(f)">{{ f }}</button>
      }
    </nav>
    <ul>
      @for (t of visible(); track t.id) {
        <li [class.done]="t.done">
          <input type="checkbox" [checked]="t.done" (change)="toggle(t.id)" />
          {{ t.title }}
          <button type="button" [attr.aria-label]="'Remove ' + t.title" (click)="remove(t.id)">×</button>
        </li>
      } @empty {
        <li>Nothing here</li>
      }
    </ul>
    <p>{{ openCount() }} left</p>
  `,
})
export class Todos {
  protected readonly filters: Filter[] = ['all', 'open', 'done'];
  private nextId = 1;

  protected readonly todos = signal<Todo[]>([]);
  protected readonly filter = signal<Filter>('all');

  protected readonly visible = computed(() => {
    const f = this.filter();
    return this.todos().filter((t) => f === 'all' || (f === 'done') === t.done);
  });
  protected readonly openCount = computed(() => this.todos().filter((t) => !t.done).length);

  protected add(e: Event, box: HTMLInputElement) {
    e.preventDefault();
    const title = box.value.trim();
    if (!title) return;
    this.todos.update((list) => [...list, { id: this.nextId++, title, done: false }]);
    box.value = '';
  }
  protected toggle(id: number) {
    this.todos.update((list) => list.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }
  protected remove(id: number) {
    this.todos.update((list) => list.filter((t) => t.id !== id));
  }
}
```

**Follow-ups they ask**

- *Why a new array and a new object instead of `push` or `t.done = !t.done`?* Signals notify only when the value changes by `Object.is`. Mutating in place keeps the same reference, so nothing updates (see the bug list in 4.4). It also keeps `OnPush` children correct.
- *Why `track t.id`?* So Angular moves the existing DOM nodes when the list changes, instead of recreating them. `track $index` would reuse the wrong row's state after a delete.
- *How would you persist it?* An `effect` that writes to `localStorage`, loaded in the initialiser. Guard it for the server with `isPlatformBrowser` or `afterNextRender`.
- *How would you test it?* Render, type, submit, query the DOM. Test behaviour, not signal internals.

### E2 · A pipe: initials

**Task:** `{{ 'ada lovelace' | initials }}` gives `AL`.

```typescript
@Pipe({ name: 'initials' })
export class InitialsPipe implements PipeTransform {
  transform(name: string | null | undefined): string {
    if (!name) return '';
    return name.trim().split(/\s+/).map((w) => w[0]!.toUpperCase()).slice(0, 2).join('');
  }
}
```

**Talking points:** pipes are pure by default, so they re-run only when the input *reference or value* changes (a primitive string is perfect). A pure pipe is a cheap memoised function, which is why it beats a method call in a template. Handle `null` since it will often sit behind an `async` pipe. Import it in the component's `imports`.

### E3 · A directive: click outside

**Task:** close a dropdown when the user clicks anywhere outside it.

```typescript
@Directive({
  selector: '[appClickOutside]',
  host: { '(document:click)': 'onDocClick($event)' },
})
export class ClickOutside {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly appClickOutside = output<void>();

  protected onDocClick(e: Event) {
    if (!this.el.nativeElement.contains(e.target as Node)) this.appClickOutside.emit();
  }
}
```

```html
@if (open()) {
  <div class="menu" (appClickOutside)="open.set(false)">…</div>
}
```

**Talking points:** the `host` metadata replaces `@HostListener` (preferred in modern Angular), and a host listener is removed automatically when the directive is destroyed. The directive only exists while the menu is rendered, so there is no listener leak. Known gap: the click that *opens* the menu can also close it if the button is outside the menu element. Fix by checking a trigger element, or by calling `stopPropagation` on the trigger.

## 4.2 Medium problems

### M1 · Debounced typeahead search

**Task:** an input that searches an API as you type. Don't spam the server, ignore stale responses, and show loading, error and result states.

**What they look for:** `debounceTime`, `distinctUntilChanged`, **`switchMap`** (cancels the old request), `catchError` placed *inside* the inner stream so the search keeps working after an error.

```typescript
export type SearchState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; items: string[] }
  | { status: 'error' };

@Component({
  selector: 'app-search',
  template: `
    <input [value]="query()" (input)="onInput($event)" />
    @switch (state().status) {
      @case ('loading') { <p>Searching…</p> }
      @case ('error') { <p>Something went wrong</p> }
      @case ('ok') { <ul>@for (i of items(); track i) { <li>{{ i }}</li> }</ul> }
    }
  `,
})
export class Search {
  private readonly api = inject(SearchApi);
  protected readonly query = signal('');

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      debounceTime(300),
      map((q) => q.trim()),
      distinctUntilChanged(),
      switchMap((q): Observable<SearchState> =>
        q.length < 2
          ? of({ status: 'idle' })
          : this.api.search(q).pipe(
              map((items): SearchState => ({ status: 'ok', items })),
              catchError(() => of<SearchState>({ status: 'error' })),  // inner: the stream survives
              startWith<SearchState>({ status: 'loading' }),
            ),
      ),
    ),
    { initialValue: { status: 'idle' } as SearchState },
  );

  protected readonly items = computed(() => {
    const s = this.state();
    return s.status === 'ok' ? s.items : [];
  });

  protected onInput(e: Event) { this.query.set((e.target as HTMLInputElement).value); }
}
```

**Follow-ups**

- *Why `switchMap` and not `mergeMap`?* `mergeMap` lets slow, old responses arrive after newer ones and overwrite them. `switchMap` unsubscribes from the previous inner request, which also cancels the HTTP call.
- *Why `catchError` inside?* An error that reaches the outer stream completes it, and typing would do nothing afterwards.
- *Why `toSignal`?* It subscribes, and unsubscribes when the component is destroyed. No manual cleanup.
- *Why a discriminated union for state?* Impossible states (`loading` and `error` together) can't exist, and `@switch` narrows nicely.
- *The `resource` alternative:* `resource({ params: () => query(), loader })` cancels and reloads for you through the `abortSignal`. Add the debounce on the *source* signal. It is shorter, and a perfectly good answer in a modern codebase.

### M2 · A reusable modal with content projection

**Task:** `<app-modal>` with a title, body content from the parent, and an actions area. Open state two-way bound.

```typescript
@Component({
  selector: 'app-modal',
  template: `
    @if (open()) {
      <div class="backdrop" (click)="close()"></div>
      <div class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()">
        <header>
          <h2>{{ title() }}</h2>
          <button type="button" (click)="close()" aria-label="Close">×</button>
        </header>
        <section><ng-content /></section>
        <footer><ng-content select="[modal-actions]" /></footer>
      </div>
    }
  `,
})
export class Modal {
  readonly open = model(false);                 // two-way: [(open)]
  readonly title = input.required<string>();
  readonly closed = output<void>();

  protected close() { this.open.set(false); this.closed.emit(); }
}
```

```html
<app-modal [(open)]="showDelete" title="Delete project?" (closed)="track('dismissed')">
  <p>This cannot be undone.</p>
  <button modal-actions (click)="confirm()">Delete</button>
</app-modal>
```

**Talking points:** `model()` makes `[(open)]` work with signals. `ng-content` with `select` gives named slots. Say what is **missing** and how you'd add it: focus trap and return focus to the trigger, `Escape` to close, scroll lock, and `inert` on the background. The CDK `Dialog` (or Angular Aria) already does all that, and reaching for it in real life is the right call. Reminder from 1.6: projected content is created by the *parent*, even when the modal is closed.

### M3 · Registration form with validation (reactive, typed)

**Task:** username (required, min 3, must not be taken, checked asynchronously), password (min 8), confirm password must match. Submit disabled until valid.

**What they look for:** typed `NonNullableFormBuilder`, a **group-level** validator for cross-field rules, an async validator, `pending` state, showing errors only after interaction.

```typescript
export const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const { password, confirm } = group.value as { password: string; confirm: string };
  return password === confirm ? null : { mismatch: true };      // the error lives on the GROUP
};

export const usernameFree = (taken: string[]): AsyncValidatorFn => (control) =>
  timer(50).pipe(                                                 // stands in for a debounced server call
    map(() => (taken.includes(control.value) ? { taken: true } : null)),
  );

@Component({
  selector: 'app-signup',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <input formControlName="username" />
      @if (c.username.touched || c.username.dirty) {
        @if (c.username.hasError('required')) { <small>Required</small> }
        @else if (c.username.hasError('minlength')) { <small>At least 3 characters</small> }
        @else if (c.username.hasError('taken')) { <small>Already taken</small> }
        @else if (c.username.pending) { <small>Checking…</small> }
      }
      <input type="password" formControlName="password" />
      <input type="password" formControlName="confirm" />
      @if (form.hasError('mismatch') && c.confirm.touched) { <small>Passwords do not match</small> }
      <button [disabled]="form.invalid || form.pending">Create account</button>
    </form>
  `,
})
export class Signup {
  private readonly fb = inject(NonNullableFormBuilder);
  readonly saved = output<{ username: string; password: string }>();
  readonly takenNames = input<string[]>(['admin']);

  protected readonly form = this.fb.group(
    {
      username: ['', {
        validators: [Validators.required, Validators.minLength(3)],
        asyncValidators: [(c: AbstractControl) => usernameFree(this.takenNames())(c)],
      }],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirm: [''],
    },
    { validators: passwordsMatch },
  );
  protected get c() { return this.form.controls; }

  protected submit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const { username, password } = this.form.getRawValue();       // typed: no `any`
    this.saved.emit({ username, password });
  }
}
```

**Follow-ups**

- *Why is the "passwords match" error on the group?* It depends on two controls. A control-level validator can only see its own value.
- *Why do async validators run only when the sync ones pass?* So you don't call the server for a value that is already invalid. While running, the control is `pending`, so disable submit while `form.pending`.
- *Why `getRawValue()`?* `value` omits disabled controls, and `getRawValue()` includes them.
- *Signal Forms version:* the same form is a `signal` model plus `form(model, (p) => { required(p.username); minLength(p.username, 3); validate(p.confirm, ...) })` and `[formField]` on the inputs. Know it exists and that it is stable in v22, but expect most codebases to still use reactive forms.

### M4 · A custom form control (counter) that works with `formControl` / `ngModel`

**Task:** a `- 0 +` stepper component usable as `<app-counter-input formControlName="qty">`.

```typescript
@Component({
  selector: 'app-counter-input',
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => CounterInput), multi: true }],
  template: `
    <button type="button" (click)="change(-1)" [disabled]="disabled()">−</button>
    <span>{{ value() }}</span>
    <button type="button" (click)="change(1)" [disabled]="disabled()">+</button>
  `,
})
export class CounterInput implements ControlValueAccessor {
  protected readonly value = signal(0);
  protected readonly disabled = signal(false);
  private onChange: (v: number) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: number | null) { this.value.set(v ?? 0); }              // form → view
  registerOnChange(fn: (v: number) => void) { this.onChange = fn; }     // view → form
  registerOnTouched(fn: () => void) { this.onTouched = fn; }
  setDisabledState(isDisabled: boolean) { this.disabled.set(isDisabled); }

  protected change(delta: number) {
    const next = this.value() + delta;
    this.value.set(next);
    this.onChange(next);
    this.onTouched();
  }
}
```

**Same control for Signal Forms** (much shorter, no accessor, no provider):

```typescript
@Component({
  selector: 'app-counter-control',
  template: `
    <button type="button" (click)="value.set(value() - 1)" [disabled]="disabled()">−</button>
    <span>{{ value() }}</span>
    <button type="button" (click)="value.set(value() + 1)" [disabled]="disabled()">+</button>
  `,
})
export class CounterControl implements FormValueControl<number> {
  readonly value = model(0);
  readonly disabled = input(false);
}
```

```html
<app-counter-control [formField]="f.qty" />
```

**Talking points:** `ControlValueAccessor` is the four-method contract between the forms API and your component. `forwardRef` is needed because the class isn't defined yet when the decorator runs. Don't forget `setDisabledState` and `onTouched`, which interviewers check. With `FormValueControl`, the `value` model *is* the contract.

### M5 · Server-side pagination with `httpResource`

**Task:** a paged user list. Prev/Next, loading and error states, retry, and the pager must not jump to "1 / 1" while loading.

```typescript
export interface Page<T> { items: T[]; total: number }

@Component({
  selector: 'app-users',
  template: `
    @if (users.isLoading()) { <p>Loading…</p> }
    @if (users.error()) { <p>Failed <button type="button" (click)="users.reload()">Retry</button></p> }
    @if (users.hasValue()) {                       <!-- value() THROWS while the resource is in error -->
      <ul>@for (u of users.value().items; track u) { <li>{{ u }}</li> }</ul>
    }
    <button type="button" (click)="page.set(page() - 1)" [disabled]="page() === 1">Prev</button>
    <span>{{ page() }} / {{ totalPages() }}</span>
    <button type="button" (click)="page.set(page() + 1)" [disabled]="page() >= totalPages()">Next</button>
  `,
})
export class Users {
  private readonly size = 10;
  protected readonly page = signal(1);

  protected readonly users = httpResource<Page<string>>(() => ({
    url: '/api/users',
    params: { page: this.page(), size: this.size },
  }));

  // Remember the last known total, so the pager doesn't collapse while the next page loads.
  protected readonly total = linkedSignal<number | undefined, number>({
    source: () => (this.users.hasValue() ? this.users.value().total : undefined),
    computation: (t, previous) => t ?? previous?.value ?? 0,
  });
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.total() / this.size)));
}
```

**Talking points**

- The request function is *reactive*: change `page` and the resource re-fetches, cancelling the in-flight request. Reading signals inside it is what makes it track.
- `value()` **throws** when the resource is in the `error` state, so guard with `hasValue()`. This is a trap that costs candidates in live coding.
- While a new page loads, the status is `loading` (first load) or `reloading` (a refresh with a previous value kept). `linkedSignal` keeps the previous total so the UI doesn't flicker.
- With the pre-resource approach: a `BehaviorSubject<number>` for the page, `switchMap` to `http.get`, `toSignal` or `async` for the output.

### M6 · "In view" directive for infinite scroll or lazy images

**Task:** emit an event when an element scrolls into view (put it on a sentinel at the end of a list to load the next page).

```typescript
@Directive({ selector: '[appInView]' })
export class InView {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  readonly appInView = output<void>();

  constructor() {
    afterNextRender(() => {                                  // browser only, never on the server
      const observer = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) this.appInView.emit(); },
        { rootMargin: '200px' },
      );
      observer.observe(this.el.nativeElement);
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }
}
```

```html
@for (item of items(); track item.id) { <app-card [item]="item" /> }
<div (appInView)="loadMore()"></div>
```

**Talking points:** `IntersectionObserver` instead of a scroll handler, which would fire constantly. `afterNextRender` is the safe place for browser-only APIs (SSR has no `IntersectionObserver`). Disconnect on destroy, otherwise it leaks. For real infinite scroll, also guard `loadMore` against being called while a request is already in flight, and stop when there is no next page. For huge lists, mention CDK virtual scroll.

## 4.3 Hard problems

### H1 · A generic, reusable data table

**Task:** `<app-table [rows] [columns]>` for any row type. Text filter, click-to-sort, pagination. Must not mutate its input.

```typescript
export interface Column<T> { key: keyof T & string; header: string }

@Component({
  selector: 'app-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <input placeholder="Filter" [value]="filter()" (input)="filter.set($any($event.target).value)" />
    <table>
      <thead><tr>
        @for (c of columns(); track c.key) {
          <th (click)="sortBy(c.key)" [attr.aria-sort]="ariaSort(c.key)">{{ c.header }}</th>
        }
      </tr></thead>
      <tbody>
        @for (row of pageRows(); track $index) {
          <tr>@for (c of columns(); track c.key) { <td>{{ row[c.key] }}</td> }</tr>
        }
      </tbody>
    </table>
    <button type="button" (click)="page.set(page() - 1)" [disabled]="page() === 1">Prev</button>
    <span>{{ page() }} / {{ pageCount() }}</span>
    <button type="button" (click)="page.set(page() + 1)" [disabled]="page() >= pageCount()">Next</button>
  `,
})
export class DataTable<T extends Record<string, unknown>> {
  readonly rows = input.required<T[]>();
  readonly columns = input.required<Column<T>[]>();
  readonly pageSize = input(10);

  protected readonly filter = signal('');
  protected readonly sort = signal<{ key: string; dir: 'asc' | 'desc' } | null>(null);

  // Resets to page 1 whenever the filter, the sort or the data changes, yet the pager can still set it.
  protected readonly page = linkedSignal({
    source: () => ({ f: this.filter(), s: this.sort(), rows: this.rows() }),
    computation: () => 1,
  });

  private readonly filtered = computed(() => {
    const q = this.filter().trim().toLowerCase();
    if (!q) return this.rows();
    return this.rows().filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(q)));
  });

  private readonly sorted = computed(() => {
    const s = this.sort();
    if (!s) return this.filtered();
    const dir = s.dir === 'asc' ? 1 : -1;
    return [...this.filtered()].sort((a, b) => {            // copy: never sort a signal's array in place
      const x = a[s.key], y = b[s.key];
      return (x! < y! ? -1 : x! > y! ? 1 : 0) * dir;
    });
  });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.pageSize())));
  protected readonly pageRows = computed(() => {
    const start = (this.page() - 1) * this.pageSize();
    return this.sorted().slice(start, start + this.pageSize());
  });

  protected sortBy(key: string) {
    this.sort.update((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }
  protected ariaSort(key: string) {
    const s = this.sort();
    return s?.key === key ? (s.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  }
}
```

```html
<app-table [rows]="users()" [columns]="[{ key: 'name', header: 'Name' }, { key: 'age', header: 'Age' }]" />
```

**Talking points**

- **A pipeline of `computed`s**: filter, then sort, then slice. Each step caches, and only recomputes when its own dependencies change.
- **The page-reset bug**: if you keep `page` as a plain signal, filtering down to 1 page while on page 3 leaves you on an empty page 3. `linkedSignal` fixes this declaratively: it resets when the source changes, and remains writable.
- **`.sort()` mutates**. Sorting `this.rows()` directly would reorder the *parent's* array. Copy first.
- **Generics**: `T extends Record<string, unknown>` and `keyof T & string` make column keys type-safe.
- **Scaling**: more than a few thousand rows means server-side filter/sort/page (the M5 pattern), or CDK virtual scroll. Say the trade-off.
- **Ideas for extension**: custom cell templates via `contentChild(TemplateRef)` / `ngTemplateOutlet`, multi-column sort, column resize, selection.

> **Heads-up:** `track $index` above is fine *for this read-only table*. For rows with state (inputs, expanded details), use a real id so the state follows the row. Add a `trackBy` key input if you need it.

### H2 · Auth interceptor with token refresh

**Task:** attach a token to every request. On a `401`, refresh the token **once** (even when many requests fail together), retry the failed request, and never loop on the refresh call itself.

```typescript
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly _token = signal<string | null>(null);
  readonly token = this._token.asReadonly();
  private refreshing: Observable<string> | null = null;

  refresh(): Observable<string> {
    this.refreshing ??= this.http.post<{ token: string }>('/auth/refresh', {}).pipe(
      map((r) => r.token),
      tap((t) => this._token.set(t)),
      finalize(() => { this.refreshing = null; }),
      shareReplay(1),                                        // everyone waiting shares one refresh
    );
    return this.refreshing;
  }
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const withToken = (r: HttpRequest<unknown>, t: string | null) =>
    t ? r.clone({ setHeaders: { Authorization: `Bearer ${t}` } }) : r;

  return next(withToken(req, auth.token())).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || req.url.startsWith('/auth/')) return throwError(() => err);
      return auth.refresh().pipe(switchMap((t) => next(withToken(req, t))));   // retry once
    }),
  );
};

// app.config.ts
provideHttpClient(withInterceptors([authInterceptor]));
```

**Talking points**

- **The race**: ten requests fire, all get `401`. Without sharing, you call refresh ten times (and with rotating refresh tokens, nine of them fail and log the user out). `shareReplay(1)` on one in-flight observable fixes it.
- **No infinite loop**: skip `/auth/` URLs, and retry only once, because the retry goes through `next` (which passes through *later* interceptors only) rather than the whole chain again.
- **Requests are immutable**, so `clone`. Interceptors run in order on the way out and in reverse on the way back.
- **If the refresh fails**: clear the session and navigate to login. Add that in the `catchError` of `refresh()`.
- **Security**: prefer a refresh token in an `HttpOnly` cookie. Keep the short-lived access token in memory.
- **Testing**: `HttpTestingController`. `expectOne` the request, flush a `401`, expect one refresh request, flush the new token, expect the retry with the new header.

### H3 · Undo / redo

**Task:** a reusable history for any state, with `set`, `undo`, `redo`, `canUndo`, `canRedo`.

```typescript
export function createHistory<T>(initial: T) {
  const past = signal<T[]>([]);
  const present = signal<T>(initial);
  const future = signal<T[]>([]);

  return {
    value: present.asReadonly(),
    canUndo: computed(() => past().length > 0),
    canRedo: computed(() => future().length > 0),
    set(v: T) { past.update((p) => [...p, present()]); present.set(v); future.set([]); },
    undo() {
      const p = past();
      if (!p.length) return;
      future.update((f) => [present(), ...f]);
      present.set(p[p.length - 1]);
      past.set(p.slice(0, -1));
    },
    redo() {
      const f = future();
      if (!f.length) return;
      past.update((p) => [...p, present()]);
      present.set(f[0]);
      future.set(f.slice(1));
    },
  };
}
```

**Talking points:** a *new* edit clears the redo stack. State is immutable (copies, never in-place), which is what makes snapshots safe. Expose read-only signals. For large state, cap the history length, or store patches instead of full copies. It is a plain function (a factory), so it works inside any injection context or service.

### H4 · Optimistic update with rollback

**Task:** toggle a todo instantly, send the request, and if it fails, undo the change and tell the user.

```typescript
@Injectable({ providedIn: 'root' })
export class TodoStore {
  private readonly http = inject(HttpClient);
  readonly todos = signal<Todo[]>([]);
  readonly error = signal<string | null>(null);

  async toggle(id: number) {
    const previous = this.todos();                          // snapshot for rollback
    const target = previous.find((t) => t.id === id);
    if (!target) return;

    this.todos.update((l) => l.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));  // optimistic
    this.error.set(null);
    try {
      await firstValueFrom(this.http.patch<Todo>(`/api/todos/${id}`, { done: !target.done }));
    } catch {
      this.todos.set(previous);                             // rollback
      this.error.set('Could not save. Your change was undone.');
    }
  }
}
```

**Talking points:** the snapshot works *because the update was immutable*. `firstValueFrom` turns a one-shot HTTP observable into a promise (never use it on a stream that doesn't complete). Weak point to mention: if the user toggles twice quickly, a rollback to an older snapshot can erase the second change. Fixes: disable the row while pending, queue the requests per id (`concatMap`), or roll back only that item instead of the whole list.

## 4.4 Find the bug

For each snippet, say what is wrong, why, and the fix. Those marked ✔ were reproduced in a real Angular 22.2 project.

**1. Required input read too early** ✔

```typescript
export class Card {
  readonly user = input.required<User>();
  constructor() { this.log(); }
  private log() { console.log(this.user().name); }   // ❌ runs before the parent has bound the input
}
```

Required inputs have no value until the parent has bound them, so reading one during construction throws at runtime (`NG0950`). Written directly in the constructor, the compiler catches it (`NG8118`), and hiding the read behind a method gets past the compiler and throws at runtime. Read it in `computed`, `effect`, the template or `ngOnInit`.

**2. `OnPush` child ignores a change** ✔

```typescript
// parent
addTag() { this.item().tags.push('new'); }          // ❌ same object reference
// child: ChangeDetectionStrategy.OnPush, input item
```

`OnPush` (the default in v22) checks a child only when an input *reference* changes, an event fires in it, or a signal it reads changes. Mutation doesn't change the reference. Fix: create a new object (`this.item.update(i => ({ ...i, tags: [...i.tags, 'new'] }))`) and keep data immutable.

**3. Same component, new route param** ✔

```typescript
ngOnInit() { this.load(this.route.snapshot.paramMap.get('id')!); }   // ❌
```

Navigating from `/users/1` to `/users/2` **reuses** the component, so `ngOnInit` runs only once and the page shows user 1. Use a stream or signal: `withComponentInputBinding()` and `id = input.required<string>()`, then `httpResource(() => '/api/users/' + this.id())`, or subscribe to `paramMap`.

**4. Mutating a signal's array**

```typescript
add(t: Todo) { this.todos().push(t); }               // ❌ nothing re-renders
```

The signal still holds the same array, so it never notifies. Use `this.todos.update(l => [...l, t])`.

**5. An `effect` used to derive state**

```typescript
constructor() { effect(() => this.total.set(this.price() * this.qty())); }   // ❌
```

It works, but it's an extra signal write, runs later than the read, and hides the dependency. Derived value means `computed(() => this.price() * this.qty())`. Use `effect` only for side effects (logging, storage, DOM, third-party libraries). For state that *resets* on a source change but can be edited, use `linkedSignal`.

**6. `forkJoin` that never answers**

```typescript
forkJoin([this.form.valueChanges, this.http.get('/api/x')]).subscribe(...)   // ❌
```

`forkJoin` emits only when **every** source completes, and `valueChanges` never does. Use `combineLatest` for streams, `forkJoin` for finite ones (HTTP).

**7. Nested subscribes**

```typescript
this.route.params.subscribe(p => {
  this.http.get('/api/users/' + p['id']).subscribe(u => this.user = u);      // ❌
});
```

Inner subscriptions pile up, older responses can win, and nothing is cleaned up. Flatten with `switchMap` (the latest wins), and let `toSignal` or `async` own the subscription.

**8. A template getter that creates an observable**

```typescript
get users$() { return this.http.get<User[]>('/api/users'); }
```
```html
@for (u of users$ | async; track u.id) { ... }
```

Each change detection reads the getter, gets a *new* observable, and `async` resubscribes, so you get a new request over and over. Assign it once to a field (`users$ = this.http.get(...)`), or use `httpResource`/`toSignal`.

**9. A cold observable never subscribed**

```typescript
save() { this.http.post('/api/save', this.form.value); }   // ❌ nothing is sent
```

`HttpClient` returns cold observables. Without `subscribe`, `async`, `toSignal` or `firstValueFrom`, no request happens.

**10. A leak**

```typescript
ngOnInit() { interval(1000).subscribe(() => this.tick()); }                // ❌
```

The subscription outlives the component. Use `interval(1000).pipe(takeUntilDestroyed(this.destroyRef))`. Calling `takeUntilDestroyed()` with no argument outside an injection context throws `NG0203`, so pass the `DestroyRef` when you're not in a constructor or field initialiser.

**11. `track $index` on stateful rows**

```html
@for (row of rows(); track $index) { <app-row-editor [row]="row" /> }       <!-- ❌ -->
```

Delete the first row and every row below *shifts into the previous component instance*, so the text typed into the editors now sits on the wrong rows. Track a stable id.

**12. A service that isn't shared**

```typescript
@Component({ providers: [CartService], ... })   // ❌ in two components
```

Each component gets **its own instance**, so they don't share the cart. For app-wide state use `providedIn: 'root'` (or a route-level provider for a feature).

**13. Method call in the template**

```html
<li>{{ formatPrice(item) }}</li>
```

Runs on every change-detection pass, for every row. Use a pure pipe, or a `computed` that maps the whole list once.

**14. Bypassing the sanitiser**

```html
<div [innerHTML]="comment.bodyHtml"></div>
```
```typescript
this.html = this.sanitizer.bypassSecurityTrustHtml(comment.bodyHtml);       // ❌ the "fix" people reach for
```

Angular's sanitiser strips dangerous parts of `innerHTML` (so the first form is safe by default). `bypassSecurityTrustHtml` **turns that off**, so the payload survives. Never bypass for user-supplied content. Sanitise on the server, or render as text.

## 4.5 Scenario and design questions

Answer each in 60 to 90 seconds. A good shape is: **requirements, structure, data flow, edge cases, trade-offs**.

**A multi-step form wizard (5 steps, can go back, resumable).**
One route per step (child routes) or one component with a step signal. A single typed form group (or a signal model) held in a service scoped to the wizard route, so all steps share it. Each step validates its own sub-group, and "Next" is disabled until the sub-group is valid. A `canDeactivate` guard warns about unsaved changes. Persist the draft to `sessionStorage` or the server for resume. Make the steps lazy-loaded.

**The dashboard is slow.**
Measure first (Angular DevTools profiler, Chrome performance tab). Typical culprits: no `OnPush`/signals, methods in templates, big lists without `track` or virtualisation, too many subscriptions, a huge initial bundle, and layout thrash. Then fix the largest cost first: `@defer` the below-the-fold widgets, lazy routes, virtual scroll, debounce, `computed` instead of recalculating, and move heavy work to a web worker. Set budgets so it doesn't regress.

**Authentication end to end.**
Login form, token in an `HttpOnly` cookie or in-memory, an interceptor that attaches credentials and handles `401` (H2), a functional `canActivate` guard (using the auth signal), role-based route data, logout that clears state, and a redirect back to the requested URL after login. The server is the authority: client guards are for UX only.

**Migrating a legacy NgModule/`*ngIf`/Karma app to modern Angular.**
Upgrade one major version at a time with `ng update`, and keep it deployable. Then run the schematics in order: `standalone`, `control-flow`, `inject`, `signal-input`/`outputs`/`signal-queries`, and `route-lazy-loading` (listed in 3.10). Replace class guards/interceptors with functional ones, and migrate tests. Do it **per feature** with a green test suite, rather than a big-bang rewrite.

**Real-time data (WebSocket or SSE).**
Wrap the socket in an RxJS `webSocket` or a custom observable inside a service, with retry and backoff (`retry({ delay })`), and share it with `shareReplay({ bufferSize: 1, refCount: true })` so one connection serves all subscribers and it closes when nobody listens. Expose it as a signal with `toSignal`. Think about reconnection, message ordering, and what the UI shows while disconnected.

**A table with 10,000 rows.**
Don't render 10,000 DOM rows. Server-side pagination or filtering if you control the API. Otherwise CDK virtual scroll (renders only the visible rows), `OnPush`, `track` by id, and no per-row method calls. Keep selection state as a `Set` of ids, not on the row objects.

**A shared component library across several apps.**
An Angular workspace library (`ng generate library`) with standalone components, signal inputs, and `OnPush`. Design tokens (CSS custom properties) for theming, a11y built in (use CDK/Aria for the hard parts), Storybook for docs, semantic versioning with a changelog, and tests per component. Keep the API small and composable (content projection and templates over dozens of inputs).

**Feature flags and A/B tests.**
A `FeatureFlags` service exposing signals, loaded in `provideAppInitializer` before the first render. A structural directive or `@if (flags.has('x'))` in templates. A route guard (or lazy route) for whole features. Remember the server may need the same flag for SSR to match the client.

**Handling errors across the app.**
Interceptor for HTTP (retry idempotent GETs with backoff, map errors to user messages), a global `ErrorHandler` that reports to monitoring, `@boundary` or `@if` with error state around risky widgets so one failure doesn't blank the page, and a toast service for user-facing messages. Don't swallow errors silently.

**You own a form-heavy app. How do you keep it maintainable?**
Typed forms, small reusable control components (the M4 pattern), validators in one shared file, an error-message component that maps error keys to text, form models separate from API DTOs, and tests on validation logic. Consider moving new forms to Signal Forms when the team is ready.

### What to do when you get stuck

- Say what you *would* do: "I'd normally use `switchMap` here to cancel the old request." Naming the right tool counts for a lot.
- Write the type or interface first. It forces you to decide the shape of the data, and gives you something on screen.
- Start with a hard-coded version and make it dynamic. A working simple version beats a half-finished clever one.
- If the compiler or runtime throws an error, **read it aloud**. Angular's messages (`NG0xxx`) are specific, and interviewers like to see you debugging calmly.
