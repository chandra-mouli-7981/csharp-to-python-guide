(function () {
  "use strict";

  /* Config from the <script> tag, so one renderer serves several guides:
       data-md="a.md,b.md"  markdown files (relative to the page), joined in order. Default: guide.md
       data-lang="sql"      default highlight language for un-tagged code blocks. Default: python */
  const CFG = (document.currentScript && document.currentScript.dataset) || {};
  const MD_FILES = (CFG.md || "guide.md").split(",").map((s) => s.trim()).filter(Boolean);
  const DEFAULT_LANG = CFG.lang || "python";

  /* Several files = one "view" per file, each with its own URL (#basics, #basics/some-heading),
     and only the open view is rendered. One file = a single long page, as before. */
  const VIEWS = MD_FILES.length > 1;
  const BASE_TITLE = document.title;
  let docs = [];        // views mode: [{ slug, title, md, ids }]
  let current = -1;     // views mode: index of the rendered view
  let spy = null;       // views mode: scroll-spy observer of the rendered view

  const content = document.getElementById("content");
  const toc = document.getElementById("toc");
  const sidebar = document.getElementById("sidebar");
  const search = document.getElementById("search");
  const hljsTheme = document.getElementById("hljs-theme");

  /* ---------- theme ---------- */
  const THEMES = {
    dark: "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css",
    light: "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css",
  };
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    hljsTheme.href = THEMES[t];
    localStorage.setItem("theme", t);
  }
  const saved = localStorage.getItem("theme");
  applyTheme(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  document.getElementById("theme-btn").addEventListener("click", () => {
    applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  });

  /* ---------- mobile menu ---------- */
  document.getElementById("menu-btn").addEventListener("click", () => sidebar.classList.toggle("open"));
  sidebar.addEventListener("click", (e) => {
    const a = e.target.closest("a");
    if (!a) return;
    sidebar.classList.remove("open");
    if (VIEWS && a.getAttribute("href") === location.hash) route();   // same link again: no hashchange fires
  });

  /* ---------- load + render markdown ---------- */
  function slugify(text) {
    return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  }

  async function load() {
    let parts;
    try {
      parts = await Promise.all(
        MD_FILES.map(async (f) => {
          const res = await fetch(f);
          if (!res.ok) throw new Error(f + ": " + res.status);
          return res.text();
        })
      );
    } catch (err) {
      content.innerHTML =
        "<h2>Could not load the guide</h2>" +
        "<p>Browsers block <code>fetch()</code> on <code>file://</code> pages. " +
        "Run a local server instead:</p>" +
        "<pre><code>python -m http.server 8000</code></pre>" +
        "<p>Then open <a href='http://localhost:8000'>http://localhost:8000</a>.</p>";
      return;
    }

    if (VIEWS) {
      docs = parts.map((md, i) => ({
        md,
        slug: slugOfFile(MD_FILES[i]),
        title: titleOf(md, MD_FILES[i]),
      }));
      addEventListener("hashchange", route);
      route();
      return;
    }

    content.innerHTML = marked.parse(parts.join("\n\n"), { gfm: true, breaks: false });
    decorate();
    buildToc();
    wrapSections();
    handleHash();
  }

  /* ---------- views mode: one level per URL ---------- */
  // "content/01-basics.md" -> "basics"; falls back to the full file name if two would collide
  function slugOfFile(file) {
    const base = file.split("/").pop().replace(/\.md$/i, "");
    const short = base.replace(/^\d+-/, "");
    return MD_FILES.filter((f) => f.split("/").pop().replace(/\.md$/i, "").replace(/^\d+-/, "") === short).length > 1
      ? base
      : short;
  }

  // text of the first "# " heading (outside code fences), or the file name
  function titleOf(md, file) {
    let fence = false;
    for (const line of md.split("\n")) {
      if (/^```/.test(line)) fence = !fence;
      const m = !fence && line.match(/^#\s+(.+?)\s*#*\s*$/);
      if (m) return m[1].replace(/[`*]/g, "");
    }
    return file;
  }

  // heading ids a level will contain, so old single-page links such as #some-heading still resolve
  function headingIds(d) {
    if (!d.ids) {
      d.ids = new Set();
      let fence = false;
      d.md.split("\n").forEach((line) => {
        if (/^```/.test(line)) fence = !fence;
        const m = !fence && line.match(/^#{1,3}\s+(.+?)\s*#*\s*$/);
        if (m) d.ids.add(slugify(m[1].replace(/[`*]/g, "")));
      });
    }
    return d.ids;
  }

  // "#basics" -> level; "#basics/some-heading" -> level + heading; "#some-heading" (legacy) -> found by heading
  function route() {
    const raw = decodeURIComponent(location.hash.slice(1));
    const cut = raw.indexOf("/");
    let slug = cut < 0 ? raw : raw.slice(0, cut);
    let anchor = cut < 0 ? "" : raw.slice(cut + 1);
    let idx = docs.findIndex((d) => d.slug === slug);
    if (idx < 0 && slug) {
      idx = docs.findIndex((d) => headingIds(d).has(slug));
      if (idx >= 0) {
        anchor = slug;
        history.replaceState(null, "", "#" + docs[idx].slug + "/" + anchor);
      }
    }
    if (idx < 0) idx = 0;
    if (idx !== current) renderView(idx);
    const el = anchor && document.getElementById(anchor);
    if (el) el.scrollIntoView();
    else scrollTo(0, 0);
  }

  function renderView(idx) {
    current = idx;
    const d = docs[idx];
    content.innerHTML = marked.parse(d.md, { gfm: true, breaks: false });
    decorate();
    buildViewsToc();
    wrapSections();
    addViewNav();
    document.title = idx > 0 ? d.title + " · " + BASE_TITLE : BASE_TITLE;   // the first level is the guide itself
    if (search.value.trim().length >= 2) runSearch();   // keep an active search while moving between levels
  }

  // sidebar: every level is listed; only the open level shows its own headings
  function buildViewsToc() {
    toc.innerHTML = "";
    docs.forEach((d, i) => {
      const li = document.createElement("li");
      li.className = "group";
      const a = document.createElement("a");
      a.href = "#" + d.slug;
      a.textContent = d.title;
      a.dataset.view = i;
      if (i === current) a.classList.add("active");
      li.appendChild(a);
      toc.appendChild(li);
      if (i !== current) return;
      content.querySelectorAll("h2, h3").forEach((h) => {
        const sub = document.createElement("li");
        if (h.tagName === "H3") sub.className = "sub";
        const link = document.createElement("a");
        link.href = "#" + d.slug + "/" + h.id;
        link.textContent = h.textContent;
        link.dataset.h = h.id;
        sub.appendChild(link);
        toc.appendChild(sub);
      });
    });

    if (spy) spy.disconnect();
    const links = new Map([...toc.querySelectorAll("a[data-h]")].map((a) => [a.dataset.h, a]));
    spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            const link = links.get(en.target.id);
            if (link) {
              link.classList.add("active");
              link.scrollIntoView({ block: "nearest" });
            }
          }
        });
      },
      { rootMargin: "-70px 0px -75% 0px" }
    );
    content.querySelectorAll("h2, h3").forEach((h) => spy.observe(h));
  }

  function addViewNav() {
    const nav = document.createElement("nav");
    nav.className = "view-nav";
    nav.setAttribute("aria-label", "Previous and next level");
    const link = (d, dir) => {
      const a = document.createElement("a");
      a.href = "#" + d.slug;
      a.className = dir;
      a.textContent = dir === "prev" ? "← " + d.title : d.title + " →";
      return a;
    };
    if (current > 0) nav.append(link(docs[current - 1], "prev"));
    if (current < docs.length - 1) nav.append(link(docs[current + 1], "next"));
    content.append(nav);
  }

  /* ---------- post-processing ---------- */
  function decorate() {
    // heading ids
    const usedIds = new Set();
    content.querySelectorAll("h1,h2,h3").forEach((h) => {
      let id = slugify(h.textContent) || "section";
      for (let n = 2; usedIds.has(id); n++) id = slugify(h.textContent) + "-" + n;   // keep ids unique
      usedIds.add(id);
      h.id = id;
    });
    // banner style for the level headings of multi-h1 guides (the first h1 is the page title)
    if (VIEWS) { if (current > 0) content.querySelector("h1")?.classList.add("level"); }   // the first level is the title page
    else if (hasGroups()) content.querySelectorAll("h1").forEach((h, i) => { if (i > 0) h.classList.add("level"); });

    // syntax highlighting + copy buttons
    content.querySelectorAll("pre > code").forEach((code) => {
      if (!code.className) code.className = "language-" + DEFAULT_LANG;
      hljs.highlightElement(code);

      const btn = document.createElement("button");
      btn.className = "copy-btn";
      btn.textContent = "Copy";
      btn.addEventListener("click", async () => {
        await navigator.clipboard.writeText(code.innerText);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1200);
      });
      code.parentElement.appendChild(btn);
    });

    // scrollable tables
    content.querySelectorAll("table").forEach((t) => {
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      t.parentNode.insertBefore(wrap, t);
      wrap.appendChild(t);
    });
  }

  /* ---------- table of contents ---------- */
  function buildToc() {
    toc.innerHTML = "";
    const selector = hasGroups() ? "h1, h2, h3" : "h2, h3";
    content.querySelectorAll(selector).forEach((h) => {
      const li = document.createElement("li");
      if (h.tagName === "H3") li.className = "sub";
      if (h.tagName === "H1") li.className = "group";
      const a = document.createElement("a");
      a.href = "#" + h.id;
      a.textContent = h.textContent;
      li.appendChild(a);
      toc.appendChild(li);
    });

    // scroll spy
    const links = new Map([...toc.querySelectorAll("a")].map((a) => [a.getAttribute("href").slice(1), a]));
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            links.forEach((l) => l.classList.remove("active"));
            const link = links.get(en.target.id);
            if (link) {
              link.classList.add("active");
              link.scrollIntoView({ block: "nearest" });
            }
          }
        });
      },
      { rootMargin: "-70px 0px -75% 0px" }
    );
    content.querySelectorAll(selector).forEach((h) => io.observe(h));
  }

  // A guide with several <h1>s (e.g. "Level 1", "Level 2"...) gets group labels in the sidebar.
  function hasGroups() {
    return VIEWS || content.querySelectorAll("h1").length > 1;
  }

  /* ---------- group content into sections (for search) ---------- */
  let sections = [];
  function wrapSections() {
    sections = [];
    const nodes = [...content.childNodes];
    let current = null;
    const splitTags = hasGroups() ? ["H1", "H2"] : ["H2"];
    nodes.forEach((n) => {
      if (n.nodeType === 1 && splitTags.includes(n.tagName)) {
        current = document.createElement("section");
        content.insertBefore(current, n);
        sections.push(current);
      }
      if (current) current.appendChild(n);
    });
  }

  /* ---------- search ---------- */
  function clearMarks() {
    content.querySelectorAll("mark").forEach((m) => {
      m.replaceWith(document.createTextNode(m.textContent));
    });
    content.normalize();
  }

  function highlight(root, term) {
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) =>
        n.parentElement.closest("button, script, style") || !re.test(n.nodeValue)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT,
    });
    const targets = [];
    while (walker.nextNode()) targets.push(walker.currentNode);
    targets.forEach((node) => {
      re.lastIndex = 0;
      const span = document.createElement("span");
      span.innerHTML = node.nodeValue
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(re, (m) => "<mark>" + m + "</mark>");
      node.replaceWith(...span.childNodes);
    });
  }

  let timer;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 200);
  });

  // views mode: sections ("## ...") containing the term, per level (approximate: counted on the raw markdown)
  function matchCounts(term) {
    const t = term.toLowerCase();
    return docs.map((d) => d.md.split(/^## /m).filter((s) => s.toLowerCase().includes(t)).length);
  }

  // views mode: small badges in the sidebar showing which levels contain the term
  function showCounts(term) {
    toc.querySelectorAll(".count").forEach((c) => c.remove());
    if (term.length < 2) return;
    const counts = matchCounts(term);
    toc.querySelectorAll("a[data-view]").forEach((a) => {
      const n = counts[+a.dataset.view];
      if (!n) return;
      const badge = document.createElement("span");
      badge.className = "count";
      badge.textContent = n;
      badge.title = n + " matching section" + (n === 1 ? "" : "s");
      a.append(badge);
    });
  }

  function noResults(term) {
    const p = document.createElement("p");
    p.className = "no-results";
    if (!VIEWS) { p.textContent = 'No results for "' + term + '".'; return p; }
    const counts = matchCounts(term);
    const elsewhere = docs.map((d, i) => ({ d, n: counts[i], i })).filter((x) => x.n && x.i !== current);
    p.append('No results for "' + term + '" in this level.');
    if (!elsewhere.length) { p.append(" Nothing in the other levels either."); return p; }
    p.append(" Found in: ");
    elsewhere.forEach((x, k) => {
      if (k) p.append(", ");
      const a = document.createElement("a");
      a.href = "#" + x.d.slug;
      a.textContent = x.d.title + " (" + x.n + ")";
      p.append(a);
    });
    return p;
  }

  function runSearch() {
    const term = search.value.trim();
    clearMarks();
    content.querySelector(".no-results")?.remove();
    if (VIEWS) showCounts(term);

    if (term.length < 2) {
      sections.forEach((s) => s.classList.remove("section-hidden"));
      return;
    }
    let hits = 0;
    sections.forEach((s) => {
      const match = s.textContent.toLowerCase().includes(term.toLowerCase());
      s.classList.toggle("section-hidden", !match);
      if (match) { hits++; highlight(s, term); }
    });
    if (!hits) content.prepend(noResults(term));
  }

  /* ---------- misc ---------- */
  function handleHash() {
    if (location.hash) {
      const el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) el.scrollIntoView();
    }
  }

  const toTop = document.getElementById("to-top");
  addEventListener("scroll", () => toTop.classList.toggle("show", scrollY > 600), { passive: true });
  toTop.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));

  addEventListener("keydown", (e) => {
    if (e.key === "/" && document.activeElement !== search) {
      e.preventDefault();
      search.focus();
    } else if (e.key === "Escape" && document.activeElement === search) {
      search.value = "";
      runSearch();
      search.blur();
    }
  });

  load();
})();

