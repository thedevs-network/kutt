(() => {
  "use strict";
  const page = document.querySelector(".forwarding-page");
  if (!page) return;
  const form = document.querySelector("#forwarding-form"), preview = document.querySelector("#forwarding-preview");
  const status = document.querySelector("#forwarding-status"), output = document.querySelector("#forwarding-result");
  const api = "/api/v2/links/" + encodeURIComponent(page.dataset.linkId) + "/forwarding";
  let revision = null, busy = false;
  const message = (text, error = false) => { status.textContent = text; status.classList.toggle("error", error); };
  function lock(value) {
    busy = value;
    form.querySelectorAll("button, textarea").forEach(element => { element.disabled = value || (revision === null && element.id !== "forwarding-reload"); });
    document.querySelector("#forwarding-test").disabled = value || revision === null;
  }
  function policy() {
    return Object.fromEntries(["query_keys", "path_prefixes"].map(key => [key, form.elements[key].value.split(/\r?\n/).map(line => line.trim()).filter(Boolean)]));
  }
  async function request(method, suffix = "", body) {
    const response = await fetch(api + suffix, { method, credentials: "same-origin", headers: { Accept: "application/json", "Content-Type": "application/json" }, ...(body && { body: JSON.stringify(body) }) });
    return window.KuttResponses.read(response, suffix ? window.KuttResponses.preview : value =>
      window.KuttResponses.forwarding(value) && (method !== "PUT" || value.revision === body.revision + 1),
    window.KuttI18n.t("ui.changed_elsewhere_reload_saved_allowlists_before_saving"));
  }
  async function load() {
    if (busy) return;
    const focus = window.KuttFocus.capture();
    lock(true); message(window.KuttI18n.t("ui.loading"));
    try {
      const data = await request("GET"); revision = data.revision;
      for (const key of ["query_keys", "path_prefixes"]) form.elements[key].value = data[key].join("\n");
      output.textContent = ""; message(window.KuttI18n.t("ui.saved_allowlists_loaded"));
    } catch (error) { message(window.KuttI18n.failure(error), true); }
    finally { lock(false); window.KuttFocus.restore(focus); }
  }
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || revision === null) return;
    const focus = window.KuttFocus.capture();
    const draft = policy(); lock(true); message(window.KuttI18n.t("ui.saving"));
    try { const data = await request("PUT", "", { ...draft, revision }); revision = data.revision; message(window.KuttI18n.t("ui.allowlists_saved")); }
    catch (error) { message(window.KuttI18n.failure(error), true); }
    finally { lock(false); window.KuttFocus.restore(focus); }
  });
  document.querySelector("#forwarding-reload").addEventListener("click", load);
  document.querySelector("#forwarding-clear").addEventListener("click", () => {
    for (const key of ["query_keys", "path_prefixes"]) form.elements[key].value = "";
    output.textContent = ""; message(window.KuttI18n.t("ui.allowlists_cleared_in_this_draft_not_saved"));
  });
  preview.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || revision === null) return;
    const focus = window.KuttFocus.capture();
    const values = Object.fromEntries(new FormData(preview)), suffix = values.path; delete values.path;
    const draft = policy(); lock(true); output.classList.remove("error"); output.textContent = window.KuttI18n.t("ui.checking");
    try {
      const result = await request("POST", "/preview", { policy: draft, context: values, path: suffix });
      output.textContent = (result.rule_name ? result.rule_name : window.KuttI18n.t("ui.default_destination")) + ": " + result.target;
    } catch (error) { output.classList.add("error"); output.textContent = window.KuttI18n.failure(error); }
    finally { lock(false); window.KuttFocus.restore(focus); }
  });
  load();
})();
