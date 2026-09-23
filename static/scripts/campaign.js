(() => {
  "use strict";
  const core = window.KuttCampaign;
  function load(widget) {
    const target = widget.closest("form")?.querySelector('[name="target"]');
    if (!target) return;
    widget.dataset.campaignTarget = target.value;
    const output = widget.querySelector("output");
    try {
      const values = core.read(target.value);
      widget.querySelectorAll("[data-campaign-field]").forEach(input => { input.value = values[input.dataset.campaignField]; });
      output.textContent = "";
    } catch (error) { output.textContent = window.KuttI18n.failure(error); }
  }
  document.addEventListener("toggle", event => {
    const widget = event.target;
    if (widget.matches?.("[data-campaign]") && widget.open && widget.dataset.campaignTarget !== widget.closest("form")?.querySelector('[name="target"]')?.value) load(widget);
  }, true);
  document.addEventListener("input", event => {
    if (!event.target.matches('[name="target"]')) return;
    event.target.closest("form")?.querySelectorAll("[data-campaign][open]").forEach(load);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Enter" && event.target.matches("[data-campaign-field]")) {
      event.preventDefault();
      event.target.closest("[data-campaign]").querySelector("[data-campaign-apply]").click();
    }
  });
  document.addEventListener("click", event => {
    // Native toggle events are queued; initialize before a fast user can type.
    const summary = event.target.closest("[data-campaign] > summary");
    if (summary && !summary.parentElement.open) load(summary.parentElement);
    const button = event.target.closest("[data-campaign-apply], [data-campaign-clear]");
    if (!button) return;
    const widget = button.closest("[data-campaign]"), target = widget.closest("form").querySelector('[name="target"]');
    const output = widget.querySelector("output"), clear = button.hasAttribute("data-campaign-clear");
    try {
      const values = Object.fromEntries([...widget.querySelectorAll("[data-campaign-field]")].map(input => [input.dataset.campaignField, clear ? "" : input.value]));
      target.value = core.apply(target.value, values);
      target.dispatchEvent(new Event("input", { bubbles: true }));
      output.textContent = clear ? window.KuttI18n.t("ui.campaign_parameters_removed_from_destination_changes_not_saved_yet") : window.KuttI18n.t("ui.campaign_parameters_applied_to_destination_changes_not_saved_yet");
    } catch (error) { output.textContent = window.KuttI18n.failure(error); }
  });
})();
