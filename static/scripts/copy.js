const copyStates = new WeakMap();

async function handleShortURLCopyLink(element) {
  const host = element.closest("[data-copy-container]");
  if (!host || !host.isConnected || typeof element.dataset.url !== "string") return;
  let state = copyStates.get(host);
  if (state?.pending) return;
  if (!state) {
    const feedback = document.createElement("div");
    feedback.className = "copy-feedback";
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    status.setAttribute("aria-atomic", "true");
    const fallback = document.createElement("label");
    fallback.textContent = window.KuttI18n.t("ui.value_to_copy");
    fallback.hidden = true;
    const input = document.createElement("input");
    input.type = "text";
    input.readOnly = true;
    input.autocomplete = "off";
    input.spellcheck = false;
    fallback.append(input);
    feedback.append(status, fallback);
    host.append(feedback);
    state = { status, fallback, input, pending: false };
    copyStates.set(host, state);
  }
  state.pending = true;
  state.status.className = "";
  state.status.textContent = window.KuttI18n.t("ui.copying");
  state.fallback.hidden = true;
  state.input.value = "";
  host.setAttribute("aria-busy", "true");
  const clipboard = host.querySelector(".clipboard");
  clipboard?.classList.remove("copied");
  try {
    if (!navigator.clipboard?.writeText) throw new Error(window.KuttI18n.t("ui.clipboard_unavailable"));
    await navigator.clipboard.writeText(element.dataset.url);
    if (!host.isConnected) return;
    state.status.textContent = window.KuttI18n.t("ui.copied");
    clipboard?.classList.add("copied");
  } catch {
    if (!host.isConnected) return;
    state.status.className = "copy-error";
    state.status.textContent = window.KuttI18n.t("ui.copy_failed_select_and_copy_the_value_below");
    state.input.value = element.dataset.url;
    state.fallback.hidden = false;
    // Do not pull focus back if the user has moved to another control.
    if (document.activeElement === element || document.activeElement === document.body) {
      state.input.focus();
      state.input.select();
    }
  } finally {
    state.pending = false;
    host.removeAttribute("aria-busy");
  }
}
