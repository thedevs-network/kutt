(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("i18next"));
  else root.KuttI18nCore = factory(root.i18next);
})(typeof globalThis === "object" ? globalThis : this, function (i18next) {
  "use strict";
  function create(locale, catalog) {
    const engine = i18next.createInstance();
    engine.init({ lng: locale, fallbackLng: false, initAsync: false, keySeparator: false,
      resources: { [locale]: { translation: catalog } },
      interpolation: { escapeValue: false, skipOnVariables: true }, returnNull: false,
      returnObjects: false, saveMissing: false });
    function t(key, values = {}) {
      // Values cannot override language, resources, escaping or other engine options.
      const replace = Object.create(null);
      for (const [name, value] of Object.entries(values)) {
        if (/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name) && !["constructor", "prototype", "__proto__"].includes(name) &&
            ["string", "number", "boolean"].includes(typeof value)) replace[name] = String(value);
      }
      // SQL drivers can return counts as strings; validation-error partials can omit them.
      const countValue = values.count == null ? 0 : Number(values.count);
      const count = Object.hasOwn(values, "count") ? (Number.isFinite(countValue) ? countValue : 0) : undefined;
      if (count !== undefined) replace.count = String(count);
      if (!engine.exists(key, { count })) throw new Error("Unknown translation key: " + key);
      return engine.t(key, { replace, count, interpolation: { escapeValue: false, skipOnVariables: true } });
    }
    const number = (value, options) => new Intl.NumberFormat(locale, options).format(Number(value ?? 0));
    const date = (value, options = { dateStyle: "medium", timeStyle: "short" }) => {
      const parsed = new Date(value);
      return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(locale, options).format(parsed) : "";
    };
    const relative = (value, unit) => new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(value, unit);
    const label = (group, value) => {
      if (group === "event" && typeof value === "string" && value.startsWith("link.")) return label("action", value.slice(5));
      const key = "enum." + group + "." + value;
      return engine.exists(key) ? t(key) : String(value ?? "");
    };
    const region = value => /^[A-Z]{2}$/.test(value) ? new Intl.DisplayNames(locale, { type: "region" }).of(value) : t("ui.unknown");
    const failure = error => ["TypeError", "SyntaxError", "AbortError", "NetworkError", "NotReadableError"].includes(error?.name) || !error?.message ? t("common.request_failed") : error.message;
    const duration = milliseconds => {
      const absolute = Math.abs(milliseconds);
      const [unit, size] = [["year", 31557600000], ["day", 86400000], ["hour", 3600000], ["minute", 60000], ["second", 1000], ["millisecond", 1]].find(([, size]) => absolute >= size) || ["millisecond", 1];
      return t("unit." + unit, { count: Math.round(milliseconds / size) });
    };
    const ago = (value, now = Date.now()) => {
      const seconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
      if (!Number.isFinite(seconds)) return "";
      const [unit, size] = [["year", 31536000], ["month", 2592000], ["week", 604800], ["day", 86400], ["hour", 3600], ["minute", 60], ["second", 1]].find(([, size]) => seconds >= size) || ["second", 1];
      return relative(-Math.floor(seconds / size), unit);
    };
    // All strings are plain text. Use textContent or an escaping template engine, never innerHTML.
    return Object.freeze({ locale, t, number, date, relative, ago, label, region, failure, duration });
  }
  return Object.freeze({ create });
});
