(() => {
  const root = document.querySelector(".integrations-page"); if (!root) return;
  const $ = id => document.getElementById(id), form = $("hook-form");
  let rows = [], editing = null, selected = null, older = null, source = null, after = "0", busy = false, secret = "", deliveryBusy = false, editorOpener = null, validationError = false;
  let secretGeneration = 0, secretCopyPending = false;
  const status = (text, error = false) => { $("integration-status").textContent = text; $("integration-status").className = error ? "integration-error" : ""; };
  function clearFormError() { $("hook-form-error").textContent = ""; $("hook-form-error").hidden = true; validationError = false; }
  const date = value => value ? window.KuttI18n.date(new Date(value)) : "-";
  async function api(path, method = "GET", body) {
    const response = await fetch("/api/v2/" + path, { method, credentials: "same-origin", cache: "no-store",
      headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const checks = window.KuttResponses;
    if (method === "DELETE") return checks.acknowledgement(response, 204);
    if (path.endsWith("/retry")) return checks.acknowledgement(response, 202, "Accepted");
    const create = path === "webhooks" && method === "POST", rotate = path.endsWith("/rotate"), test = path.endsWith("/test");
    const schema = path === "events" ? checks.events : /\/deliveries(?:\?|$)/.test(path) ? checks.deliveries :
      test ? checks.deliveryQueued : create || rotate ? checks.hookSecret : method === "GET" ? checks.hookList : checks.hook;
    if (response.ok && response.status !== (create ? 201 : test ? 202 : 200)) throw checks.unexpected();
    return checks.read(response, data => schema(data) &&
      (!(method === "PUT" || rotate) || data.revision === body.revision + 1) && (!create || data.revision === 1));
  }
  async function action(run, fromForm = false) {
    if (busy) return; busy = true;
    let errorTarget = null;
    if (fromForm) { clearFormError(); status(""); }
    root.querySelectorAll("button,input").forEach(el => { el.disabled = true; });
    try { await run(); } catch (error) {
      if (fromForm && !$("hook-editor").hidden) {
        errorTarget = $("hook-form-error"); errorTarget.textContent = window.KuttI18n.failure(error); errorTarget.hidden = false;
        validationError = error.status === 400 || error.status === 422;
      } else { status(window.KuttI18n.failure(error), true); if (fromForm) errorTarget = $("integration-status"); }
    } finally {
      busy = false; root.querySelectorAll("button,input").forEach(el => { el.disabled = false; });
      $("hook-secret-copy").disabled = secretCopyPending || !secret;
      if (errorTarget && (document.activeElement === document.body || form.contains(document.activeElement))) errorTarget.focus();
    }
  }
  function node(tag, text, cls) { const el = document.createElement(tag); el.textContent = text; if (cls) el.className = cls; return el; }
  function button(text, click) { const el = node("button", text); el.type = "button"; el.addEventListener("click", click); return el; }
  function secretStatus(text = "", error = false) {
    $("hook-secret-status").textContent = text;
    $("hook-secret-status").className = error ? "integration-error" : "";
  }
  function hideSecret() {
    secretGeneration++; secretCopyPending = false; secret = "";
    $("hook-secret-value").textContent = ""; $("hook-secret").hidden = true;
    $("hook-secret-copy-label").textContent = window.KuttI18n.t("ui.copy"); $("hook-secret-copy").disabled = true;
    secretStatus();
  }
  function showSecret(value) {
    hideSecret();
    if (value) {
      secret = value; $("hook-secret-value").textContent = value; $("hook-secret").hidden = false;
      $("hook-secret-copy").disabled = busy;
    }
  }
  async function copySecret() {
    if (busy || secretCopyPending || !secret) return;
    const generation = secretGeneration;
    const current = () => root.isConnected && generation === secretGeneration && !$("hook-secret").hidden;
    secretCopyPending = true; $("hook-secret-copy").disabled = true;
    $("hook-secret-copy-label").textContent = window.KuttI18n.t("ui.copying"); secretStatus(window.KuttI18n.t("ui.copying"));
    let timer;
    try {
      if (!navigator.clipboard?.writeText) throw new Error(window.KuttI18n.t("ui.clipboard_unavailable"));
      await Promise.race([navigator.clipboard.writeText(secret), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(window.KuttI18n.t("ui.clipboard_timeout"))), 3000);
      })]);
      if (current()) { $("hook-secret-copy-label").textContent = window.KuttI18n.t("ui.copied_2"); secretStatus(window.KuttI18n.t("ui.signing_secret_copied")); }
    } catch {
      if (current()) {
        $("hook-secret-copy-label").textContent = window.KuttI18n.t("ui.copy");
        secretStatus(window.KuttI18n.t("ui.copy_failed_select_the_signing_secret_above_to_copy_it_manually"), true);
      }
    } finally {
      clearTimeout(timer);
      if (current()) { secretCopyPending = false; $("hook-secret-copy").disabled = busy || !secret; }
    }
  }
  function editor(row) {
    if (busy) return;
    editorOpener = document.activeElement; clearFormError(); status("");
    hideSecret(); editing = row || null; form.reset();
    $("hook-editor-title").textContent = row ? window.KuttI18n.t("ui.edit_webhook") : window.KuttI18n.t("ui.new_webhook");
    form.elements.name.value = row?.name || ""; form.elements.url.value = row?.url || "";
    form.elements.enabled.checked = !!row?.enabled;
    form.querySelectorAll("[name=events]").forEach(el => { el.checked = row ? row.events.includes(el.value) : true; });
    $("hook-editor").hidden = false; form.elements.name.focus();
  }
  function config(row) { return { name: row.name, url: row.url, enabled: row.enabled, events: row.events, revision: row.revision }; }
  function renderHooks() {
    const list = $("hooks-list"); list.replaceChildren();
    if (!rows.length) list.append(node("p", window.KuttI18n.t("ui.no_webhooks_configured")));
    for (const row of rows) {
      const item = node("article", "", "hook-row"), actions = node("div", "", "integration-actions");
      item.dataset.id = row.id;
      item.append(node("h3", row.name), node("p", row.url, "hook-url"), node("p", row.authorization_required ? window.KuttI18n.t("ui.authorization_changed_save_this_webhook_again_to_resume") : row.enabled ? window.KuttI18n.t("ui.enabled") : window.KuttI18n.t("ui.disabled")), node("p", row.events.map(event => window.KuttI18n.label("event", event)).join(", ")));
      actions.append(button(window.KuttI18n.t("ui.edit"), () => editor(row)), button(row.enabled ? window.KuttI18n.t("ui.disable") : window.KuttI18n.t("ui.enable"), () => action(async () => {
        hideSecret(); await api("webhooks/" + row.id, "PUT", { ...config(row), enabled: !row.enabled }); await loadHooks(); status(window.KuttI18n.t("ui.webhook_updated_previous_pending_deliveries_were_cancelled"));
      })), button(window.KuttI18n.t("ui.deliveries"), () => action(async () => { selected = row; older = null; await loadDeliveries(); })),
      button(window.KuttI18n.t("ui.send_test"), () => action(async () => { await api("webhooks/" + row.id + "/test", "POST", { revision: row.revision }); selected = row; older = null; await loadDeliveries(); status(window.KuttI18n.t("ui.test_delivery_queued")); })),
      button(window.KuttI18n.t("ui.rotate_secret"), () => action(async () => {
        if (!window.confirm(window.KuttI18n.t("ui.rotate_this_signing_secret_and_cancel_previous_pending_deliveries_update_the"))) return;
        const result = await api("webhooks/" + row.id + "/rotate", "POST", { revision: row.revision }); await loadHooks(); showSecret(result.secret); status(window.KuttI18n.t("ui.signing_secret_rotated"));
      })), button(window.KuttI18n.t("ui.delete"), () => action(async () => {
        if (!window.confirm(window.KuttI18n.t("ui.delete_this_webhook_and_its_delivery_records_link_history_and_links"))) return;
        await api("webhooks/" + row.id, "DELETE", { revision: row.revision }); hideSecret();
        if (selected?.id === row.id) { selected = null; $("hook-deliveries").hidden = true; }
        await loadHooks(); status(window.KuttI18n.t("ui.webhook_deleted"));
      })));
      actions.querySelectorAll("button").forEach(el => { el.disabled = busy; });
      item.append(actions); list.append(item);
    }
  }
  async function loadHooks() {
    const result = await api("webhooks"); rows = result.data; renderHooks();
    if (selected) selected = rows.find(row => row.id === selected.id) || null;
  }
  async function loadDeliveries(before) {
    if (!selected || deliveryBusy) return; deliveryBusy = true;
    const id = selected.id;
    $("hook-deliveries").hidden = false; $("deliveries-title").textContent = window.KuttI18n.t("webhooks.deliveries_title", { name: selected.name });
    $("deliveries-status").textContent = window.KuttI18n.t("ui.loading");
    try {
      const result = await api("webhooks/" + id + "/deliveries" + (before ? "?before=" + encodeURIComponent(before) : ""));
      if (selected?.id !== id) return;
      const list = $("deliveries-list"); if (!before) list.replaceChildren(); older = result.next;
      for (const delivery of result.data) {
        const row = node("article", "", "delivery-row");
        row.append(node("strong", window.KuttI18n.label("event", delivery.type) + " - " + window.KuttI18n.label("delivery", delivery.state)), node("span", window.KuttI18n.t("webhooks.attempts", { count: delivery.total_attempts, date: date(delivery.created_at) })), node("span", delivery.id));
        if (delivery.error) row.append(node("span", window.KuttI18n.label("code", delivery.error) + (delivery.http_status ? " (HTTP " + delivery.http_status + ")" : ""), "integration-error"));
        if (delivery.next_at) row.append(node("span", window.KuttI18n.t("webhooks.next_attempt", { date: date(delivery.next_at) })));
        if (delivery.state === "failed" && delivery.revision === selected.revision && selected.enabled && !selected.authorization_required) row.append(button(window.KuttI18n.t("ui.retry"), () => action(async () => {
          await api("webhooks/" + id + "/retry", "POST", { delivery_id: delivery.id, revision: selected.revision }); await loadDeliveries(); status(window.KuttI18n.t("ui.delivery_retry_queued"));
        })));
        list.append(row);
      }
      $("deliveries-status").textContent = list.children.length ? window.KuttI18n.t("common.updated_at", { date: window.KuttI18n.date(new Date(), { timeStyle: "short" }) }) : window.KuttI18n.t("ui.no_deliveries_yet");
      $("deliveries-older").hidden = !older;
    } catch (error) { $("deliveries-list").replaceChildren(); $("deliveries-status").textContent = window.KuttI18n.failure(error); $("deliveries-older").hidden = true; }
    finally { deliveryBusy = false; }
  }
  function event(value) {
    if (!window.KuttResponses.event(value)) throw window.KuttResponses.unexpected();
    const list = $("events-list");
    if (Array.from(list.children).some(el => el.dataset.id === value.id)) return;
    const item = node("li", window.KuttI18n.label("event", value.type) + " - " + date(value.occurred_at) + (value.data.link_id ? " - " + value.data.link_id : ""));
    if (value.delivery?.status === "not_queued") item.append(node("p", window.KuttI18n.t("ui.moderation_saved_webhook_notification_was_not_queued_because_delivery_capacity_was")));
    item.dataset.id = value.id; list.prepend(item);
    while (list.children.length > 50) list.lastElementChild.remove(); after = value.sequence;
  }
  function connect() {
    source?.close(); source = null;
    if (!$("events-live").checked || document.hidden) { $("events-status").textContent = window.KuttI18n.t("ui.paused"); return; }
    source = new EventSource("/api/v2/events/stream?after=" + encodeURIComponent(after));
    source.onopen = () => { $("events-status").textContent = window.KuttI18n.t("ui.connected"); };
    source.addEventListener("management", received => { try { event(JSON.parse(received.data)); } catch { $("events-status").textContent = window.KuttI18n.t("ui.invalid_update_reload_integrations"); } });
    source.onerror = () => { $("events-status").textContent = window.KuttI18n.t("ui.reconnecting"); };
    for (const name of ["revoked", "unavailable"]) source.addEventListener(name, () => { source?.close(); source = null; $("events-status").textContent = name === "revoked" ? window.KuttI18n.t("ui.session_ended_sign_in_again") : window.KuttI18n.t("ui.updates_unavailable_reload_to_retry"); });
  }
  form.addEventListener("submit", e => { e.preventDefault(); void action(async () => {
    const data = { name: form.elements.name.value, url: form.elements.url.value, enabled: form.elements.enabled.checked,
      events: Array.from(form.querySelectorAll("[name=events]:checked"), el => el.value), ...(editing ? { revision: editing.revision } : {}) };
    const result = await api("webhooks" + (editing ? "/" + editing.id : ""), editing ? "PUT" : "POST", data);
    $("hook-editor").hidden = true; editing = null; await loadHooks(); showSecret(result.secret); status(window.KuttI18n.t("ui.webhook_saved"));
  }, true); });
  form.addEventListener("input", () => { if (validationError) clearFormError(); });
  $("hook-new").onclick = () => editor(null);
  $("hook-cancel").onclick = () => { $("hook-editor").hidden = true; editing = null; clearFormError(); if (editorOpener?.isConnected) editorOpener.focus(); };
  $("hooks-reload").onclick = () => action(async () => { hideSecret(); clearFormError(); $("hook-editor").hidden = true; editing = null; await loadHooks(); const result = await api("events"); $("events-list").replaceChildren(); result.data.forEach(event); after = result.cursor; connect(); status(window.KuttI18n.t("ui.integrations_loaded")); });
  $("hook-secret-hide").onclick = hideSecret;
  $("hook-secret-copy").onclick = copySecret;
  $("deliveries-reload").onclick = () => action(() => loadDeliveries());
  $("deliveries-older").onclick = () => action(() => loadDeliveries(older));
  $("events-live").onchange = connect;
  document.addEventListener("visibilitychange", connect);
  window.addEventListener("pagehide", () => { source?.close(); hideSecret(); });
  $("hooks-reload").click();
})();
