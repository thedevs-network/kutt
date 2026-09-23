(() => {
  "use strict";
  const matches = (node, selector) => node?.matches?.(selector);
  const cancelDomain = () => {
    document.querySelector(".show-domain-form")?.classList.remove("hidden");
    document.getElementById("add-domain")?.remove();
  };
  // Capture preserves the ordering of the former target-level handlers before
  // HTMX's delegated requests and the dialog/list request-state observers.
  document.addEventListener("click", event => {
    const button = event.target.closest?.("button, a");
    if (!button || button.disabled) return;
    if (matches(button, "[data-ui-copy]")) handleShortURLCopyLink(button);
    if (matches(button, "[data-ui-close-dialog]")) closeDialog();
    if (matches(button, "[data-ui-qr-dialog]")) handleQRCode(button, button.dataset.uiQrDialog);
    if (matches(button, "[data-ui-limit]")) setLinksLimit({ currentTarget: button });
    if (matches(button, "[data-ui-page]")) setLinksSkip(event, button.dataset.uiPage);
    if (matches(button, "[data-ui-clear-search]")) clearSeachInput(event);
    if (matches(button, "[data-ui-domain-cancel]")) cancelDomain();
    if (matches(button, "[data-ui-edit-close]")) {
      const row = button.closest("tr");
      if (!row) return;
      row.classList.remove("show"); row.querySelector(".content")?.remove();
      document.getElementById("edit-opener-" + button.dataset.uiEditClose)?.focus();
    }
    if (matches(button, "[data-ui-stats-period]")) changeStatsPeriod({ target: button });
  }, true);
  document.addEventListener("input", event => {
    if (matches(event.target, '[data-ui-reset-nav="input"]')) resetTableNav();
    if (matches(event.target, "[data-ui-search]")) onSearchChange(event);
  }, true);
  document.addEventListener("keyup", event => {
    if (matches(event.target, '[data-ui-reset-nav="keyup"]')) resetTableNav();
  }, true);
  document.addEventListener("change", event => {
    const node = event.target;
    if (matches(node, '[data-ui-reset-nav="change"]')) resetTableNav();
    if (matches(node, "[data-ui-verification-email]")) canSendVerificationEmail();
    if (matches(node, "[data-ui-advanced]")) document.getElementById("advanced-options")?.classList.toggle("hidden", !node.checked);
    if (matches(node, "[data-ui-domain]")) {
      const label = document.querySelector("#customurl-label span");
      if (label) label.textContent = node.value + "/";
    }
  }, true);
  document.addEventListener("htmx:configRequest", event => {
    const node = event.detail.elt;
    if (matches(node, "[data-stats-id]")) event.detail.parameters.id = node.dataset.statsId;
  });
  document.addEventListener("htmx:before-request", event => {
    const node = event.detail.elt;
    if (matches(node, "[data-ui-no-request]")) event.preventDefault();
    if (event.defaultPrevented) return;
    if (matches(node, "[data-ui-open-dialog]")) openDialog(node.dataset.uiOpenDialog, null, node);
    if (matches(node, "[data-ui-signup]")) document.getElementById("login-signup")?.classList.add("signup");
    if (matches(node, "[data-ui-edit-toggle]")) {
      const row = event.detail.target, content = row.querySelector(".content");
      row.classList.add("show");
      if (content) { event.preventDefault(); row.classList.remove("show"); content.remove(); }
    }
  }, true);
  document.addEventListener("htmx:after-request", event => {
    const node = event.detail.elt;
    if (matches(node, "[data-ui-signup]")) document.getElementById("login-signup")?.classList.remove("signup");
    if (matches(node, "[data-ui-domain-save]") && event.detail.successful && event.detail.xhr.getResponseHeader("HX-Reswap") === "none") cancelDomain();
    if (matches(node, "[data-ui-domain-load]")) {
      const loaded = event.detail.successful && document.getElementById("add-domain");
      document.getElementById("domain-load-error").hidden = !!loaded;
      if (loaded) node.classList.add("hidden");
    }
  }, true);
  document.addEventListener("htmx:afterOnLoad", event => {
    if (matches(event.detail.elt, "[data-ui-table-nav]")) updateLinksNav();
  });
  document.addEventListener("htmx:afterSettle", event => {
    if (matches(event.detail.elt, "[data-ui-table-search]")) onSearchInputLoad();
  });
  document.addEventListener("htmx:afterSwap", event => {
    if (!matches(event.detail.target, "[data-ui-stats]")) return;
    trimText(".stats-info p", 80); formatDateHour("#stats .last-update-value"); createCharts();
  });
  for (const name of ["mousemove", "pointerdown", "mouseout", "pointerup"]) {
    document.addEventListener(name, event => {
      if (!event.target.closest?.("[data-ui-map]")) return;
      if (name === "mousemove" || name === "pointerdown") mapTooltipHoverOver(event);
      else mapTooltipHoverOut();
    });
  }
})();
