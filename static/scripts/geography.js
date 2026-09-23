(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.KuttGeography = factory();
})(typeof globalThis === "object" ? globalThis : this, function () {
  "use strict";
  function summarize(rows, total, codes) {
    const counts = new Map();
    let sum = 0, unmapped = 0;
    for (const row of rows) {
      if (typeof row.name !== "string" || !Number.isSafeInteger(row.visits) || row.visits < 0) throw new TypeError("Invalid country aggregate");
      const code = row.name.toUpperCase();
      sum += row.visits;
      if (!Number.isSafeInteger(sum)) throw new TypeError("Country aggregate exceeds supported range");
      if (codes.has(code)) counts.set(code, (counts.get(code) || 0) + row.visits);
      else unmapped += row.visits;
    }
    // Legacy country totals need not reconcile with tracked visits. Never invent a denominator.
    const shares = Number.isSafeInteger(total) && total > 0 && Number.isSafeInteger(sum) && sum <= total;
    const max = Math.max(0, ...counts.values());
    const limits = [...new Set([Math.ceil(max / 3), Math.ceil(max * 2 / 3), max])].filter(n => n > 0);
    return { counts, unmapped, limits, level: count => count ? limits.findIndex(limit => count <= limit) + 1 : 0,
      share: count => shares && count <= total ? count / total : null };
  }
  function create(container, i18n) {
    const document = container.ownerDocument, svg = container.querySelector("svg"), select = container.querySelector("select");
    const details = container.querySelector("#geography-details"), legend = container.querySelector(".geography-legend");
    const paths = new Map([...svg.querySelectorAll("[data-country]")].map(node => [node.dataset.country.toUpperCase(), node]));
    const codes = new Set(paths.keys()), names = new Map([...codes].map(code => [code, i18n.region(code)]));
    const collator = new Intl.Collator(i18n.locale);
    const order = [...codes].sort((a, b) => collator.compare(names.get(a), names.get(b)) || a.localeCompare(b));
    let model = summarize([], 0, codes), selected = "", active = order[0];
    const element = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
    const share = count => {
      const value = model.share(count);
      return value === null ? i18n.t("geography.share_unavailable") : i18n.number(value, { style: "percent", maximumFractionDigits: 1 });
    };
    const description = code => i18n.t("geography.details", { country: names.get(code), count: model.counts.get(code) || 0,
      visits: i18n.number(model.counts.get(code) || 0), share: share(model.counts.get(code) || 0) });
    const show = code => {
      const preview = paths.has(code) ? code : "";
      details.textContent = preview ? description(preview) : i18n.t("geography.none_selected");
      for (const [id, node] of paths) node.classList.toggle("geography-preview", id === preview);
    };
    const rove = code => {
      active = code;
      for (const [id, node] of paths) node.setAttribute("tabindex", id === active ? "0" : "-1");
    };
    const choose = code => {
      selected = paths.has(code) ? code : ""; select.value = selected;
      if (selected) rove(selected);
      for (const [id, node] of paths) node.setAttribute("aria-pressed", String(id === selected));
      show(selected);
    };
    select.append(element("option", i18n.t("geography.none_selected"))); select.firstChild.value = "";
    for (const code of order) { const option = element("option", names.get(code)); option.value = code; select.append(option); }
    select.addEventListener("change", () => choose(select.value));
    for (const [code, node] of paths) {
      node.addEventListener("pointerenter", () => show(code));
      node.addEventListener("focus", () => { rove(code); show(code); });
      node.addEventListener("click", () => choose(code));
      node.addEventListener("keydown", event => {
        if (["Enter", " ", "Escape"].includes(event.key)) {
          event.preventDefault(); choose(event.key === "Escape" ? "" : code); return;
        }
        const delta = ({ ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 })[event.key];
        if (delta || ["Home", "End"].includes(event.key)) {
          event.preventDefault();
          const index = event.key === "Home" ? 0 : event.key === "End" ? order.length - 1 : (order.indexOf(code) + delta + order.length) % order.length;
          paths.get(order[index]).focus();
        }
      });
    }
    svg.addEventListener("pointerleave", () => show([...paths].find(([, node]) => node === document.activeElement)?.[0] || selected));
    svg.addEventListener("focusout", event => { if (!svg.contains(event.relatedTarget)) show(selected); });
    function update(rows, total) {
      model = summarize(rows, total, codes);
      for (const [code, node] of paths) {
        const count = model.counts.get(code) || 0;
        node.dataset.level = model.level(count);
        node.setAttribute("aria-label", description(code));
      }
      legend.replaceChildren();
      let start = 1;
      for (const [index, limit] of [0, ...model.limits].entries()) {
        const label = index === 0 ? i18n.t("geography.no_recorded_visits") : start === limit ? i18n.number(limit) : i18n.t("geography.range", { from: i18n.number(start), to: i18n.number(limit) });
        const item = element("li"), swatch = element("span");
        swatch.dataset.level = index; swatch.setAttribute("aria-hidden", "true"); item.append(swatch, document.createTextNode(label)); legend.append(item);
        if (index) start = limit + 1;
      }
      container.querySelector("#geography-unmapped").textContent = i18n.t("geography.unmapped", { count: model.unmapped, visits: i18n.number(model.unmapped) });
      rove(selected || active); choose(selected);
    }
    return { update, share };
  }
  return Object.freeze({ summarize, create });
});
