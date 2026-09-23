(() => {
  const form = document.querySelector("#transfer-import"), status = document.querySelector("#transfer-status");
  const preview = document.querySelector("#transfer-preview"), commit = document.querySelector("#transfer-commit");
  let pending = null, busy = false;
  const message = (text, error = false) => { status.textContent = text; status.classList.toggle("transfer-error", error); };
  const invalidate = () => { pending = null; commit.disabled = true; preview.hidden = true; };
  const edited = event => {
    // The file reader owns its status; the bubbling change must not erase a load error.
    if (event.target.id === "transfer-file") return;
    invalidate(); form.elements.content.removeAttribute("aria-invalid");
    message(window.KuttI18n.t("ui.draft_changed_run_a_new_dry_run_before_confirming"));
  };
  form.addEventListener("input", edited); form.addEventListener("change", edited);
  const lock = value => { busy = value; for (const control of form.elements) control.disabled = value; commit.disabled = value || !pending; };
  const api = async (path, payload) => {
    const response = await fetch("/api/v2/transfer/" + path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload) });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw Object.assign(new Error(result?.error || window.KuttI18n.t("ui.request_failed_value", {value1: response.status})), { status: response.status });
    return result;
  };
  document.querySelector("#transfer-file").addEventListener("change", async event => {
    const file = event.target.files[0]; if (!file) return;
    invalidate();
    try {
      if (file.size > 900000) throw new Error(window.KuttI18n.t("ui.file_exceeds_900_kb_split_it_into_smaller_batches"));
      const content = await file.text();
      form.elements.format.value = file.name.toLowerCase().endsWith(".csv") ? "csv" : "json";
      form.elements.content.value = content; form.elements.content.removeAttribute("aria-invalid"); message("");
    } catch (error) { message(window.KuttI18n.failure(error) + " " + window.KuttI18n.t("ui.current_content_was_not_replaced"), true); }
  });
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy) return;
    let error = false, invalidContent = false, moved = false;
    const observe = event => { if (event.target !== document.body && !form.contains(event.target)) moved = true; };
    document.addEventListener("focusin", observe);
    const payload = Object.fromEntries(new FormData(form));
    invalidate(); lock(true); message(window.KuttI18n.t("ui.validating_import"));
    try {
      const result = await api("preview", payload), body = document.querySelector("#transfer-rows"); body.replaceChildren();
      for (const row of result.rows) {
        const tr = document.createElement("tr");
        for (const [index, value] of [row.row, row.address || "", row.domain || "", window.KuttI18n.label("action", row.action), row.message || ""].entries()) {
          const td = document.createElement("td"); td.dataset.label = [window.KuttI18n.t("ui.row"), window.KuttI18n.t("ui.alias"), window.KuttI18n.t("ui.domain"), window.KuttI18n.t("ui.action"), window.KuttI18n.t("ui.issue")][index]; td.textContent = String(value); tr.append(td);
        }
        body.append(tr);
      }
      document.querySelector("#transfer-counts").textContent = window.KuttI18n.t("ui.value_new_value_skipped_value_errors", {value1: result.rows.filter(row => row.action === "create").length, value2: result.rows.filter(row => row.action === "skip").length, value3: result.rows.filter(row => row.action === "error").length});
      preview.hidden = false; pending = result.valid ? { ...payload, preview_token: result.preview_token } : null;
      error = invalidContent = !result.valid;
      message(result.valid ? window.KuttI18n.t("ui.dry_run_complete_no_links_were_changed_confirmation_expires_in_20") : window.KuttI18n.t("ui.correct_the_reported_errors_and_run_a_new_dry_run"), !result.valid);
    } catch (failure) { error = true; invalidContent = failure.status === 400; message(window.KuttI18n.failure(failure), true); }
    finally {
      lock(false); document.removeEventListener("focusin", observe);
      if (invalidContent) form.elements.content.setAttribute("aria-invalid", "true");
      else form.elements.content.removeAttribute("aria-invalid");
      if (error && !moved) status.focus();
    }
  });
  commit.addEventListener("click", async () => {
    if (busy || !pending) return;
    lock(true); message(window.KuttI18n.t("ui.importing"));
    try {
      const result = await api("commit", pending); pending = null;
      message(window.KuttI18n.t("ui.import_complete_value_created_value_skipped_value", {value1: window.KuttI18n.number(result.created.length), value2: window.KuttI18n.number(result.skipped), value3: result.replayed ? window.KuttI18n.t("transfer.verified_retry") : ""}));
    } catch (error) { message(window.KuttI18n.failure(error) + " " + window.KuttI18n.t("ui.retry_confirmation_after_a_connection_error_run_a_new_dry_run"), true); }
    finally { lock(false); }
  });
  document.querySelector("#transfer-export").addEventListener("submit", async event => {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector("button"); button.disabled = true;
    try {
      const params = new URLSearchParams(new FormData(form));
      const response = await fetch("/api/v2/transfer/export?" + params, { credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) { const error = await response.json().catch(() => null); throw new Error(error?.error || window.KuttI18n.t("ui.export_failed_value", {value1: response.status})); }
      const url = URL.createObjectURL(await response.blob()), link = document.createElement("a");
      link.href = url; link.download = "kutt-links." + params.get("format"); link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); message(window.KuttI18n.t("ui.export_downloaded"));
    } catch (error) { message(window.KuttI18n.failure(error), true); }
    finally { button.disabled = false; }
  });
  form.querySelector("button[type=submit]").disabled = false;
})();
