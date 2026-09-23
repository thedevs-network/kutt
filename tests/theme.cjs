const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

module.exports = async ({ root, request, session }) => {
  const source = readFileSync(path.join(root, "static/scripts/theme.js"), "utf8");
  function fixture(value, dark, blocked = false) {
    const rootElement = { dataset: {} }, meta = {}, handlers = {}, mediaHandlers = {};
    const inputs = ["system", "light", "dark"].map(value => ({ value }));
    const picker = { hidden: true, querySelectorAll: () => inputs };
    const media = { matches: dark, addEventListener: (name, cb) => { mediaHandlers[name] = cb; } };
    const storage = { getItem: () => { if (blocked) throw Error("blocked"); return value; }, setItem: (key, next) => { assert.equal(key, "kutt.theme"); if (blocked) throw Error("blocked"); value = next; } };
    const document = {
      documentElement: rootElement, querySelector: () => meta, querySelectorAll: () => [picker],
      dispatchEvent: () => {}, addEventListener: (name, cb) => { handlers[name] = cb; }
    };
    const window = { localStorage: storage, matchMedia: () => media, addEventListener: (name, cb) => { handlers[name] = cb; } };
    vm.runInNewContext(source, { window, document, CustomEvent: function (type, detail) { this.type = type; this.detail = detail; } });
    return {
      rootElement, meta, inputs, picker,
      choose: next => handlers.change({ target: { value: next, matches: () => true } }),
      unrelated: () => handlers.change({ target: { value: "dark", matches: () => false } }),
      system: next => { media.matches = next; mediaHandlers.change(); },
      storage: (next, key = "kutt.theme") => { value = next; handlers.storage({ key }); },
      initialize: () => handlers.DOMContentLoaded(), swap: () => handlers["htmx:afterSwap"]()
    };
  }
  for (const invalid of [null, "", "DARK", "<script>", "invalid"]) {
    const f = fixture(invalid, true); assert.equal(f.rootElement.dataset.theme, "dark");
    assert.equal(f.rootElement.dataset.themePreference, "system");
  }
  const f = fixture("light", true); assert.equal(f.rootElement.dataset.theme, "light");
  f.system(false); f.system(true); assert.equal(f.rootElement.dataset.theme, "light");
  f.choose("dark"); assert.equal(f.rootElement.dataset.theme, "dark"); assert.equal(f.meta.content, "#191b1d");
  f.choose("invalid"); assert.equal(f.rootElement.dataset.theme, "dark");
  f.storage("light", "unrelated"); assert.equal(f.rootElement.dataset.theme, "dark");
  f.storage("light"); assert.equal(f.rootElement.dataset.theme, "light");
  f.unrelated(); assert.equal(f.rootElement.dataset.theme, "light");
  f.storage(null, null); assert.equal(f.rootElement.dataset.themePreference, "system");
  f.system(false); assert.equal(f.rootElement.dataset.theme, "light");
  f.initialize(); f.swap(); assert.equal(f.picker.hidden, false); assert(f.inputs[0].checked);
  const denied = fixture(null, true, true); denied.choose("light");
  assert.equal(denied.rootElement.dataset.theme, "light");
  assert(!/innerHTML|eval\(|fetch\(/.test(source), "Theme preferences never invoke HTML/eval/network");
  const page = await request("GET", "/", undefined, session, { Accept: "text/html" });
  assert.equal(page.status, 200); const html = await page.text();
  assert(html.includes('data-theme-picker hidden')); assert(html.includes('value="system"'));
  assert(html.indexOf('/scripts/theme.js') < html.indexOf('/css/styles.css'), "Initialize before rendering styles");
  for (const locale of ["en", "fr", "es"]) {
    const catalog = require(path.join(root, "locales", locale + ".json"));
    const localized = await request("GET", "/", undefined, session, { Accept: "text/html", "Accept-Language": locale });
    assert.equal(localized.status, 200);
    const body = await localized.text();
    assert(body.includes(`<legend>${catalog["theme.appearance"]}</legend>`));
    for (const value of ["system", "light", "dark"]) {
      assert(body.includes(`name="theme" value="${value}">${catalog["theme." + value]}</label>`), locale + " keeps theme values stable");
    }
  }
  for (const asset of ["/scripts/theme.js", "/scripts/chart-theme.js", "/css/theme.css"]) {
    const response = await request("GET", asset); assert.equal(response.status, 200);
  }
  console.log("PASS: strict local theme preferences, early initialization, system changes, cross-tab isolation, storage denial, safe assets and EN/FR/ES selectors with unchanged machine values");
};
