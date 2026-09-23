(() => {
  "use strict";
  const states = new WeakMap(), requests = new WeakMap();
  const focusable = dialog => [...dialog.querySelectorAll("button, a[href], input, select, textarea, [tabindex]")]
    .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length && !node.closest("[inert]"));
  const status = (dialog, text) => { dialog.querySelector(".dialog-status").textContent = text; };
  function update(dialog, initial = false) {
    if (!dialog.open) return;
    const heading = dialog.querySelector(".content-wrapper h2");
    if (heading) {
      heading.id = dialog.id + "-title";
      dialog.setAttribute("aria-labelledby", heading.id);
    } else dialog.removeAttribute("aria-labelledby");
    const active = document.activeElement;
    if (!initial && dialog.contains(active) && active.getClientRects().length && !active.disabled) return true;
    const content = dialog.querySelector(".content-wrapper");
    const target = content.querySelector(".error input, .error select, input:not([type=hidden]), select, textarea") ||
      [...content.querySelectorAll("button")].find(button => /^(Cancel|Close)$/.test(button.textContent.trim())) ||
      dialog.querySelector(".dialog-close");
    if (target && !target.disabled && target.getClientRects().length) { target.focus(); return true; }
    return false;
  }
  window.openDialog = (id, name, opener = document.activeElement) => {
    const dialog = document.getElementById(id);
    if (!dialog || typeof dialog.showModal !== "function") return;
    const previous = document.querySelector("dialog.dialog[open]");
    if (previous && !window.closeDialog()) return;
    const state = { opener, requests: new Set(), mutations: 0, initial: true };
    states.set(dialog, state);
    dialog.querySelector(".content-wrapper").replaceChildren();
    dialog.querySelector(".dialog-close").disabled = false;
    dialog.removeAttribute("aria-labelledby");
    dialog.setAttribute("aria-label", name === "qrcode" ? window.KuttI18n.t("ui.qr_code") :
      opener?.getAttribute?.("aria-label") || opener?.textContent?.trim() || window.KuttI18n.t("ui.dialog"));
    dialog.className = "dialog open";
    if (name) dialog.classList.add(name);
    status(dialog, name === "qrcode" ? "" : window.KuttI18n.t("ui.loading"));
    dialog.showModal();
    dialog.querySelector(".dialog-close").focus();
  };
  window.closeDialog = () => {
    const dialog = document.querySelector("dialog.dialog[open]");
    if (!dialog) return true;
    const state = states.get(dialog);
    // Closing an in-flight write must not imply that the server operation was cancelled.
    if (state?.mutations) { status(dialog, window.KuttI18n.t("ui.saving_changes_please_wait")); return false; }
    states.delete(dialog);
    for (const request of state?.requests || []) if (!request.mutation) request.xhr.abort();
    dialog.close();
    dialog.className = "dialog";
    dialog.querySelector(".content-wrapper").replaceChildren();
    status(dialog, "");
    const opener = state?.opener;
    if (opener?.isConnected && !opener.disabled && opener.getClientRects().length) opener.focus();
    else {
      const fallback = document.querySelector("#main-table-wrapper h2, #admin-table-wrapper h2") ||
        document.querySelector("#domains-table") || document.querySelector("main h1, main h2");
      if (fallback) { fallback.tabIndex = -1; fallback.focus(); }
    }
    return true;
  };
  document.addEventListener("cancel", event => {
    if (!event.target.matches("dialog.dialog")) return;
    event.preventDefault(); window.closeDialog();
  }, true);
  document.addEventListener("click", event => {
    if (event.target.matches("dialog.dialog[open]")) window.closeDialog();
  });
  document.addEventListener("keydown", event => {
    const dialog = event.target.closest("dialog.dialog[open]");
    if (!dialog || event.key !== "Tab") return;
    const items = focusable(dialog), first = items[0], last = items[items.length - 1];
    if (!items.length) { event.preventDefault(); return; }
    if (event.shiftKey && event.target === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && event.target === last) { event.preventDefault(); first.focus(); }
  });
  // ui-events opens the frame during capture before this event bubbles.
  document.addEventListener("htmx:before-request", event => {
    const dialog = event.detail.target?.closest("dialog.dialog"), state = states.get(dialog);
    if (!dialog || !state || !dialog.open || event.defaultPrevented) return;
    if (state.mutations) { event.preventDefault(); return; }
    const request = { dialog, state, xhr: event.detail.xhr, mutation: event.detail.requestConfig.verb.toLowerCase() !== "get" };
    request.xhr.timeout = 30000;
    requests.set(request.xhr, request); state.requests.add(request);
    if (request.mutation) state.mutations++;
    dialog.querySelector(".dialog-close").disabled = state.mutations > 0;
    status(dialog, request.mutation ? window.KuttI18n.t("ui.saving_changes") : window.KuttI18n.t("ui.loading"));
  });
  // Ignore a response from a cancelled or superseded opening, including OOB swaps.
  document.addEventListener("htmx:beforeOnLoad", event => {
    const request = requests.get(event.detail.xhr);
    if (request && (states.get(request.dialog) !== request.state || !request.dialog.open)) event.preventDefault();
  });
  document.addEventListener("htmx:afterRequest", event => {
    const request = requests.get(event.detail.xhr);
    if (!request || request.finished) return;
    request.finished = true;
    request.state.requests.delete(request);
    if (request.mutation) request.state.mutations--;
    if (states.get(request.dialog) !== request.state || !request.dialog.open) return;
    request.dialog.querySelector(".dialog-close").disabled = request.state.mutations > 0;
    status(request.dialog, event.detail.successful ? "" :
      request.mutation ? window.KuttI18n.t("ui.request_failed_check_the_saved_state_before_retrying") : window.KuttI18n.t("ui.could_not_load_this_dialog_close_it_and_try_again"));
    if (update(request.dialog, request.state.initial)) request.state.initial = false;
  });
  document.addEventListener("htmx:afterSettle", event => {
    const dialog = event.detail.target?.closest("dialog.dialog");
    const state = states.get(dialog);
    if (state && update(dialog, state.initial)) state.initial = false;
  });
})();
