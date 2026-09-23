(() => {
  const form = document.getElementById("library-bulk");
  if (!form) return;
  const boxes = [...form.querySelectorAll('input[name="ids"]:not(:disabled)')];
  const all = document.getElementById("library-select-all");
  const action = document.getElementById("library-action");
  let submitting = false;
  function update() {
    const count = boxes.filter(box => box.checked).length;
    all.disabled = !boxes.length;
    all.checked = !!count && count === boxes.length;
    all.indeterminate = count > 0 && count < boxes.length;
    document.getElementById("library-selection").textContent = window.KuttI18n.t("library.selected", {count});
    document.getElementById("library-apply").disabled = submitting || !count;
    const labels = action.value.endsWith("label");
    const field = document.getElementById("library-label-field");
    field.hidden = !labels;
    field.querySelector("select").required = labels;
  }
  all.addEventListener("change", () => { for (const box of boxes) box.checked = all.checked; update(); });
  form.addEventListener("change", update);
  form.addEventListener("submit", event => {
    if (action.value === "trash" && !window.confirm(window.KuttI18n.t("ui.move_the_selected_links_to_trash_their_short_links_will_stop"))) event.preventDefault();
  });
  document.querySelectorAll(".library form").forEach(item => item.addEventListener("submit", event => {
    const message = event.submitter?.dataset.confirm;
    if (message && !window.confirm(message)) event.preventDefault();
  }));
  form.addEventListener("submit", event => {
    if (event.defaultPrevented) return;
    if (submitting) { event.preventDefault(); return; }
    submitting = true;
    form.setAttribute("aria-busy", "true");
    document.getElementById("library-apply").disabled = true;
  });
  window.addEventListener("pageshow", () => { submitting = false; form.removeAttribute("aria-busy"); update(); });
  update();
})();
