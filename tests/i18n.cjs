const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const i18n = require("../server/i18n");
const root = path.resolve(__dirname, "..");
const placeholders = text => [...text.matchAll(/{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g)].map(match => match[1]).sort();

async function unit() {
  const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "kutt-i18n-catalogs-"));
  try {
    const load = () => require("../server/i18n-catalogs").load(directory);
    const write = (name, value) => fs.writeFileSync(path.join(directory, name + ".json"), JSON.stringify(value));
    write("languages", { en: "English", fr: "Français" });
    write("en", { "test.greeting": "Hello {{name}}" });
    write("fr", { "test.greeting": "Bonjour {{name}}" });
    assert(Object.isFrozen(load().catalogs.fr));
    for (const catalog of [{ "test.other": "Hello" }, { "test.greeting": "Bonjour {{other}}" }, { "test.greeting": "<img src=x>" }, { "test.greeting": "{{- name}}" }, { "test.greeting": "$t(other)" }]) {
      write("fr", catalog); assert.throws(load);
    }
    write("languages", { en: "English", "../fr": "Français" }); assert.throws(load, /registration/);
    const bundled = path.join(directory, "bundled"), custom = path.join(directory, "custom");
    fs.mkdirSync(bundled); fs.mkdirSync(custom);
    fs.writeFileSync(path.join(bundled, "locale_fixture.hbs"), "BUNDLED {{t 'ui.settings'}}");
    fs.writeFileSync(path.join(custom, "locale_fixture.hbs"), "CUSTOM {{t 'ui.settings'}}");
    const hbs = require("hbs"); i18n.register(hbs);
    await require("../server/template-partials")(hbs, bundled, custom);
    await i18n.run("fr", async () => assert.equal(hbs.handlebars.compile("{{> locale_fixture}}")({}), "CUSTOM Paramètres"));
    const app = require("express")(); app.set("view engine", "hbs"); app.set("views", [custom, bundled]);
    await i18n.run("es", async () => {
      const html = await new Promise((resolve, reject) => app.render("locale_fixture", { layout: false }, (error, html) => error ? reject(error) : resolve(html)));
      assert.equal(html, "CUSTOM Ajustes", "Whole custom views keep first-directory precedence");
    });
    hbs.handlebars.unregisterPartial("locale_fixture");
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
  const keys = Object.keys(i18n.catalogs.en).sort();
  for (const [locale, catalog] of Object.entries(i18n.catalogs)) {
    assert.deepEqual(Object.keys(catalog).sort(), keys, locale + " catalog parity");
    for (const key of keys) {
      assert.equal(typeof catalog[key], "string", locale + ":" + key);
      assert(catalog[key].trim(), locale + ":" + key);
      assert.deepEqual(placeholders(catalog[key]), placeholders(i18n.catalogs.en[key]), locale + ":" + key);
      assert(!/{{-|\$t\(|<\/?[a-z][^>]*>/i.test(catalog[key]), "Catalogs are plain text: " + key);
    }
  }
  const reviewedCopy = {
    es: {
      "dialog.ban_link": "¿Confirma que desea bloquear el enlace «{{value}}»?",
      "dialog.ban_domain": "¿Confirma que desea bloquear el dominio «{{value}}»?",
      "dialog.ban_user": "¿Confirma que desea bloquear al usuario «{{value}}»?",
      "dialog.delete_domain": "¿Confirma que desea eliminar el dominio «{{value}}»?",
      "dialog.delete_user": "¿Confirma que desea eliminar al usuario «{{value}}»?",
      "moderation.sign_in": "Vuelva a iniciar sesión con una cuenta autorizada.",
      "moderation.no_cascade": "Levante cada bloqueo explícitamente; no se admite el restablecimiento en cascada.",
      "moderation.destination_changed": "El destino ha cambiado. Revise el enlace y vuelva a intentarlo.",
      "moderation.extra_fields": "Levante cada bloqueo explícitamente; no se aceptan campos adicionales.",
      "moderation.retry": "No se pudo completar la moderación. Revise el estado actual antes de volver a intentarlo.",
      "moderation.token_sign_in": "Vuelva a iniciar sesión antes de crear un token.",
      "sorting.close_editors": "Cierre los editores de enlaces para cambiar el orden.",
      "moderation.invalid_target": "Elemento no válido para moderación.",
      "moderation.not_found": "No se ha encontrado el elemento que se desea moderar.",
      "geography.basis": "Los porcentajes se calculan sobre el total de visitas registradas en el informe actual."
    },
    fr: {
      "geography.basis": "Les pourcentages sont calculés sur l'ensemble des visites enregistrées dans le rapport actuel."
    }
  };
  for (const [locale, copy] of Object.entries(reviewedCopy)) {
    await i18n.run(locale, () => {
      for (const [key, expected] of Object.entries(copy)) {
        assert.equal(i18n.catalogs[locale][key], expected, locale + ": reviewed copy " + key);
        assert.deepEqual(placeholders(expected), placeholders(i18n.catalogs.en[key]), key + " retains its interpolation contract");
        const value = '<img src=x onerror="window.injected=1">& {{value}}';
        assert.equal(i18n.t(key, { value }), expected.replace("{{value}}", value));
        if (key.startsWith("dialog.")) {
          const hbs = require("hbs").handlebars;
          const html = hbs.compile('{{t "' + key + '" value=value}}')({ value });
          assert.equal(html, hbs.escapeExpression(expected.replace("{{value}}", value)));
          assert(!html.includes("<img"), "Reviewed confirmation text keeps escaped, nonrecursive interpolation");
        }
      }
    });
  }
  console.log("PASS: reviewed formal Spanish management copy, moderation entity wording and French/Spanish geography denominator copy with unchanged escaped placeholders");
  const source = directories => directories.flatMap(directory => fs.readdirSync(path.join(root, directory), { recursive: true })
    .filter(file => /\.(js|hbs|html)$/.test(file)).map(file => path.join(root, directory, file)));
  for (const file of source(["server", "static/scripts"])) {
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/(?:\.t\(\s*|{{t\s+)["']([a-zA-Z0-9_.]+)["']/g)) {
      if (text.slice(match.index + match[0].length).trimStart().startsWith("+")) {
        assert(keys.some(key => key.startsWith(match[1])), "Unknown dynamic key prefix: " + match[1]);
        continue;
      }
      assert(Object.hasOwn(i18n.catalogs.en, match[1]) || Object.hasOwn(i18n.catalogs.en, match[1] + "_other"), file + ": " + match[1]);
    }
    if (/\.(hbs|html)$/.test(file)) require("hbs").handlebars.precompile(text);
  }
  const hbs = require("hbs").handlebars;
  i18n.register(hbs);
  assert.equal(hbs.compile("{{label}}")({ label: "English" }), "English", "Translation helpers must not shadow model labels");
  const render = hbs.compile('<p>{{t "ui.edit_value" value1=value}}</p><input title="{{t \'ui.edit_value\' value1=value}}">');
  const hostile = '</script><img src=x onerror="globalThis.injected=1">&\' $t(ui.admin) {{value1}}';
  const escape = hbs.escapeExpression;
  await Promise.all(Array.from({ length: 90 }, (_, index) => {
    const locale = ["en", "fr", "es"][index % 3];
    return i18n.run(locale, async () => {
      await new Promise(resolve => setTimeout(resolve, index % 9));
      assert.equal(i18n.current().locale, locale);
      const provider = hbs.compile('{{t "auth.provider_login" provider=value}}')({ value: hostile });
      assert(provider.includes(escape(hostile)) && !provider.includes("<img"));
      assert.equal(i18n.t("auth.provider_login", { provider: "Authentik" }), {
        en: "Log in with Authentik", fr: "Se connecter avec Authentik", es: "Iniciar sesión con Authentik"
      }[locale]);
      assert.equal(i18n.t("ui.edit_value", { value1: hostile, lng: "en", escapeValue: false }), i18n.catalogs[locale]["ui.edit_value"].replace("{{value1}}", hostile));
      const html = render({ value: hostile });
      assert(html.includes(escape(hostile)) && !html.includes("<img"));
      for (const count of [0, 1, 2, 100, 1000000]) {
        assert(!i18n.t("library.selected", { count }).includes("{{"));
        assert(!i18n.t("unit.day", { count }).includes("{{"));
      }
      assert.equal(i18n.t("library.selected", { count: "2" }), i18n.t("library.selected", { count: 2 }));
      assert.equal(i18n.t("library.selected", { count: undefined }), i18n.t("library.selected", { count: 0 }));
      assert.equal(i18n.current().number(12345.67), new Intl.NumberFormat(locale).format(12345.67));
      assert.equal(i18n.current().date("2026-01-02T03:04:00Z", { dateStyle: "long", timeZone: "UTC" }), new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(new Date("2026-01-02T03:04:00Z")));
      assert.equal(i18n.current().ago("2026-01-02T03:04:00Z", Date.parse("2026-01-02T03:04:02Z")), new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(-2, "second"));
      assert.equal(i18n.current().label("role", hostile), hostile, "Unknown labels remain plain text");
    });
  }));
  assert.equal(i18n.current().locale, "en");
  for (const locale of ["en", "fr", "es"]) {
    const context = vm.createContext({ window: {}, Intl });
    vm.runInContext(fs.readFileSync(path.join(path.dirname(require.resolve("i18next/package.json")), "dist/umd/i18next.min.js"), "utf8"), context);
    vm.runInContext(fs.readFileSync(path.join(root, "static/scripts/i18n-core.js"), "utf8"), context);
    context.catalog = i18n.catalogs[locale]; context.locale = locale;
    const browser = vm.runInContext("KuttI18nCore.create(locale, catalog)", context);
    await i18n.run(locale, async () => {
      assert.equal(browser.t("ui.edit_value", { value1: hostile }), i18n.t("ui.edit_value", { value1: hostile }));
      for (const count of [0, 1, 2, 1000000]) assert.equal(browser.t("library.selected", { count }), i18n.t("library.selected", { count }));
      const { render: mail } = require("../server/mail/render");
      for (const kind of ["verify", "change-email", "reset"]) {
        const content = mail(kind, { domain: "mail.example.invalid", site_name: hostile, token: "synthetic-token" });
        assert(!content.html.includes("<img src=x") && !content.html.includes("{{t "));
        assert(content.html.includes('lang="' + locale + '"'));
        assert(content.text.includes("https://mail.example.invalid/" + ({ verify: "verify", "change-email": "verify-email", reset: "reset-password" })[kind] + "/synthetic-token"));
        assert(!content.html.includes("{{verification}}") && !content.html.includes("{{resetpassword}}"));
      }
    });
  }
  for (const bad of ["//evil.invalid", "/\\evil.invalid", "/\nevil.invalid", "https://evil.invalid", ["/settings"], null]) assert.equal(i18n.safeReturn(bad), "/");
  assert.equal(i18n.safeReturn("/settings/library?q=one%20two"), "/settings/library?q=one%20two");
  console.log("PASS: i18n catalog/key/placeholder parity, all template compilation, hostile escaping, Node/browser format parity, plural categories, mail and 90 concurrent locale contexts");
}

module.exports = async ({ request, session, url }) => {
  await unit();
  const label = { en: "Log in", fr: "Se connecter", es: "Iniciar sesión" };
  await Promise.all(Array.from({ length: 18 }, async (_, index) => {
    const locale = ["en", "fr", "es"][index % 3];
    const page = await request("GET", "/login", undefined, undefined, { Accept: "text/html", "Accept-Language": locale });
    assert.equal(page.status, 200); assert.equal(page.headers.get("content-language"), locale);
    assert.equal(page.headers.get("referrer-policy"), "same-origin");
    const html = await page.text();
    assert(html.includes('<html lang="' + locale + '">') && html.includes(label[locale]));
    assert(!html.includes("{{t ") && !html.includes("window.KuttI18n ="));
    const denied = await request("GET", "/api/links", undefined, undefined, { "Accept-Language": locale });
    assert.equal(denied.status, 401); assert.equal((await denied.json()).error, i18n.catalogs[locale]["messages.unauthorized"]);
    const invalid = await request("POST", "/api/links", {}, session, { "Accept-Language": locale });
    assert.equal(invalid.status, 400); assert.equal((await invalid.json()).error, i18n.catalogs[locale]["messages.target_is_missing"]);
  }));
  for (const [cookie, language, expected] of [["fr", "es", "fr"], ["../../es", "es-MX", "es"], ["invalid", "de", "en"], ["es", "en", "es"]]) {
    const page = await request("GET", "/login", undefined, undefined, { Accept: "text/html", Cookie: "kutt_locale=" + cookie, "Accept-Language": language });
    assert.equal(page.headers.get("content-language"), expected);
  }
  for (const locale of ["en", "fr", "es"]) {
    const response = await request("POST", "/language", { locale, return_to: "/settings?tab=tokens" }, undefined, { Origin: url });
    assert.equal(response.status, 303); assert.equal(response.headers.get("location"), "/settings?tab=tokens");
    assert(response.headers.getSetCookie().some(cookie => cookie.startsWith("kutt_locale=" + locale) && cookie.includes("HttpOnly") && cookie.includes("SameSite=Lax")));
    const asset = await request("GET", "/locales/" + locale + ".js");
    assert.equal(asset.status, 200); assert.match(asset.headers.get("content-type"), /javascript/);
    assert(!(await asset.text()).includes("</script>"));
    const manifest = await request("GET", "/locales/" + locale + ".webmanifest");
    assert.equal(manifest.status, 200); assert.equal((await manifest.json()).lang, locale);
    const guide = await request("GET", "/api/shortcuts/guide", undefined, session, { "Accept-Language": locale });
    assert.equal(guide.status, 200);
    assert((await guide.text()).startsWith({ en: "# Private iOS Shortcut", fr: "# Raccourci iOS privé", es: "# Atajo Privado Para iOS" }[locale]));
    const wrong = await request("POST", "/language", { locale, return_to: "/" }, undefined, { Origin: "https://foreign.invalid" });
    assert.equal(wrong.status, 400); assert.equal(wrong.headers.getSetCookie().length, 0);
    const opaque = await request("POST", "/language", { locale, return_to: "/" }, undefined, { Origin: "null" });
    assert.equal(opaque.status, 400); assert.equal(opaque.headers.getSetCookie().length, 0);
    const unsafe = await request("POST", "/language", { locale, return_to: "//foreign.invalid" }, undefined, { Origin: url });
    assert.equal(unsafe.headers.get("location"), "/");
  }
  const invalid = await request("POST", "/language", { locale: "../fr" }, undefined, { Origin: url });
  assert.equal(invalid.status, 400); assert.equal(invalid.headers.getSetCookie().length, 0);
  const unknown = await request("GET", "/locales/not-a-locale.js"); assert.equal(unknown.status, 404);
  const created = await request("POST", "/api/links", { target: "https://192.0.2.1/i18n-http", customurl: "i18n-" + require("node:crypto").randomUUID(), expire_in: "2 days" }, session);
  assert.equal(created.status, 201); const link = await created.json();
  const snapshots = [];
  try {
    for (const locale of ["en", "fr", "es"]) {
      const edit = await request("GET", "/link/edit/" + link.id, undefined, session, { Accept: "text/html", "Accept-Language": locale });
      assert.equal(edit.status, 200); const html = await edit.text();
      snapshots.push(html.match(/name="expiry_snapshot"[^>]*value="([^"]+)"/)?.[1]);
      const listing = await (await request("GET", "/api/links", undefined, session, { "Accept-Language": locale })).json();
      const row = listing.data.find(row => row.id === link.id);
      assert.equal(row.address, link.address); assert.equal(row.target, link.target);
      assert.equal(row.lifecycle_status, "Active"); assert.equal(row.expire_in, link.expire_in);
    }
    assert(snapshots[0]); assert(snapshots.every(value => value === snapshots[0]), "Locale never changes the signed machine-readable expiry snapshot");
  } finally { await request("DELETE", "/api/links/" + link.id, undefined, session); }
  await require("./i18n-community.cjs")({ request, session, url });
  console.log("PASS: concurrent localized HTTP/validation errors, Accept-Language negotiation, cookie precedence, allowlisted external catalogs, same-origin selector and open-redirect rejection");
};
module.exports.unit = unit;
if (require.main === module) unit().catch(error => { console.error(error); process.exitCode = 1; });
