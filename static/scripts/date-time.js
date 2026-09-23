(() => {
  "use strict";
  const states = new WeakMap();
  const pendingForms = new Map(), requests = new WeakMap();
  const formKey = form => form?.id || form;
  const isBusy = field => pendingForms.has(formKey(field.closest("form"))) || !!field.closest(".htmx-settling");
  const refreshBusy = root => root.querySelectorAll("[data-date-time]").forEach(field => {
    if (!states.has(field)) return;
    field.querySelector("[data-date-time-open]").disabled = field.querySelector("[data-date-time-display]").disabled = isBusy(field);
  });
  const canonical = value => {
    if (!value) return "";
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?$/.test(value)) return null;
    const full = value.length === 16 ? value + ":00" : value;
    const time = Date.parse(full + "Z");
    return Number.isFinite(time) && time >= 0 && new Date(time).toISOString().slice(0, 19) === full ? full : null;
  };
  function initialize(root) {
    const fields = root?.matches?.("[data-date-time]") ? [root] : [...(root?.querySelectorAll?.("[data-date-time]") || [])];
    for (const field of fields) {
      if (states.has(field)) continue;
      const dialog = field.querySelector("[data-date-time-dialog]");
      if (typeof dialog.showModal !== "function") continue;
      const input = field.querySelector("[data-date-time-value]"), display = field.querySelector("[data-date-time-display]");
      const date = field.querySelector("[data-date-time-date]"), time = field.querySelector("[data-date-time-time]");
      const open = field.querySelector("[data-date-time-open]"), error = field.querySelector("[data-date-time-error]");
      let opener;
      const render = () => { display.value = (canonical(input.value) ?? input.value).replace("T", " "); };
      const expanded = value => [open, display].forEach(node => node.setAttribute("aria-expanded", String(value)));
      const close = () => {
        dialog.close(); date.disabled = time.disabled = true;
        expanded(false); if (opener?.isConnected) opener.focus();
      };
      const commit = value => {
        input.value = value; render(); close();
        display.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const apply = () => {
        const value = canonical(date.value + "T" + time.value);
        if (!date.value || !time.value || value === null || !date.checkValidity() || !time.checkValidity()) {
          error.textContent = window.KuttI18n.t("schedule.invalid"); error.hidden = false;
          (!date.value || !date.checkValidity() ? date : time).focus(); return;
        }
        commit(value);
      };
      const show = event => {
        if (isBusy(field)) return;
        opener = event.currentTarget;
        date.disabled = time.disabled = false;
        const value = canonical(input.value);
        date.value = value ? value.slice(0, 10) : "";
        time.value = value ? value.slice(11) : "00:00:00";
        error.hidden = true; expanded(true); dialog.showModal(); date.focus();
      };
      input.type = "hidden";
      date.disabled = time.disabled = true;
      field.closest(".date-time-field").querySelector("[data-date-time-label]").htmlFor = display.id;
      field.querySelector("[data-date-time-result]").hidden = false;
      open.addEventListener("click", show); display.addEventListener("click", show);
      display.addEventListener("keydown", event => {
        if (["Enter", " ", "ArrowDown"].includes(event.key)) { event.preventDefault(); show(event); }
      });
      dialog.addEventListener("cancel", event => { event.preventDefault(); close(); });
      dialog.addEventListener("keydown", event => {
        if (event.key === "Enter" && event.target.matches("input")) { event.preventDefault(); apply(); }
      });
      field.querySelector("[data-date-time-cancel]").addEventListener("click", close);
      field.querySelector("[data-date-time-clear]").addEventListener("click", () => commit(""));
      field.querySelector("[data-date-time-apply]").addEventListener("click", apply);
      for (const part of [date, time]) part.addEventListener("input", () => { error.hidden = true; });
      states.set(field, { render, dialog }); render();
    }
    refreshBusy(document);
  }
  initialize(document);
  document.addEventListener("htmx:afterSwap", event => initialize(event.detail.elt));
  document.addEventListener("htmx:load", event => initialize(event.detail.elt));
  document.addEventListener("htmx:beforeRequest", event => {
    const form = event.detail.elt.closest("form");
    if (form) {
      const key = formKey(form);
      requests.set(event.detail.xhr, key);
      pendingForms.set(key, (pendingForms.get(key) || 0) + 1);
      refreshBusy(document);
    }
  });
  document.addEventListener("htmx:afterRequest", event => {
    // HTMX may dispatch completion from an ancestor after replacing the form.
    const key = requests.get(event.detail.xhr);
    if (key !== undefined) {
      requests.delete(event.detail.xhr);
      const count = pendingForms.get(key) - 1;
      if (count > 0) pendingForms.set(key, count); else pendingForms.delete(key);
    }
    refreshBusy(document);
  });
  document.addEventListener("htmx:afterSettle", () => refreshBusy(document));
  document.addEventListener("reset", event => setTimeout(() => {
    event.target.querySelectorAll("[data-date-time]").forEach(field => states.get(field)?.render());
  }, 0));
})();
