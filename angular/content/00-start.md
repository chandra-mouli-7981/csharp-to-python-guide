# Angular Interview Guide

Everything a mid-level Angular interview usually covers, in one place: the concepts, the "why" behind them, the traps interviewers like, and worked coding problems. It covers modern Angular (signals, standalone, zoneless, the new control flow) and the legacy patterns you will still find in real codebases (NgModules, `*ngIf`, constructor injection, Karma).

## Start here

**How the guide is organised**

| Level | Covers | Why it matters |
|---|---|---|
| **1. Foundations** | Architecture, components, templates and binding, control flow, inputs/outputs, projection, lifecycle, directives, pipes, dependency injection | Every interview opens here. You are expected to explain each one in your own words |
| **2. Core** | Signals, `resource`, change detection, RxJS, HttpClient, routing, forms | The bulk of the "how would you build X" questions |
| **3. Advanced** | Performance, state management, testing, SSR, security, architecture, error handling, tooling and upgrades | What separates mid-level from junior |
| **4. Practice** | Coding challenges with solutions, scenario and design questions, "find the bug" snippets | Where you build speed |
| **5. Reference** | Legacy to modern cheat sheet, version timeline, answering strategy, last-day checklist | Read the night before |

**Suggested use**

1. Read Levels 1 to 3 once. Skip anything you can already explain out loud.
2. Do Level 4 without looking at the solution. Say your reasoning out loud, because that is what is graded.
3. Re-read Level 5 and the "Quick-fire Q&A" at the end of each level the day before.

## Which Angular version?

Interviewers ask about whatever their codebase uses, which is often 2 to 4 versions behind the latest. The guide teaches the current style and marks where older code looks different. This guide was written against **Angular 22.2** (released June 2026). Every code sample was compiled and run in a real Angular 22.2.5 project with Vitest, not just copied from docs.

> **Tip:** if you are not sure what the company uses, ask "which Angular version are you on, and are you using signals and standalone components yet?". It is a good question, and it tells you which half of this guide matters most.

### When did each feature become stable?

This is the single most useful table in the guide. Interviewers love "what changed in recent versions?".

| Feature | Arrived | Stable / default |
|---|---|---|
| **Standalone components** (no NgModule needed) | v14 | Stable v15. **Default** from v19 (no `standalone: true` needed) |
| **Control flow** `@if`, `@for`, `@switch` | v17 | Stable v18 |
| **`@defer`** (lazy template blocks) | v17 | Stable v18 |
| **Signals** `signal`, `computed` | v16 | Stable v17 |
| **`input()`, `output()`, `model()`, signal queries** | v17.1 and later | Stable v19 |
| **`@let`** template variables | v18.1 | Stable v19 |
| **`effect`, `linkedSignal`, `toSignal`, `toObservable`** | v16 to v19 | Stable **v20** |
| **Zoneless change detection** | v18 (experimental) | Developer preview v20, **stable v20.2**, **default for new apps v21** |
| **Vitest as the test runner** | v20 (experimental) | Stable and **default v21** (Karma deprecated) |
| **Signal Forms** | v21 (experimental) | **Stable v22** |
| **`resource`, `httpResource`, `rxResource`** | v19 / v20 (experimental) | **Stable v22** |
| **Angular Aria** (headless accessible components) | v21 (developer preview) | **Stable v22** |
| **`OnPush` is the default**, old default renamed `Eager` | v22 | **v22** |
| **`@Service()` decorator, `injectAsync()`** | v22 | **v22** |
| **Template syntax**: spread, arrow functions, multi-case `@switch`, exhaustive `@switch`, comments inside tags | v22 | **v22** |
| **`@boundary { } @error (let err) { }`** (template error boundary) | v22.x | The release post announced it as a **developer preview** (planned for Q3 2026). It compiled and worked in my test on 22.2.5, but treat it as preview and check the docs before depending on it |
| **Router with the platform Navigation API** | v21.1 / v22 | Experimental (`withExperimentalPlatformNavigation()`) |
| **`withAutoCleanupInjectors()`**, `destroyDetachedRouteHandle()` | v22.2 | Public API in 22.2. The earlier `withExperimentalAutoCleanupInjectors()` name is deprecated |
| **`withFetch()`** | v16 | **Deprecated in v22**: the Fetch backend is now the default |
| **Webpack builders** (`@angular-devkit/build-angular`) | | **Deprecated in v22**. The esbuild-based `@angular/build` is the future |

Version facts that change: Angular releases a major version regularly and supports versions for a limited time (active support, then LTS). The cadence changed with v22 to roughly one major per year. Always confirm the current schedule at `angular.dev/reference/releases`, and do not memorise dates.

> **Developer preview and experimental APIs are outside semantic versioning.** They can change in any release, even a patch. That is why you should be able to say "this is stable, this is not" for each feature above. In an interview this shows maturity.

## What a new Angular 22 project looks like

This is what `ng new` generates today, and it is what "modern Angular" looks like:

```ts
// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
```

```ts
// src/app/app.config.ts
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideRouter(routes)],
};
```

```ts
// src/app/app.ts
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  imports: [RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('my-app');
}
```

Things worth noticing, because interviewers ask about each:

- **No `NgModule`, and no `standalone: true`**. Components are standalone by default.
- **No `zone.js`** in the generated project. Change detection is zoneless.
- **No `changeDetection: ChangeDetectionStrategy.OnPush`** in the component. `OnPush` is the default in v22.
- **The class is `App`, in `app.ts`**, not `AppComponent` in `app.component.ts`. New projects dropped the `.component` / `.service` suffixes (since v20). Older code still uses them.
- **The test runner is Vitest** (`ng test`) with jsdom, not Karma.
- **`provideBrowserGlobalErrorListeners()`** routes uncaught browser errors into Angular's `ErrorHandler`.

## How to answer in an interview

- **Define, then compare, then give the trade-off.** "A signal is a reactive value holder. Unlike an Observable it always has a current value and is read synchronously. Use signals for UI state and RxJS for event streams."
- **Say which version** a feature needs when it matters. "`resource` is stable since v22, so on v20 I would treat it as experimental."
- **Name the legacy form too.** "`@if` replaced `*ngIf`. You will still see `*ngIf` in older codebases and it still works."
- **Admit unknowns precisely.** "I have not used Signal Forms in production, but I know how reactive forms work and I have read how Signal Forms differ" is far better than a bluff.

## Sample code

Most examples here are small and self-contained. A few use this tiny model, so it is worth knowing once:

```ts
export interface User { id: number; name: string; email: string; role: 'admin' | 'user'; }
export interface Todo { id: number; title: string; done: boolean; }
```
