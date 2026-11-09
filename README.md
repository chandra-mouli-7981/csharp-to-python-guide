# C# → Python Guide

A static website: a cheat sheet for C# developers moving to Python, covering syntax, collections, LINQ equivalents, DSA toolkit and OOP differences.

## Run locally

```bash
python -m http.server 8000
# open http://localhost:8000
```

(Opening `index.html` directly won't work, because browsers block `fetch()` on `file://`.)

## Edit content

All content lives in `content/guide.md`. Each `##` heading becomes a sidebar entry and a searchable section.

## Hosting

Deployed with GitHub Pages (Settings → Pages → Deploy from branch → `main` / root).
