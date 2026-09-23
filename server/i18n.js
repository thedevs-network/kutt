const { AsyncLocalStorage } = require("node:async_hooks");
const path = require("node:path");
const core = require("../static/scripts/i18n-core");

const { languages, catalogs } = require("./i18n-catalogs").load(path.join(__dirname, "../locales"));
const translators = Object.fromEntries(Object.entries(catalogs).map(([locale, catalog]) => [locale, core.create(locale, catalog)]));
const requests = new AsyncLocalStorage();
const current = () => requests.getStore()?.translator || translators.en;
const supported = locale => typeof locale === "string" && Object.hasOwn(languages, locale);
const run = (locale, callback) => requests.run({ translator: translators[supported(locale) ? locale : "en"], blocks: {} }, callback);

function select(req) {
  if (supported(req.cookies?.kutt_locale)) return req.cookies.kutt_locale;
  const preferred = req.acceptsLanguages?.(...Object.keys(languages));
  return supported(preferred) ? preferred : "en";
}
function middleware(req, res, next) {
  const locale = select(req);
  res.locals.locale = locale;
  res.locals.languages = Object.entries(languages).map(([value, label]) => ({ value, label, selected: value === locale }));
  res.locals.locale_return = safeReturn(req.originalUrl);
  res.set("Content-Language", locale);
  res.vary("Accept-Language");
  res.vary("Cookie");
  const render = res.render;
  res.render = function (...args) {
    // Native preference forms need a same-origin Origin, not the opaque null
    // produced by no-referrer. Do not send referrers to external destinations.
    res.set("Referrer-Policy", "same-origin");
    return render.apply(this, args);
  };
  run(locale, next);
}
function safeReturn(value) {
  if (typeof value !== "string" || value.length > 4096 || !value.startsWith("/") ||
      value.startsWith("//") || /[\\\u0000-\u0020\u007f]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://kutt.invalid");
    return url.origin === "https://kutt.invalid" ? url.pathname + url.search : "/";
  } catch { return "/"; }
}
function change(req, res) {
  // This preference is not an authentication token, but do not allow cross-origin preference changes.
  let origin;
  try { origin = new URL(req.get("origin")); } catch {}
  const management = require("./management-origin");
  const expected = req.managementHost ? management.origin() : `${req.protocol}://${req.get("host")}`;
  if (!origin || origin.origin !== expected || !supported(req.body?.locale)) {
    return res.status(400).send(current().t("locale.invalid"));
  }
  res.cookie("kutt_locale", req.body.locale, { httpOnly: true, sameSite: "lax", secure: req.managementHost ? management.secureCookie() : req.secure, path: "/", maxAge: 31536000000 });
  res.set("Cache-Control", "no-store");
  res.redirect(303, safeReturn(req.body.return_to));
}
function assets(app, siteName = "Kutt") {
  const manifest = JSON.parse(require("node:fs").readFileSync(path.join(__dirname, "../static/manifest.webmanifest"), "utf8"));
  app.get("/locales/:locale.webmanifest", (req, res) => {
    if (!supported(req.params.locale)) return res.sendStatus(404);
    const locale = req.params.locale;
    res.type("application/manifest+json").set("Content-Language", locale).set("Cache-Control", "public, max-age=0, must-revalidate");
    res.removeHeader("Vary");
    res.send(JSON.stringify({ ...manifest, lang: locale, description: translators[locale].t("ui.value_is_a_free_and_open_source_url_shortener_with_custom", { value1: siteName }) }));
  });
  app.get("/locales/i18next.js", (req, res) => res.sendFile(path.join(path.dirname(require.resolve("i18next/package.json")), "dist/umd/i18next.min.js")));
  app.get("/locales/:locale.js", (req, res) => {
    if (!supported(req.params.locale)) return res.sendStatus(404);
    const locale = req.params.locale;
    // Trusted bundled catalogs only. Escape HTML-sensitive characters even in external scripts.
    const json = JSON.stringify(catalogs[locale]).replace(/[<>&\u2028\u2029]/g, char => "\\u" + char.charCodeAt(0).toString(16).padStart(4, "0"));
    res.type("application/javascript").set("Content-Language", locale).set("Cache-Control", "public, max-age=0, must-revalidate");
    res.removeHeader("Vary");
    res.send(`window.KuttI18n = window.KuttI18nCore.create(${JSON.stringify(locale)}, ${json});\n`);
  });
}
function register(hbs) {
  hbs.registerHelper("t", (key, options) => current().t(key, options.hash));
  hbs.registerHelper("number", value => current().number(value));
  hbs.registerHelper("date", value => value == null ? "" : current().date(value));
  hbs.registerHelper("ago", value => current().ago(value));
  hbs.registerHelper("localizedLabel", (group, value) => current().label(group, value));
  hbs.registerHelper("region", value => current().region(value));
  hbs.registerHelper("utcDate", value => value == null ? "" : current().date(value, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }));
}
module.exports = { languages, catalogs, current, run, middleware, change, assets, register, safeReturn,
  blocks: () => requests.getStore()?.blocks,
  t: (key, values) => current().t(key, values), number: (value, options) => current().number(value, options),
  date: (value, options) => current().date(value, options), ago: value => current().ago(value),
  label: (group, value) => current().label(group, value), duration: value => current().duration(value) };
