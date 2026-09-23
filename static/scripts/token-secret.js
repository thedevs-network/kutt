(() => {
  "use strict";
  const states = new WeakMap();
  const roots = () => document.querySelectorAll("[data-token-secret]");
  function state(root) {
    if (!states.has(root)) states.set(root, { generation: 0, pending: false });
    return states.get(root);
  }
  function mask(root) {
    const input = root.querySelector("input"), reveal = root.querySelector('[data-token-action="reveal"]');
    input.type = "password";
    reveal.setAttribute("aria-pressed", "false");
    reveal.setAttribute("aria-label", window.KuttI18n.t("ui.reveal_api_token"));
    reveal.title = window.KuttI18n.t("ui.reveal_api_token");
  }
  function clear(root) {
    state(root).generation++;
    const input = root.querySelector("input");
    input.value = ""; input.removeAttribute("value");
    mask(root);
    root.querySelectorAll("button").forEach(button => { button.disabled = true; });
    root.removeAttribute("aria-busy");
    const status = root.querySelector('[role="status"]');
    status.classList.remove("error");
    status.textContent = window.KuttI18n.t("ui.token_hidden_it_remains_active_until_revoked");
  }
  function initialize() {
    roots().forEach(root => {
      if (states.has(root)) return;
      state(root); mask(root);
      root.querySelectorAll("button").forEach(button => { button.disabled = false; });
    });
  }
  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-token-action]"), root = button?.closest("[data-token-secret]");
    if (!root || button.disabled) return;
    const input = root.querySelector("input"), status = root.querySelector('[role="status"]'), current = state(root);
    if (!input.value) return;
    if (button.dataset.tokenAction === "hide") { clear(root); input.focus(); return; }
    if (button.dataset.tokenAction === "reveal") {
      if (input.type === "text") { mask(root); return; }
      input.type = "text"; button.setAttribute("aria-pressed", "true");
      button.setAttribute("aria-label", window.KuttI18n.t("ui.mask_api_token")); button.title = window.KuttI18n.t("ui.mask_api_token");
      return;
    }
    if (button.dataset.tokenAction !== "copy" || current.pending) return;
    const generation = current.generation;
    current.pending = true; button.disabled = true; root.setAttribute("aria-busy", "true");
    status.classList.remove("error"); status.textContent = window.KuttI18n.t("ui.copying");
    let timer;
    try {
      if (!navigator.clipboard?.writeText) throw new Error(window.KuttI18n.t("ui.clipboard_unavailable"));
      await Promise.race([navigator.clipboard.writeText(input.value), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(window.KuttI18n.t("ui.clipboard_timeout"))), 3000);
      })]);
      if (root.isConnected && generation === current.generation) status.textContent = window.KuttI18n.t("ui.token_copied");
    } catch {
      if (root.isConnected && generation === current.generation) {
        status.classList.add("error");
        status.textContent = window.KuttI18n.t("ui.copy_failed_reveal_the_token_to_copy_it_manually");
      }
    } finally {
      clearTimeout(timer); current.pending = false;
      if (root.isConnected && generation === current.generation) {
        button.disabled = !input.value; root.removeAttribute("aria-busy");
      }
    }
  });
  document.addEventListener("htmx:afterSwap", initialize);
  document.addEventListener("htmx:beforeCleanupElement", event => {
    const element = event.detail.elt;
    if (element.matches?.("[data-token-secret]")) clear(element);
    element.querySelectorAll?.("[data-token-secret]").forEach(clear);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) roots().forEach(mask); });
  window.addEventListener("pagehide", () => roots().forEach(clear));
  initialize();
})();
