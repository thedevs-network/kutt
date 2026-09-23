(() => {
  const root = document.querySelector(".privacy-page"), status = document.querySelector("#privacy-status");
  if (!root) return;
  const retention = root.dataset.retention === "true";
  const endpoint = retention ? "/api/analytics/retention" : "/api/links/" + encodeURIComponent(root.dataset.link) + "/tracking";
  const form = document.querySelector(retention ? "#retention-form" : "#tracking-form");
  let revision = 0, confirmation = null, previewDays = 0, busy = false;
  const message = (text, error = false) => { status.textContent = text; status.classList.toggle("error", error); };
  async function api(path, method = "GET", body) {
    const response = await fetch(path, { method, cache: "no-store", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const schema = retention ? path.endsWith("/preview") ? window.KuttResponses.retentionPreview : window.KuttResponses.retention : window.KuttResponses.tracking;
    return window.KuttResponses.read(response, data => schema(data) &&
      (method !== "PUT" || data.revision === revision + 1 && (retention ? data.days === previewDays : data.enabled === body.enabled)) &&
      (method !== "POST" || data.revision === revision && data.days === body.days));
  }
  function resetPreview() {
    confirmation = null;
    if (!retention) return;
    document.querySelector("#retention-preview").hidden = true;
    document.querySelector("#retention-ack").checked = false;
    const enabled = form.elements.mode.value === "expire";
    document.querySelector("#retention-days-label").hidden = !enabled;
    form.elements.days.disabled = !enabled || busy;
  }
  async function work(action) {
    if (busy) return; busy = true;
    const controls = [...root.querySelectorAll("button, input")]; controls.forEach(control => { control.disabled = true; });
    try { await action(); } catch (error) { resetPreview(); message(window.KuttI18n.failure(error), true); }
    finally {
      busy = false; controls.forEach(control => { control.disabled = false; });
      if (retention) form.elements.days.disabled = form.elements.mode.value !== "expire";
    }
  }
  function render(data, saved) {
    resetPreview(); revision = data.revision;
    if (retention) {
      form.elements.mode.value = data.days ? "expire" : "keep"; form.elements.days.value = data.days || 365; resetPreview();
      document.querySelector("#retention-last").textContent = data.last_run ? window.KuttI18n.date(new Date(data.last_run)) : window.KuttI18n.t("ui.not_run");
      document.querySelector("#retention-deleted").textContent = window.KuttI18n.number(data.deleted_buckets);
      document.querySelector("#retention-error").textContent = data.last_error || (data.days ? window.KuttI18n.t("messages.scheduled") : window.KuttI18n.t("ui.disabled"));
      document.querySelector("#retention-state").hidden = false;
    } else document.querySelector("#tracking-enabled").checked = data.enabled;
    form.hidden = false; message(saved || window.KuttI18n.t("ui.settings_loaded"));
  }
  async function load() { render(await api(endpoint)); }
  document.querySelector("#privacy-reload").onclick = () => work(() => load());
  if (retention) {
    form.addEventListener("input", () => {
      resetPreview(); message(window.KuttI18n.t("ui.draft_changed_preview_again_before_applying"));
    });
    form.onsubmit = event => { event.preventDefault(); work(async () => {
      const data = await api(endpoint + "/preview", "POST", { days: form.elements.mode.value === "keep" ? 0 : Number(form.elements.days.value), revision });
      confirmation = data.confirmation; previewDays = data.days;
      document.querySelector("#retention-cutoff").textContent = data.cutoff ? window.KuttI18n.t("privacy.cutoff", { date: window.KuttI18n.date(data.cutoff, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) }) : window.KuttI18n.t("ui.keep_all_analytics");
      document.querySelector("#retention-count").textContent = window.KuttI18n.t("privacy.eligible_buckets", { count: data.eligible_buckets });
      document.querySelector("#retention-ack-label").hidden = !data.days;
      document.querySelector("#retention-preview").hidden = false; message(window.KuttI18n.t("ui.preview_ready"));
    }); };
    document.querySelector("#retention-save").onclick = () => work(async () => {
      if (!confirmation) throw new Error(window.KuttI18n.t("ui.preview_changes_first"));
      if (previewDays && !document.querySelector("#retention-ack").checked) throw new Error(window.KuttI18n.t("ui.acknowledge_permanent_deletion_before_applying_retention"));
      const data = await api(endpoint, "PUT", { confirmation, acknowledge_deletion: document.querySelector("#retention-ack").checked });
      render(data, window.KuttI18n.t("ui.retention_saved"));
    });
  } else form.onsubmit = event => { event.preventDefault(); work(async () => {
    const data = await api(endpoint, "PUT", { enabled: document.querySelector("#tracking-enabled").checked, revision }); render(data, window.KuttI18n.t("ui.tracking_saved"));
  }); };
  work(() => load());
})();
