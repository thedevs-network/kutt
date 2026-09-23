(() => {
  "use strict";
  const form = document.querySelector("#shortcut-form"); if (!form) return;
  const message = document.querySelector("#shortcut-message"), create = document.querySelector("#shortcut-create"),
    section = document.querySelector("#shortcut-secret"), token = document.querySelector("#shortcut-token"),
    copy = document.querySelector("#shortcut-copy-token"), reveal = document.querySelector("#shortcut-reveal"), hide = document.querySelector("#shortcut-hide"), revoke = document.querySelector("#shortcut-revoke");
  let id = null, busy = false, generation = 0;
  const show = (text, error = false) => { message.textContent = text; message.classList.toggle("error", error); };
  function clear() { token.value = ""; token.type = "password"; reveal.setAttribute("aria-pressed", "false"); reveal.title = window.KuttI18n.t("ui.show_api_token"); reveal.setAttribute("aria-label", reveal.title); copy.disabled = hide.disabled = reveal.disabled = true; }
  reveal.addEventListener("click", () => { const shown = token.type === "password"; token.type = shown ? "text" : "password"; reveal.setAttribute("aria-pressed", String(shown)); reveal.title = shown ? window.KuttI18n.t("ui.mask_api_token") : window.KuttI18n.t("ui.show_api_token"); reveal.setAttribute("aria-label", reveal.title); });
  async function copyValue(value, label) {
    let timer;
    try { await Promise.race([navigator.clipboard.writeText(value), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(window.KuttI18n.t("ui.clipboard_timeout"))), 3000); })]); show(window.KuttI18n.t("copy.named", { name: label })); }
    catch { show(window.KuttI18n.t("ui.clipboard_unavailable_select_and_copy_the_field_manually"), true); }
    finally { clearTimeout(timer); }
  }
  document.querySelector("#shortcut-copy-endpoint").addEventListener("click", () => copyValue(document.querySelector("#shortcut-endpoint").value, window.KuttI18n.t("ui.endpoint")));
  copy.addEventListener("click", () => { if (token.value) void copyValue(token.value, window.KuttI18n.t("ui.token")); });
  hide.addEventListener("click", () => { clear(); create.disabled = false; show(window.KuttI18n.t("ui.credential_hidden_it_cannot_be_displayed_again_revoke_it_if_it")); });
  window.addEventListener("pagehide", () => { generation++; clear(); });
  window.addEventListener("pageshow", () => { if (!token.value) create.disabled = busy; });
  form.addEventListener("submit", async event => {
    event.preventDefault(); if (busy || token.value) return;
    const requestGeneration = generation;
    busy = true; create.disabled = true; show(window.KuttI18n.t("ui.creating"));
    try {
      const response = await fetch("/api/v2/shortcuts/token", { method: "POST", credentials: "same-origin",
        headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify({ name: form.elements.name.value }) });
      const result = await response.json().catch(() => ({}));
      // Never restore a one-time secret after navigating away, including BFCache.
      if (requestGeneration !== generation) return;
      if (!response.ok) throw new Error(result.error || window.KuttI18n.t("ui.request_failed_check_api_tokens_in_settings_before_retrying"));
      if (!result.id || !result.token) throw new Error(window.KuttI18n.t("ui.unexpected_response_check_api_tokens_in_settings_before_retrying"));
      id = result.id; token.value = result.token; section.hidden = false; copy.disabled = hide.disabled = revoke.disabled = reveal.disabled = false;
      document.querySelector("#shortcut-expiry").textContent = window.KuttI18n.t("common.expires_at", { date: window.KuttI18n.date(result.expires_at) });
      show(window.KuttI18n.t("ui.token_created_store_it_only_in_your_private_shortcut")); token.focus();
    } catch (error) { show(window.KuttI18n.failure(error), true); }
    finally { busy = false; create.disabled = Boolean(token.value); }
  });
  revoke.addEventListener("click", async () => {
    if (busy || !id) return; busy = true; revoke.disabled = create.disabled = true;
    try {
      const response = await fetch("/api/v2/tokens/" + encodeURIComponent(id), { method: "DELETE", credentials: "same-origin", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(window.KuttI18n.t("ui.revocation_failed_retry_or_revoke_in_settings"));
      clear(); id = null; section.hidden = true; show(window.KuttI18n.t("ui.token_revoked"));
    } catch (error) { show(window.KuttI18n.failure(error), true); }
    finally { busy = false; revoke.disabled = !id; create.disabled = Boolean(token.value); }
  });
  clear(); create.disabled = false;
  document.querySelector("#shortcut-copy-endpoint").disabled = false;
})();
