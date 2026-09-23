(() => {
  "use strict";
  const page = document.querySelector(".health-page"); if (!page) return;
  const message = document.querySelector("#health-message");
  const states = { disabled: window.KuttI18n.t("ui.monitoring_disabled"), pending: window.KuttI18n.t("ui.check_pending"), checking: window.KuttI18n.t("ui.checking_destinations"), healthy: window.KuttI18n.t("ui.healthy"), attention: window.KuttI18n.t("ui.needs_attention"), stale: window.KuttI18n.t("ui.results_out_of_date"), authorization_required: window.KuttI18n.t("ui.review_and_re_enable_monitoring_after_authorization_changed"), configuration_invalid: window.KuttI18n.t("ui.repair_saved_destination_rules_before_checking"), results_unavailable: window.KuttI18n.t("ui.results_unreadable_queue_a_fresh_check_or_disable_monitoring") };
  const show = (text, error = false) => { message.textContent = text; message.classList.toggle("error", error); };
  const node = (tag, text, parent) => { const result = document.createElement(tag); result.textContent = text; parent.append(result); return result; };
  async function request(url, method = "GET", body) {
    const response = await fetch(url, { method, credentials: "same-origin", headers: { Accept: "application/json", "Content-Type": "application/json" }, ...(body && { body: JSON.stringify(body) }) });
    return window.KuttResponses.read(response, value => page.dataset.healthDashboard ? window.KuttResponses.healthList(value) :
      window.KuttResponses.health(value) && (method !== "PUT" || value.revision === body.revision + 1) &&
        (method !== "POST" || value.queued === true),
    window.KuttI18n.t("ui.changed_elsewhere_reload_saved_monitoring_before_saving"));
  }
  if (page.dataset.healthDashboard) {
    const list = document.querySelector("#health-links"), refresh = document.querySelector("#health-refresh"), more = document.querySelector("#health-more");
    let cursor = null, busy = false;
    async function load(reset) {
      if (busy) return;
      const focus = window.KuttFocus.capture();
      busy = true; refresh.disabled = more.disabled = true; show(window.KuttI18n.t("ui.loading"));
      try {
        const result = await request("/api/v2/links/health" + (!reset && cursor ? "?before=" + encodeURIComponent(cursor) : ""));
        if (reset) list.replaceChildren();
        for (const item of result.data) {
          const row = node("li", "", list), link = node("a", item.link, row); link.href = "/link/health/" + encodeURIComponent(item.id);
          node("p", states[item.state] || window.KuttI18n.t("ui.unknown"), row).className = item.state === "healthy" ? "healthy" : "";
          if (item.overdue) node("p", window.KuttI18n.t("ui.check_overdue_inspect_the_background_worker_or_queue_capacity"), row);
          for (const failure of item.results.filter(value => value.code !== "OK")) node("p", (failure.display_name || failure.name) + ": " + failure.action, row);
        }
        cursor = result.next; more.hidden = !cursor;
        show(list.children.length ? window.KuttI18n.t("ui.monitoring_refreshed") : window.KuttI18n.t("ui.no_monitored_links_open_a_link_in_library_to_configure_monitoring"));
      } catch (error) { show(window.KuttI18n.failure(error), true); }
      finally { busy = false; refresh.disabled = more.disabled = false; window.KuttFocus.restore(focus, refresh); }
    }
    refresh.addEventListener("click", () => load(true)); more.addEventListener("click", () => load(false)); void load(true); return;
  }
  const form = document.querySelector("#health-form"), check = document.querySelector("#health-check"), results = document.querySelector("#health-results");
  const api = "/api/v2/links/" + encodeURIComponent(page.dataset.linkId) + "/health";
  let revision = null, enabled = false, busy = false;
  function lock(value) {
    busy = value;
    form.querySelectorAll("input,button").forEach(item => { item.disabled = value || (revision === null && item.id !== "health-reload"); });
    check.disabled = value || !enabled || revision === null;
  }
  function render(data, replaceForm) {
    revision = data.revision; enabled = data.enabled;
    if (replaceForm) { form.elements.enabled.checked = enabled; form.elements.interval_hours.value = data.interval_hours; }
    document.querySelector("#health-state").textContent = states[data.state] || window.KuttI18n.t("ui.unknown");
    document.querySelector("#health-times").textContent = (data.checked_at ? window.KuttI18n.t("health.last_cycle", { date: window.KuttI18n.date(data.checked_at) }) + " " : "") +
      (data.next_at ? window.KuttI18n.t("health.next_due", { date: window.KuttI18n.date(data.next_at) }) + " " : "") + (data.overdue ? window.KuttI18n.t("ui.check_overdue_inspect_the_worker_or_queue_capacity") : "");
    results.replaceChildren();
    for (const item of data.results) {
      const row = node("li", "", results); node("strong", item.display_name || item.name, row);
      node("p", item.code + (item.http_status ? " (HTTP " + item.http_status + ")" : "") + " | " + window.KuttI18n.number(item.duration_ms) + " ms", row).className = item.code === "OK" ? "healthy" : "error";
      node("p", item.action, row);
    }
    if (!data.results.length) node("li", data.source_changed ? window.KuttI18n.t("ui.destinations_changed_previous_results_no_longer_apply") : window.KuttI18n.t("ui.no_current_results"), results);
  }
  async function load() {
    if (busy) return;
    const focus = window.KuttFocus.capture();
    lock(true); show(window.KuttI18n.t("ui.loading"));
    try { render(await request(api), true); show(window.KuttI18n.t("ui.saved_monitoring_loaded")); }
    catch (error) { show(window.KuttI18n.failure(error), true); } finally { lock(false); window.KuttFocus.restore(focus); }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || revision === null) return;
    const focus = window.KuttFocus.capture();
    const body = { revision, enabled: form.elements.enabled.checked, interval_hours: Number(form.elements.interval_hours.value) };
    lock(true); show(window.KuttI18n.t("ui.saving"));
    try { render(await request(api, "PUT", body), false); show(window.KuttI18n.t("ui.monitoring_saved")); }
    catch (error) { show(window.KuttI18n.failure(error), true); } finally { lock(false); window.KuttFocus.restore(focus); }
  });
  check.addEventListener("click", async () => {
    if (busy || revision === null || !enabled) return;
    const focus = window.KuttFocus.capture();
    lock(true); show(window.KuttI18n.t("ui.queueing"));
    try { render(await request(api + "/check", "POST", { revision }), false); show(window.KuttI18n.t("ui.check_queued_refresh_to_view_results")); }
    catch (error) { show(window.KuttI18n.failure(error), true); } finally { lock(false); window.KuttFocus.restore(focus, document.querySelector("#health-reload")); }
  });
  document.querySelector("#health-reload").addEventListener("click", load); void load();
})();
