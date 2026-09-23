(function () {
  "use strict";
  var key = "kutt.theme", root = document.documentElement;
  var media = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
  function valid(value) { return ["system", "light", "dark"].includes(value); }
  function stored() {
    try { var value = window.localStorage.getItem(key); return valid(value) ? value : "system"; }
    catch (_) { return "system"; }
  }
  var preference = stored();
  function apply() {
    var dark = preference === "dark" || (preference === "system" && media && media.matches);
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.themePreference = preference;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#191b1d" : "#f1f3f4";
    document.querySelectorAll("[data-theme-picker]").forEach(function (picker) {
      picker.hidden = false;
      picker.querySelectorAll('input[name="theme"]').forEach(function (input) {
        input.checked = input.value === preference;
      });
    });
    document.dispatchEvent(new CustomEvent("kutt:theme", { detail: { theme: root.dataset.theme } }));
  }
  // This small same-origin script runs before styles and body to avoid a light flash.
  apply();
  document.addEventListener("DOMContentLoaded", apply);
  document.addEventListener("htmx:afterSwap", apply);
  document.addEventListener("change", function (event) {
    var input = event.target;
    if (!input.matches('[data-theme-picker] input[name="theme"]') || !valid(input.value)) return;
    preference = input.value;
    try { window.localStorage.setItem(key, preference); } catch (_) { /* In-memory choice still works. */ }
    apply();
  });
  if (media) {
    if (media.addEventListener) media.addEventListener("change", apply);
    else if (media.addListener) media.addListener(apply);
  }
  window.addEventListener("storage", function (event) {
    if (event.key === key || event.key === null) { preference = stored(); apply(); }
  });
})();
