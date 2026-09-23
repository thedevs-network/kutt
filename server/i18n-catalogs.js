const fs = require("node:fs");
const path = require("node:path");

const placeholders = text => [...text.matchAll(/{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g)].map(match => match[1]).sort().join(",");
function load(directory) {
  const languages = JSON.parse(fs.readFileSync(path.join(directory, "languages.json"), "utf8"));
  if (!languages || Array.isArray(languages) || !Object.hasOwn(languages, "en")) throw new Error("Localization requires an English default.");
  const catalogs = {};
  for (const [locale, name] of Object.entries(languages)) {
    if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(locale) || typeof name !== "string" || !name.trim() || /[<>]/.test(name)) throw new Error("Invalid language registration.");
    Intl.getCanonicalLocales(locale);
    const catalog = JSON.parse(fs.readFileSync(path.join(directory, locale + ".json"), "utf8"));
    if (!catalog || Array.isArray(catalog) || typeof catalog !== "object") throw new Error("Invalid localization catalog: " + locale);
    for (const [key, value] of Object.entries(catalog)) {
      if (!/^[a-z][a-zA-Z0-9_.]*$/.test(key) || typeof value !== "string" || !value.trim() || /{{-|\$t\(|<\/?[a-z][^>]*>/i.test(value) || /{{|}}/.test(value.replace(/{{\s*[A-Za-z][A-Za-z0-9_]*\s*}}/g, ""))) {
        throw new Error("Invalid plain-text translation: " + locale + ":" + key);
      }
    }
    catalogs[locale] = Object.freeze(catalog);
  }
  const keys = Object.keys(catalogs.en).sort();
  for (const [locale, catalog] of Object.entries(catalogs)) {
    if (JSON.stringify(Object.keys(catalog).sort()) !== JSON.stringify(keys)) throw new Error("Translation key mismatch: " + locale);
    for (const key of keys) if (placeholders(catalog[key]) !== placeholders(catalogs.en[key])) throw new Error("Translation placeholder mismatch: " + locale + ":" + key);
  }
  return { languages: Object.freeze(languages), catalogs: Object.freeze(catalogs) };
}
module.exports = { load };
