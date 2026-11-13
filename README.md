# Interview Prep Hub

A static, build-free website with study modules. Deployable as-is on GitHub Pages.

| Module | Path | What it is |
|---|---|---|
| Home | `/` | Module picker |
| C# → Python Guide | `/python/` | Searchable cheat sheet (content in `python/guide.md`) |
| SQL Interview Guide | `/sql/` | Basics → advanced reference, 31 solved practice problems and a cram sheet (content in `sql/content/*.md`) |
| Angular Interview Guide | `/angular/` | Mid-level Angular (signals, standalone, RxJS, routing, forms, testing, SSR), coding challenges, find-the-bug and a last-day checklist (content in `angular/content/*.md`) |
| React Interview Guide | `/react/` | Mid-level React (hooks, effects, React 19 Actions, state management, testing, Server Components), coding challenges, find-the-bug and a last-day checklist (content in `react/content/*.md`) |
| HLD Interview Prep | `/hld/` | System Design Interview chapters 02–29 as generated HTML pages (`hld/html/`) with a PDF per chapter (`hld/pdfs/`). Copied from `source\repos\HLD`: regenerate there with its `src/build_all.py` and re-copy `html/` and `pdfs/`, don't edit these files by hand |
| System Design: "What happens if…?" | `/sysdesign/` | 100+ scenario questions with practice mode, question bank and progress tracking |

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

The Python, SQL, Angular and React guides load their markdown with `fetch()`, so they need a server (they won't work from `file://`).
The system design module works from `file://` too, because its data is plain `<script>` files.

## Adding system design questions

Append to the end of any file in `sysdesign/data/` (or add a `q-5.js` and reference it in both `index.html` files):

```js
Q("cache", 2,                         // category id, difficulty 1-3
  "Question text. Use `backticks` for code.",
  "Hint text",
  ["Key point 1", "Key point 2", "Key point 3"],
  "Interviewer follow-up question");
```

Category ids are defined in `sysdesign/data/q-base.js`. **Only append**: question IDs are derived from load order per category, and saved progress (in `localStorage`) is keyed by them.

## Editing the SQL guide

The SQL guide is plain markdown, split by level and concatenated in order by `sql/index.html` (`data-md` attribute):

| File | Content |
|---|---|
| `sql/content/00-start.md` | Intro and the **sample database** used by every example |
| `sql/content/01-basics.md` | Level 1 |
| `sql/content/02-intermediate.md` | Level 2 |
| `sql/content/03-advanced.md` | Level 3 |
| `sql/content/04-practice.md` | Level 4: practice data and 31 problems |
| `sql/content/05-reference.md` | Level 5: dialect cheat sheet, traps, strategy, cram sheet |

- `# H1` headings are level banners and sidebar group labels, `## H2` headings are topics, and `### H3` headings are sub-topics or problems. Keep headings unique.
- Code blocks without a language are highlighted as SQL.
- The `text out` blocks under queries are real output, produced by running the query against the sample database with SQLite. If you change a query or the data, re-run it and update the output, so the guide never shows a result that was not actually produced.

## Editing the Angular and React guides

Both follow the same layout as the SQL guide: markdown files in `<module>/content/`, concatenated in order by `<module>/index.html` (`data-md`), with the code language set by `data-lang` (`typescript` for Angular, `tsx` for React).

| File | Content |
|---|---|
| `content/00-start.md` | Intro, how the guide is organised, version and stability table |
| `content/01-foundations.md` | Level 1 |
| `content/02-core.md` | Level 2 |
| `content/03-advanced.md` | Level 3 |
| `content/04-practice.md` | Level 4: coding challenges with solutions, "find the bug", scenario questions |
| `content/05-reference.md` | Level 5: legacy-to-modern cheat sheet, version timeline, gotchas, checklist |

- Same heading rules as above: one `# H1` per file (the level banner), `## H2` topics and `### H3` sub-topics or problems.
- **Both guides are tied to specific versions** (Angular 22.2, React 19.3, TanStack Query 5, React Router 8). The code samples were compiled and run in throwaway projects with those versions. If you change a snippet or update the versions, run it again rather than editing from memory, because behaviour in these libraries changes between majors.
- Statements that depend on a version (stable vs preview, deprecated, renamed) are marked in the text. Keep that when you edit.

## Hosting

GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.
