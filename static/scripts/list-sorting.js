(() => {
  "use strict";
  const pending = new WeakSet();
  const requests = new WeakMap();
  const loading = new WeakMap();
  const tables = () => document.querySelectorAll("table[hx-get]");
  const editing = table => !!table.querySelector('form[id^="edit-form-"]') || (loading.get(table) || 0) > 0;
  function reconcile() {
    for (const table of tables()) {
      const busy = editing(table);
      for (const control of table.querySelectorAll(".list-sort-select")) {
        control.disabled = busy;
        control.title = busy ? window.KuttI18n.t("sorting.close_editors") : "";
      }
      if (!busy && pending.has(table) && !table.classList.contains("htmx-request")) {
        pending.delete(table);
        htmx.trigger(table, "reloadMainTable");
      }
    }
  }
  // Reset only the offset before HTMX serializes the changed select.
  document.addEventListener("change", event => {
    if (!event.target.matches(".list-sort-select")) return;
    const skip = event.target.closest("table")?.querySelector('[name="skip"]');
    if (skip) skip.value = "0";
  }, true);
  document.addEventListener("htmx:configRequest", event => {
    const table = event.detail.elt;
    if (!table?.matches("table[hx-get]")) return;
    // Disabled selects must not silently turn a deferred request into id order.
    for (const name of ["sort", "direction"]) {
      const control = table.querySelector('.list-sort-select[name="' + name + '"]');
      if (control) event.detail.parameters[name] = control.value;
    }
  });
  document.addEventListener("htmx:beforeRequest", event => {
    if (event.defaultPrevented) return;
    const element = event.detail.elt, table = element?.closest("table[hx-get]");
    if (!table || !event.detail.xhr) return;
    let kind;
    if (element === table) {
      if (editing(table)) { pending.add(table); event.preventDefault(); return; }
      kind = "list";
    } else if (element.matches('button.edit[hx-get]')) {
      loading.set(table, (loading.get(table) || 0) + 1);
      kind = "open";
    } else if (element.closest('form[id^="edit-form-"]') && event.detail.requestConfig?.verb === "patch") kind = "save";
    if (kind) requests.set(event.detail.xhr, { table, kind });
    reconcile();
  });
  document.addEventListener("htmx:beforeSwap", event => {
    const request = requests.get(event.detail.xhr);
    if (request?.kind === "list" && editing(request.table)) {
      // A new editor may have opened while this list response was in flight.
      event.detail.shouldSwap = false;
      pending.add(request.table);
    }
  });
  document.addEventListener("htmx:afterRequest", event => {
    const request = requests.get(event.detail.xhr);
    requests.delete(event.detail.xhr);
    if (request?.kind === "open") loading.set(request.table, Math.max(0, (loading.get(request.table) || 0) - 1));
    if (request?.kind === "save" && request.table.isConnected && event.detail.successful &&
        request.table.querySelector('[name="sort"]')?.value !== "id") pending.add(request.table);
    reconcile();
  });
  // Saving keeps every open editor intact. Reorder after the last editor closes.
  new MutationObserver(reconcile).observe(document.body, { childList: true, subtree: true });
  reconcile();
})();
