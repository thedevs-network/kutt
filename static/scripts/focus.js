(() => {
  "use strict";
  function capture(element = document.activeElement) {
    if (!element || element === document.body || element === document.documentElement) return null;
    const ticket = { element, id: element.id, moved: false };
    ticket.observe = event => { if (event.target !== element && event.target !== document.body) ticket.moved = true; };
    document.addEventListener("focusin", ticket.observe);
    return ticket;
  }
  function restore(ticket, fallback) {
    if (!ticket) return;
    document.removeEventListener("focusin", ticket.observe);
    if (ticket.moved) return;
    const current = document.activeElement;
    if (current !== document.body && current !== document.documentElement && current !== ticket.element) return;
    const element = ticket.element.isConnected ? ticket.element : ticket.id && document.getElementById(ticket.id);
    const target = element && !element.disabled && element.getClientRects().length ? element : fallback;
    if (target && !target.disabled && target.getClientRects().length) target.focus({ preventScroll: true });
  }
  window.KuttFocus = { capture, restore };

  const pending = new WeakMap();
  document.addEventListener("htmx:beforeRequest", event => {
    if (event.defaultPrevented || !event.detail.xhr) return;
    const ticket = capture();
    if (!ticket) return;
    ticket.fallback = event.detail.elt?.getAttribute("data-focus-after");
    pending.set(event.detail.xhr, ticket);
  });
  const finish = event => {
    const ticket = pending.get(event.detail.xhr);
    if (!ticket) return;
    pending.delete(event.detail.xhr);
    clearTimeout(ticket.cleanup);
    restore(ticket, ticket.fallback ? document.querySelector(ticket.fallback) : null);
  };
  document.addEventListener("htmx:afterSettle", finish);
  document.addEventListener("htmx:afterRequest", event => {
    const ticket = pending.get(event.detail.xhr);
    // No-content/error responses may have no settle event. Also release listeners.
    if (ticket) ticket.cleanup = setTimeout(() => finish(event), 500);
  });

  // Carry only focus intent, never form values, across native management POSTs.
  const key = "kutt-management-focus";
  document.addEventListener("submit", event => {
    const section = event.target.closest(".library, .workspaces");
    if (event.defaultPrevented || !section || event.target.method !== "post") return;
    const path = section.classList.contains("workspaces") ? "/settings/workspaces" : "/settings/library";
    try { sessionStorage.setItem(key, JSON.stringify({ path, time: Date.now() })); } catch {}
  });
  try {
    const intent = JSON.parse(sessionStorage.getItem(key) || "null");
    sessionStorage.removeItem(key);
    if (intent && Date.now() - intent.time < 60000 &&
        (location.pathname === intent.path || location.pathname.startsWith(intent.path + "/")) &&
        document.activeElement === document.body) {
      const target = document.querySelector(".workspace-edit-error, .library [role='alert'], .workspaces [role='alert'], .library-notice") ||
        document.querySelector("[data-page-focus]");
      if (target) { target.tabIndex = -1; target.focus(); }
    }
  } catch {}

  document.addEventListener("keydown", event => {
    const tab = event.target.closest('[role="tab"]'), list = tab?.closest('[role="tablist"]');
    if (!list || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...list.querySelectorAll('[role="tab"]')], index = tabs.indexOf(tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
      (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs.forEach((item, position) => { item.tabIndex = position === next ? 0 : -1; });
    tabs[next].focus();
  });
})();
