(() => {
  const error = document.querySelector(".workspace-edit-error");
  if (error) error.focus();
  else if (location.hash.startsWith("#workspace-edit-")) {
    const editor = document.getElementById(location.hash.slice(1));
    if (editor?.matches("details.workspace-edit")) editor.open = true;
  }
  document.querySelectorAll(".workspaces form").forEach(form => form.addEventListener("submit", event => {
    const message = event.submitter?.dataset.confirm;
    if (message && !window.confirm(message)) event.preventDefault();
  }));
  document.querySelectorAll(".workspaces [data-copy]").forEach(button => button.addEventListener("click", async () => {
    const notice = document.getElementById("workspace-notice");
    try { await navigator.clipboard.writeText(button.dataset.copy); notice.textContent = window.KuttI18n.t("ui.short_link_copied"); }
    catch { notice.textContent = window.KuttI18n.t("ui.copy_failed_select_and_copy_the_short_link"); }
  }));
})();
