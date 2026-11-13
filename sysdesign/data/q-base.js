/* Question bank base.
   Q(category, difficulty 1-3, question, hint, [key points], followUp)
   IDs are "<cat>-<n>" in load order: ONLY APPEND new questions to keep saved progress valid. */
window.QCATS = [
  { id: "conc",    name: "Concurrency & Race Conditions", icon: "⚔️" },
  { id: "db",      name: "Databases & Transactions",      icon: "🗄️" },
  { id: "cache",   name: "Caching",                       icon: "⚡" },
  { id: "msg",     name: "Queues & Streaming",            icon: "📨" },
  { id: "dist",    name: "Distributed Systems Core",      icon: "🕸️" },
  { id: "repl",    name: "Replication & Sharding",        icon: "🧬" },
  { id: "api",     name: "API Design & Idempotency",      icon: "🔌" },
  { id: "resil",   name: "Resilience & Failure Handling", icon: "🛡️" },
  { id: "scale",   name: "Scaling & Load Balancing",      icon: "📈" },
  { id: "dtx",     name: "Distributed Transactions",      icon: "🔁" },
  { id: "rate",    name: "Rate Limiting & Abuse",         icon: "🚦" },
  { id: "sec",     name: "Security & Auth",               icon: "🔐" },
  { id: "ops",     name: "Deployment & Operations",       icon: "🚀" },
  { id: "storage", name: "Storage, Search & CDN",         icon: "📦" },
  { id: "real",    name: "Real-World Scenarios",          icon: "🌍" },
];

window.QB = [];
(function () {
  var counters = {};
  window.Q = function (cat, diff, q, hint, a, f) {
    counters[cat] = (counters[cat] || 0) + 1;
    QB.push({ id: cat + "-" + counters[cat], c: cat, d: diff, q: q, hint: hint, a: a, f: f || "" });
  };
})();
