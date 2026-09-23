(() => {
  "use strict";
  const initialized = Symbol.for("kutt.validation.initialized");
  if (window[initialized]) return;
  window[initialized] = true;
  const pending = new WeakMap();
  let sequence = 0;
  const errors = form => [...form.querySelectorAll("p.error")].filter(node => !node.hidden && node.textContent.trim());
  function clearField(field, hide = false) {
    if (!field?.dataset) return;
    const ids = (field.dataset.validationErrors || "").split(" ").filter(Boolean);
    if (!ids.length) return;
    const described = (field.getAttribute("aria-describedby") || "").split(" ").filter(id => id && !ids.includes(id));
    if (described.length) field.setAttribute("aria-describedby", described.join(" "));
    else field.removeAttribute("aria-describedby");
    field.removeAttribute("aria-invalid");
    delete field.dataset.validationErrors;
    if (hide) {
      for (const id of ids) {
        const error = document.getElementById(id);
        if (error?.closest("form") === field.form) error.hidden = true;
      }
      field.closest("label.error, .target-wrapper.error")?.classList.remove("error");
    }
  }
  function decorate(form) {
    // hx-preserve keeps old input attributes as well as drafts: refresh associations after every swap.
    form.querySelectorAll("[data-validation-errors]").forEach(field => clearField(field));
    if (!form.dataset.validationScope) form.dataset.validationScope = form.id || "form-" + (++sequence);
    errors(form).forEach((error, index) => {
      let field = error.dataset.errorField ? form.elements.namedItem(error.dataset.errorField) :
        error.closest("label")?.querySelector("input:not([type=hidden]), select, textarea");
      if (field?.matches?.("[data-date-time-value][type=hidden]")) field = field.closest("[data-date-time]").querySelector("[data-date-time-display]");
      error.id ||= "validation-" + form.dataset.validationScope + "-" + (field?.name || "general") + "-" + index;
      error.setAttribute("role", "alert"); error.tabIndex = -1;
      if (!field?.setAttribute) { error.dataset.validationGeneral = "true"; return; }
      field.setAttribute("aria-invalid", "true");
      const ids = new Set((field.getAttribute("aria-describedby") || "").split(" ").filter(Boolean));
      ids.add(error.id); field.setAttribute("aria-describedby", [...ids].join(" "));
      field.dataset.validationErrors = [field.dataset.validationErrors, error.id].filter(Boolean).join(" ");
    });
  }
  function refresh(root) {
    if (root?.matches?.("form")) decorate(root);
    root?.querySelectorAll?.("form").forEach(decorate);
  }
  function focusError(form, state) {
    if (!form?.isConnected || state?.moved) return;
    const active = document.activeElement;
    if (active !== document.body && active !== document.documentElement && active !== state?.active && !form.contains(active)) return;
    const target = [...form.querySelectorAll('[aria-invalid="true"]'), ...errors(form)]
      .find(node => !node.disabled && node.getClientRects().length);
    target?.focus();
  }
  function release(state) { if (state?.observe) document.removeEventListener("focusin", state.observe); }
  function edited(event) {
    clearField(event.target, true);
    event.target.form?.querySelectorAll("[data-validation-general]:not([data-request-error])")
      .forEach(error => { error.hidden = true; });
  }
  document.addEventListener("input", edited);
  document.addEventListener("change", edited);
  document.addEventListener("htmx:beforeRequest", event => {
    const form = event.detail.elt?.closest("form");
    if (!form || !event.detail.xhr || event.defaultPrevented) return;
    const state = { form, id: form.id, action: form.getAttribute("hx-post"), active: document.activeElement, moved: false };
    state.observe = e => {
      if (e.target !== document.body && e.target !== state.active && !form.contains(e.target) &&
          !(state.id && e.target.closest("form")?.id === state.id)) state.moved = true;
    };
    document.addEventListener("focusin", state.observe);
    pending.set(event.detail.xhr, state);
    form.querySelector("[data-request-error]")?.remove();
  });
  document.addEventListener("htmx:afterSwap", event => {
    refresh(event.detail.elt);
  });
  document.addEventListener("htmx:afterSettle", event => {
    const state = pending.get(event.detail.xhr);
    if (!state) return;
    let form = state.form.isConnected ? state.form : state.id && document.getElementById(state.id);
    if (!form && state.action) {
      const root = event.detail.elt;
      const forms = root?.matches?.("form") ? [root] : [...(root?.querySelectorAll?.("form") || [])];
      const candidates = forms.filter(node => node.getAttribute("hx-post") === state.action);
      if (candidates.length === 1) form = candidates[0];
    }
    if (form) { decorate(form); release(state); focusError(form, state); }
  });
  function requestFailed(event) {
    const state = pending.get(event.detail.xhr), form = state?.form;
    if (!form?.isConnected || form.closest("dialog")) return;
    let error = form.querySelector("[data-request-error]");
    if (!error) {
      error = document.createElement("p"); error.className = "error"; error.dataset.requestError = "true";
      form.append(error);
    }
    error.textContent = window.KuttI18n.t("ui.the_request_could_not_be_confirmed_your_draft_is_kept_check");
    decorate(form); release(state); focusError(form, state);
  }
  for (const name of ["htmx:responseError", "htmx:sendError", "htmx:timeout"]) document.addEventListener(name, requestFailed);
  document.addEventListener("htmx:afterRequest", event => {
    const state = pending.get(event.detail.xhr);
    if (!state) return;
    // A delayed swap can follow afterRequest; weak request state stays available without a focus listener leak.
    setTimeout(() => release(state), 1000);
  });
  refresh(document);
  const initial = document.querySelector("form p.error:not([hidden])")?.closest("form");
  if (initial) focusError(initial);
})();
