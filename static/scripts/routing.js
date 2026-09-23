(() => {
  const root = document.querySelector(".routing-page");
  if (!root) return;
  const list = document.getElementById("routing-rules"), status = document.getElementById("routing-status");
  const endpoint = "/api/links/" + root.dataset.linkId + "/routing";
  const form = document.getElementById("routing-form");
  let revision = null, dirty = false;
  const setStatus = (text, error = false) => { status.textContent = text; status.classList.toggle("error", error); };
  const clone = id => document.getElementById(id).content.firstElementChild.cloneNode(true);
  const get = (node, field) => node.querySelector(`[data-field="${field}"]`);
  async function api(path, method = "GET", body) {
    const response = await fetch(endpoint + path, { method, credentials: "same-origin", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
    return window.KuttResponses.read(response, path ? window.KuttResponses.preview : value =>
      window.KuttResponses.routing(value) && (method !== "PUT" || value.revision === body.revision + 1));
  }
  function refresh() {
    [...list.children].forEach((rule, index) => {
      rule.querySelector("h2").textContent = window.KuttI18n.t("routing.rule_number", { number: window.KuttI18n.number(index + 1) });
      rule.querySelector('[data-action="up"]').disabled = index === 0;
      rule.querySelector('[data-action="down"]').disabled = index === list.children.length - 1;
      rule.querySelector('[data-action="add-condition"]').disabled = rule.querySelectorAll(".routing-condition").length >= 17;
    });
    document.getElementById("routing-add").disabled = revision === null || list.children.length >= 20;
  }
  function conditionFields(row) {
    const kind = get(row, "kind").value;
    for (const part of row.querySelectorAll("[data-part]")) {
      part.hidden = !(part.dataset.part === "device" ? kind === "devices" : part.dataset.part === "values" ? ["languages", "countries"].includes(kind) :
        part.dataset.part === "value" ? kind === "query" && get(row, "op").value === "equals" : kind === "query");
    }
    get(row, "values").placeholder = kind === "languages" ? "fr, en-GB" : "FR, BE";
  }
  function addCondition(rule, kind = "devices", value = "mobile") {
    const row = clone("routing-condition-template"); get(row, "kind").value = kind;
    if (kind === "devices") get(row, "device").value = value;
    else if (kind === "query") for (const key of ["key", "op", "value"]) get(row, key).value = value[key] || "";
    else get(row, "values").value = value.join(", ");
    conditionFields(row); rule.querySelector(".routing-conditions").append(row);
  }
  function addRule(value = { name: "", target: "", conditions: { devices: ["mobile"] } }) {
    const row = clone("routing-rule-template");
    for (const key of ["name", "target"]) get(row, key).value = value[key];
    for (const [kind, values] of Object.entries(value.conditions)) {
      if (["devices", "query"].includes(kind)) for (const value of values) addCondition(row, kind, value);
      else addCondition(row, kind, values);
    }
    list.append(row); refresh(); return row;
  }
  function rules() {
    return [...list.children].map(row => {
      const conditions = {};
      for (const item of row.querySelectorAll(".routing-condition")) {
        const kind = get(item, "kind").value;
        if (!conditions[kind]) conditions[kind] = [];
        if (kind === "query") conditions.query.push({ key: get(item, "key").value, op: get(item, "op").value,
          ...(get(item, "op").value === "equals" && { value: get(item, "value").value }) });
        else if (kind === "devices") conditions.devices.push(get(item, "device").value);
        else conditions[kind].push(...get(item, "values").value.split(",").map(value => kind === "countries" ? value.trim().toUpperCase() : value.trim()));
      }
      return { name: get(row, "name").value, target: get(row, "target").value, conditions };
    });
  }
  async function load() {
    try {
      const data = await api(""); revision = data.revision; list.replaceChildren();
      data.rules.forEach(addRule); dirty = false; refresh();
      document.getElementById("routing-save").disabled = false; document.getElementById("routing-test").disabled = false;
      setStatus(data.rules.length ? window.KuttI18n.t("ui.saved_rules") : window.KuttI18n.t("ui.no_routing_rules"));
    } catch (error) { setStatus(window.KuttI18n.failure(error), true); }
  }
  root.addEventListener("change", event => { if (event.target.closest(".routing-condition")) conditionFields(event.target.closest(".routing-condition")); });
  form.addEventListener("input", () => { dirty = true; setStatus(window.KuttI18n.t("ui.unsaved_changes")); });
  root.addEventListener("click", event => {
    const button = event.target.closest("[data-action]"); if (!button) return;
    const row = button.closest(".routing-rule"), action = button.dataset.action;
    if (action === "up" && row.previousElementSibling) list.insertBefore(row, row.previousElementSibling);
    if (action === "down" && row.nextElementSibling) list.insertBefore(row.nextElementSibling, row);
    if (action === "remove") row.remove();
    if (action === "add-condition") addCondition(row);
    if (action === "remove-condition") button.closest(".routing-condition").remove();
    dirty = true; refresh(); setStatus(window.KuttI18n.t("ui.unsaved_changes"));
  });
  document.getElementById("routing-add").addEventListener("click", () => { addRule().querySelector("input").focus(); dirty = true; setStatus(window.KuttI18n.t("ui.unsaved_changes")); });
  document.getElementById("routing-reload").addEventListener("click", () => { if (!dirty || confirm(window.KuttI18n.t("ui.discard_unsaved_rules_and_reload"))) load(); });
  form.addEventListener("submit", async event => {
    const focus = window.KuttFocus.capture();
    event.preventDefault(); const button = document.getElementById("routing-save"); button.disabled = true;
    const submitted = rules(), serialized = JSON.stringify(submitted);
    try {
      const data = await api("", "PUT", { revision, rules: submitted }); revision = data.revision;
      dirty = JSON.stringify(rules()) !== serialized; setStatus(dirty ? window.KuttI18n.t("ui.new_unsaved_changes") : window.KuttI18n.t("ui.rules_saved"));
    } catch (error) { setStatus(window.KuttI18n.failure(error), true); }
    finally { button.disabled = false; window.KuttFocus.restore(focus); }
  });
  document.getElementById("routing-preview-form").addEventListener("submit", async event => {
    const focus = window.KuttFocus.capture();
    event.preventDefault(); const output = document.getElementById("routing-result"), button = document.getElementById("routing-test"); button.disabled = true;
    try {
      const context = Object.fromEntries(new FormData(event.target)); context.country = context.country.toUpperCase();
      const result = await api("/preview", "POST", { rules: rules(), context });
      output.textContent = (result.rule_index === null ? window.KuttI18n.t("ui.default_destination") : window.KuttI18n.t("routing.rule_number", { number: window.KuttI18n.number(result.rule_index + 1) }) + ": " + result.rule_name) + "\n" + result.target;
    } catch (error) { output.textContent = window.KuttI18n.failure(error); }
    finally { button.disabled = false; window.KuttFocus.restore(focus); }
  });
  window.addEventListener("beforeunload", event => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
  load();
})();
