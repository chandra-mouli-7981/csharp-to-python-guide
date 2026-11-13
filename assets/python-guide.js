(function () {
  "use strict";

  /* Config from the <script> tag, so one renderer serves several guides:
       data-md="a.md,b.md"  markdown files (relative to the page), joined in order. Default: guide.md
       data-lang="sql"      default highlight language for un-tagged code blocks. Default: python */
  const CFG = (document.currentScript && document.currentScript.dataset) || {};
  const MD_FILES = (CFG.md || "guide.md").split(",").map((s) => s.trim()).filter(Boolean);
  const DEFAULT_LANG = CFG.lang || "python";

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
  sidebar.addEventListener("click", (e) => { if (e.target.tagName === "A") sidebar.classList.remove("open"); });

  /* ---------- load + render markdown ---------- */
  function slugify(text) {
    return text.toLowerCase().replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  }

  async function load() {
    let md;
    try {
      const parts = await Promise.all(
        MD_FILES.map(async (f) => {
          const res = await fetch(f);
          if (!res.ok) throw new Error(f + ": " + res.status);
          return res.text();
        })
      );
      md = parts.join("\n\n");
    } catch (err) {
      content.innerHTML =
        "<h2>Could not load the guide</h2>" +
        "<p>Browsers block <code>fetch()</code> on <code>file://</code> pages. " +
        "Run a local server instead:</p>" +
        "<pre><code>python -m http.server 8000</code></pre>" +
        "<p>Then open <a href='http://localhost:8000'>http://localhost:8000</a>.</p>";
      return;
    }

    content.innerHTML = marked.parse(md, { gfm: true, breaks: false });
    decorate();
    buildToc();
    wrapSections();
    handleHash();
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
    if (hasGroups()) content.querySelectorAll("h1").forEach((h, i) => { if (i > 0) h.classList.add("level"); });

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
    return content.querySelectorAll("h1").length > 1;
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

  function runSearch() {
    const term = search.value.trim();
    clearMarks();
    content.querySelector(".no-results")?.remove();

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
    if (!hits) {
      const p = document.createElement("p");
      p.className = "no-results";
      p.textContent = 'No results for "' + term + '".';
      content.prepend(p);
    }
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

