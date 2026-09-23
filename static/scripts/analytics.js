(() => {
  const form = document.querySelector("#analytics-filters"), status = document.querySelector("#analytics-status");
  if (!form) return;
  const geographyRoot = document.querySelector("#analytics-geography");
  const geography = geographyRoot && window.KuttGeography ? window.KuttGeography.create(geographyRoot, window.KuttI18n) : null;
  let chart, controller, serial = 0;
  const element = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  const selectionMeasure = document.createElement("canvas").getContext("2d");
  function selectedValue(select) {
    const detail = document.getElementById(select.getAttribute("aria-describedby"));
    if (!detail) return;
    const text = select.value ? select.selectedOptions[0]?.textContent || "" : "";
    detail.textContent = text;
    const style = getComputedStyle(select);
    selectionMeasure.font = style.font;
    // Native selects cannot wrap; expose overflowing values without replacing their keyboard behavior.
    detail.hidden = !text || selectionMeasure.measureText(text).width <= select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  }
  const choices = [form.elements.domain, form.elements.tag];
  const updateSelections = () => choices.forEach(selectedValue);
  const selectionResize = new ResizeObserver(updateSelections);
  for (const select of choices) { select.addEventListener("change", () => selectedValue(select)); selectionResize.observe(select); }
  document.fonts.ready.then(updateSelections);
  function table(kind, rows, heading) {
    const container = document.querySelector('[data-table="' + kind + '"]'); container.replaceChildren();
    if (!rows.length) { container.append(element("p", window.KuttI18n.t("ui.no_visits"))); return; }
    let page = 0;
    const render = () => {
      const focus = window.KuttFocus.capture();
      container.replaceChildren();
      const table = element("table"), head = element("thead"), header = element("tr"), body = element("tbody");
      const headings = [heading, window.KuttI18n.t("ui.visits")];
      if (kind === "country" && geography) headings.push(window.KuttI18n.t("geography.share"));
      for (const title of headings) { const cell = element("th", title); cell.scope = "col"; header.append(cell); }
      head.append(header); table.append(head, body);
      for (const item of rows.slice(page * 20, (page + 1) * 20)) {
        const name = kind === "country" ? window.KuttI18n.region(item.name) : ["browser", "os", "referrer"].includes(kind) && ["other", "(other)", "Unknown", "Direct"].includes(item.name) ? window.KuttI18n.t(item.name === "Direct" ? "analytics.direct" : item.name === "Unknown" ? "ui.unknown" : "analytics.other") : item.name;
        const row = element("tr"); row.append(element("td", name), element("td", window.KuttI18n.number(Number(item.visits)))); body.append(row);
        if (kind === "country" && geography) row.append(element("td", geography.share(item.visits)));
      }
      container.append(table);
      if (rows.length > 20) {
        const nav = element("nav"), prev = element("button", window.KuttI18n.t("ui.previous")), next = element("button", window.KuttI18n.t("ui.next"));
        nav.className = "analytics-pagination"; nav.setAttribute("aria-label", window.KuttI18n.t("common.pages", { name: heading }));
        prev.type = next.type = "button"; prev.disabled = !page; next.disabled = (page + 1) * 20 >= rows.length;
        prev.id = "analytics-" + kind + "-previous"; next.id = "analytics-" + kind + "-next";
        prev.onclick = () => { page--; render(); }; next.onclick = () => { page++; render(); };
        nav.append(prev, element("span", (page + 1) + " / " + Math.ceil(rows.length / 20)), next); container.append(nav);
        window.KuttFocus.restore(focus, prev.disabled ? next : prev);
      } else {
        window.KuttFocus.restore(focus);
      }
    };
    render();
  }
  function options(name, rows, label, selected) {
    const select = form.elements[name]; select.replaceChildren(new Option(label, ""));
    for (const row of rows) select.add(new Option(row.name, row.id));
    select.value = selected;
    selectedValue(select);
  }
  async function load() {
    const focus = window.KuttFocus.capture();
    const current = ++serial;
    if (controller) controller.abort(); controller = new AbortController();
    const params = new URLSearchParams(new FormData(form));
    for (const [key, value] of [...params]) if (!value) params.delete(key);
    status.textContent = window.KuttI18n.t("ui.loading"); status.classList.remove("error");
    document.querySelector("#analytics-report").hidden = true;
    for (const format of ["json", "csv"]) document.querySelector("#analytics-" + format).removeAttribute("href");
    form.querySelector('button[type="submit"]').disabled = true;
    try {
      const response = await fetch("/api/analytics?" + params, { headers: { Accept: "application/json" }, signal: controller.signal, cache: "no-store" });
      const data = await window.KuttResponses.read(response, window.KuttResponses.analytics);
      if (current !== serial) return;
      document.querySelector("#analytics-report").classList.toggle("analytics-report-empty", data.total === 0);
      document.querySelector("#analytics-total").textContent = window.KuttI18n.number(data.total);
      document.querySelector("#analytics-links").textContent = window.KuttI18n.number(data.visited_links) + " / " + window.KuttI18n.number(data.matched_links);
      options("domain", data.available_filters.domains, window.KuttI18n.t("ui.all_domains"), data.filters.domain);
      options("tag", data.available_filters.tags, window.KuttI18n.t("ui.all_tags"), data.filters.tag);
      if (geography) geography.update(data.stats.country, data.total);
      table("days", data.by_day.map(row => ({ name: window.KuttI18n.date(row.date, { dateStyle: "medium", timeZone: "UTC" }), visits: row.visits })), window.KuttI18n.t("ui.date"));
      table("tags", data.tags, window.KuttI18n.t("ui.tag"));
      for (const kind of window.KuttResponses.dimensions) table(kind, data.stats[kind], ({ os: "OS", referrer: window.KuttI18n.t("ui.referrer"), browser: window.KuttI18n.t("ui.browser"), country: window.KuttI18n.t("ui.country") })[kind]);
      if (chart) chart.destroy();
      chart = new Chart(document.querySelector("#analytics-chart"), {
        type: "bar", data: { labels: data.by_day.map(row => window.KuttI18n.date(row.date, { dateStyle: "medium", timeZone: "UTC" })), datasets: [{ label: window.KuttI18n.t("ui.visits"), data: data.by_day.map(row => row.visits), backgroundColor: "#267ba2", borderColor: "#175470", borderWidth: 1 }] },
        options: { locale: window.KuttI18n.locale, responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxTicksLimit: 10 } } } }
      });
      for (const format of ["json", "csv"]) { const exportParams = new URLSearchParams(params); exportParams.set("format", format); document.querySelector("#analytics-" + format).href = "/api/analytics?" + exportParams; }
      document.querySelector("#analytics-updated").textContent = window.KuttI18n.t("common.updated_at", { date: window.KuttI18n.date(data.generated_at) });
      document.querySelector("#analytics-report").hidden = false;
      status.textContent = data.selected_link ? window.KuttI18n.t("analytics.link", { link: data.selected_link }) : data.total ? window.KuttI18n.t("ui.report_ready") : window.KuttI18n.t("ui.no_tracked_visits_in_this_range");
      history.replaceState(null, "", "/settings/analytics?" + params);
    } catch (error) {
      if (error.name !== "AbortError" && current === serial) { status.textContent = window.KuttI18n.failure(error); status.classList.add("error"); }
    } finally {
      if (current === serial) form.querySelector('button[type="submit"]').disabled = false;
      window.KuttFocus.restore(focus);
    }
  }
  form.addEventListener("submit", event => { event.preventDefault(); load(); });
  load();
})();
