# Interview Prep Hub

A static, build-free website with study modules. Deployable as-is on GitHub Pages.

| Module | Path | What it is |
|---|---|---|
| Home | `/` | Module picker |
| C# → Python Guide | `/python/` | Searchable cheat sheet (content in `python/guide.md`) |
| System Design: "What happens if…?" | `/sysdesign/` | 100+ scenario questions with practice mode, question bank and progress tracking |

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

The Python guide loads `guide.md` with `fetch()`, so it needs a server (it won't work from `file://`).
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

## Hosting

GitHub Pages: Settings → Pages → Deploy from branch → `main` / root.
