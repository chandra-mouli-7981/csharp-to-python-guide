(function () {
  "use strict";
  function apply(t) {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("theme", t);
  }
  const saved = localStorage.getItem("theme");
  apply(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("theme-btn");
    if (btn) btn.addEventListener("click", () =>
      apply(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"));
  });
})();
