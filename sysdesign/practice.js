(function () {
  "use strict";

  /* ---------- helpers ---------- */
  var $ = function (id) { return document.getElementById(id); };
  var catById = {};
  QCATS.forEach(function (c) { catById[c.id] = c; });
  var DIFF = { 1: "Easy", 2: "Medium", 3: "Hard" };

  function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>"); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* ---------- progress storage ---------- */
  var KEY = "sd-progress-v1";
  var progress = {};
  try { progress = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { progress = {}; }
  function save() { localStorage.setItem(KEY, JSON.stringify(progress)); }

  /* ---------- state ---------- */
  var state = {
    tab: "practice",
    cats: new Set(),     // empty = all
    diff: 0,             // 0 = all
    prioritize: true,
    current: null,
    session: { done: 0, nailed: 0 },
    timerStart: 0,
    timerId: null,
  };

  function pool() {
    return QB.filter(function (q) {
      return (state.cats.size === 0 || state.cats.has(q.c)) && (!state.diff || q.d === state.diff);
    });
  }

  function weight(q) {
    var p = progress[q.id];
    if (!p) return 3;
    return p.r === 0 ? 4 : p.r === 1 ? 2 : 0.4;
  }

  function pickNext() {
    var list = pool();
    if (!list.length) return null;
    if (list.length > 1 && state.current) list = list.filter(function (q) { return q.id !== state.current.id; });
    if (!state.prioritize) return list[Math.floor(Math.random() * list.length)];
    var total = list.reduce(function (s, q) { return s + weight(q); }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < list.length; i++) {
      r -= weight(list[i]);
      if (r <= 0) return list[i];
    }
    return list[list.length - 1];
  }

  /* ---------- filters UI ---------- */
  function renderFilters() {
    var cc = $("cat-chips");
    cc.innerHTML = "";
    var all = el("button", "chip" + (state.cats.size === 0 ? " on" : ""), "All topics");
    all.onclick = function () { state.cats.clear(); refresh(true); };
    cc.appendChild(all);
    QCATS.forEach(function (c) {
      var count = QB.filter(function (q) { return q.c === c.id; }).length;
      var b = el("button", "chip" + (state.cats.has(c.id) ? " on" : ""), c.icon + " " + c.name + " (" + count + ")");
      b.onclick = function () {
        if (state.cats.has(c.id)) state.cats.delete(c.id); else state.cats.add(c.id);
        refresh(true);
      };
      cc.appendChild(b);
    });

    var dc = $("diff-chips");
    dc.innerHTML = "";
    [[0, "All"], [1, "Easy"], [2, "Medium"], [3, "Hard"]].forEach(function (d) {
      var b = el("button", "chip" + (state.diff === d[0] ? " on" : ""), d[1]);
      b.onclick = function () { state.diff = d[0]; refresh(true); };
      dc.appendChild(b);
    });

    $("pool-count").textContent = pool().length + " of " + QB.length + " questions";
  }

  $("prioritize").addEventListener("change", function (e) { state.prioritize = e.target.checked; });

  /* ---------- tabs ---------- */
  $("tabs").addEventListener("click", function (e) {
    var t = e.target.getAttribute("data-tab");
    if (!t) return;
    state.tab = t;
    refresh(false);
  });

  function refresh(resetCurrent) {
    if (resetCurrent) state.current = null;
    document.querySelectorAll(".tab").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-tab") === state.tab);
    });
    ["practice", "bank", "progress"].forEach(function (t) { $("view-" + t).hidden = state.tab !== t; });
    renderFilters();
    stopTimer();
    if (state.tab === "practice") renderPractice();
    else if (state.tab === "bank") renderBank();
    else renderProgress();
  }

  /* ---------- timer ---------- */
  function stopTimer() { if (state.timerId) { clearInterval(state.timerId); state.timerId = null; } }
  function startTimer() {
    stopTimer();
    state.timerStart = Date.now();
    state.timerId = setInterval(function () {
      var t = $("timer");
      if (!t) return stopTimer();
      var s = Math.floor((Date.now() - state.timerStart) / 1000);
      t.textContent = "⏱ " + String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }, 1000);
  }

  /* ---------- practice view ---------- */
  function renderPractice() {
    var root = $("view-practice");
    root.innerHTML = "";

    if (!state.current) state.current = pickNext();
    var q = state.current;
    if (!q) {
      root.appendChild(el("div", "empty", "No questions match these filters."));
      return;
    }

    var cat = catById[q.c];
    var prev = progress[q.id];
    var prevTxt = prev ? ["Missed last time", "Partial last time", "Nailed last time"][prev.r] : "New question";

    var card = el("div", "qcard");
    card.innerHTML =
      '<div class="qmeta">' +
        '<span class="badge">' + cat.icon + " " + esc(cat.name) + "</span>" +
        '<span class="badge">' + DIFF[q.d] + "</span>" +
        '<span class="badge">' + prevTxt + "</span>" +
        '<span class="muted">Session: ' + state.session.nailed + "/" + state.session.done + " nailed</span>" +
        '<span class="timer" id="timer">⏱ 00:00</span>' +
      "</div>" +
      '<div class="interviewer">Interviewer</div>' +
      '<p class="question">' + fmt(q.q) + "</p>" +
      '<textarea class="answer" id="my-answer" placeholder="Answer out loud or type here: what happens, why, how you would detect it, how you would fix it, and the trade-offs..."></textarea>' +
      '<div class="btn-row">' +
        '<button class="btn" id="btn-hint">💡 Hint</button>' +
        '<button class="btn primary" id="btn-reveal">Reveal model answer</button>' +
        '<button class="btn" id="btn-skip">Skip</button>' +
      "</div>" +
      '<div id="hint-slot"></div>' +
      '<div id="reveal-slot"></div>';
    root.appendChild(card);

    $("btn-hint").onclick = function () {
      $("hint-slot").innerHTML = '<div class="hintbox"><b>Hint:</b> ' + fmt(q.hint) + "</div>";
    };
    $("btn-skip").onclick = function () { state.current = null; renderPractice(); };
    $("btn-reveal").onclick = function () { reveal(q); };
    startTimer();
  }

  function reveal(q) {
    stopTimer();
    $("btn-reveal").disabled = true;
    $("my-answer").readOnly = true;

    var slot = $("reveal-slot");
    var html = '<div class="reveal"><h3>Key points (tick what you covered)</h3><ul class="checklist">';
    q.a.forEach(function (pt, i) {
      html += '<li><label><input type="checkbox" data-i="' + i + '"><span>' + fmt(pt) + "</span></label></li>";
    });
    html += "</ul>";
    if (q.f) html += '<div class="followup"><b>Interviewer follow-up:</b> ' + fmt(q.f) + "</div>";
    html += '<h3>How did you do?</h3><div class="rate">' +
      '<button class="btn r0" data-r="0">😕 Missed it</button>' +
      '<button class="btn r1" data-r="1">🙂 Partial</button>' +
      '<button class="btn r2" data-r="2">💪 Nailed it</button>' +
      '<span class="muted" id="suggest-note"></span></div></div>';
    slot.innerHTML = html;

    var boxes = slot.querySelectorAll("input[type=checkbox]");
    function suggest() {
      var n = 0;
      boxes.forEach(function (b) { if (b.checked) n++; });
      var ratio = n / boxes.length;
      var s = ratio >= 0.75 ? 2 : ratio >= 0.4 ? 1 : 0;
      slot.querySelectorAll(".rate .btn").forEach(function (b) {
        b.classList.toggle("suggest", n > 0 && Number(b.getAttribute("data-r")) === s);
      });
      $("suggest-note").textContent = n ? n + "/" + boxes.length + " covered" : "";
    }
    boxes.forEach(function (b) { b.addEventListener("change", suggest); });

    slot.querySelectorAll(".rate .btn").forEach(function (b) {
      b.onclick = function () {
        var r = Number(b.getAttribute("data-r"));
        var old = progress[q.id] || { n: 0 };
        progress[q.id] = { r: r, n: old.n + 1, t: Date.now() };
        save();
        state.session.done++;
        if (r === 2) state.session.nailed++;
        state.current = null;
        refresh(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    });
    slot.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  /* ---------- bank view ---------- */
  var bankQuery = "";
  function renderBank() {
    var root = $("view-bank");
    root.innerHTML = "";
    root.className = "bank";

    var s = el("input", "bank-search");
    s.type = "search";
    s.placeholder = "Search questions and answers...";
    s.value = bankQuery;
    root.appendChild(s);
    var list = el("div");
    root.appendChild(list);

    function draw() {
      var term = bankQuery.toLowerCase();
      list.innerHTML = "";
      var items = pool().filter(function (q) {
        if (!term) return true;
        return (q.q + " " + q.hint + " " + q.a.join(" ") + " " + q.f).toLowerCase().indexOf(term) !== -1;
      });
      if (!items.length) { list.appendChild(el("div", "empty", "No matching questions.")); return; }
      items.forEach(function (q) {
        var p = progress[q.id];
        var d = el("details");
        var cat = catById[q.c];
        d.innerHTML =
          '<summary><span class="dot' + (p ? " r" + p.r : "") + '"></span><span>' + fmt(q.q) +
          '<br><span class="muted">' + cat.icon + " " + esc(cat.name) + " · " + DIFF[q.d] + "</span></span></summary>" +
          '<div class="body"><p><b>Hint:</b> ' + fmt(q.hint) + "</p><ul>" +
          q.a.map(function (x) { return "<li>" + fmt(x) + "</li>"; }).join("") +
          "</ul>" + (q.f ? '<div class="followup"><b>Follow-up:</b> ' + fmt(q.f) + "</div>" : "") + "</div>";
        list.appendChild(d);
      });
    }
    s.addEventListener("input", function () { bankQuery = s.value; draw(); });
    draw();
  }

  /* ---------- progress view ---------- */
  function renderProgress() {
    var root = $("view-progress");
    root.innerHTML = "";

    function counts(list) {
      var c = { nailed: 0, partial: 0, missed: 0, unseen: 0 };
      list.forEach(function (q) {
        var p = progress[q.id];
        if (!p) c.unseen++; else if (p.r === 2) c.nailed++; else if (p.r === 1) c.partial++; else c.missed++;
      });
      return c;
    }
    var all = counts(QB);
    var attempts = Object.keys(progress).reduce(function (s, k) { return s + (progress[k].n || 0); }, 0);

    var stats = el("div", "stat-row");
    stats.innerHTML =
      '<div class="stat"><b>' + QB.length + '</b><span class="muted">Total questions</span></div>' +
      '<div class="stat"><b>' + (QB.length - all.unseen) + '</b><span class="muted">Attempted</span></div>' +
      '<div class="stat"><b style="color:var(--ok)">' + all.nailed + '</b><span class="muted">Nailed</span></div>' +
      '<div class="stat"><b style="color:var(--bad)">' + all.missed + '</b><span class="muted">Missed (review!)</span></div>' +
      '<div class="stat"><b>' + attempts + '</b><span class="muted">Total attempts</span></div>';
    root.appendChild(stats);

    root.appendChild(el("div", "legend",
      '<span style="--c:var(--ok)">Nailed</span><span style="--c:var(--warn)">Partial</span>' +
      '<span style="--c:var(--bad)">Missed</span><span style="--c:var(--none)">Not seen</span>'));

    QCATS.forEach(function (c) {
      var list = QB.filter(function (q) { return q.c === c.id; });
      var k = counts(list), n = list.length;
      function pct(x) { return (x / n * 100) + "%"; }
      var row = el("div", "prow");
      row.innerHTML =
        "<div>" + c.icon + " " + esc(c.name) + "</div>" +
        '<div class="bar"><i class="g" style="width:' + pct(k.nailed) + '"></i><i class="y" style="width:' + pct(k.partial) +
        '"></i><i class="r" style="width:' + pct(k.missed) + '"></i></div>';
      var btn = el("button", "btn", "Practice");
      btn.onclick = function () {
        state.cats = new Set([c.id]); state.tab = "practice"; refresh(true);
      };
      row.appendChild(btn);
      root.appendChild(row);
    });

    var reset = el("button", "btn danger", "Reset all progress");
    reset.style.marginTop = "24px";
    reset.onclick = function () {
      if (confirm("Delete all saved progress on this browser?")) {
        progress = {}; save(); state.session = { done: 0, nailed: 0 }; refresh(false);
      }
    };
    root.appendChild(reset);
  }

  refresh(true);
})();
