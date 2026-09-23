const assert = require("node:assert/strict");
const locale = process.env.KUTT_TEST_LOCALE || "en";
assert(["en", "fr", "es"].includes(locale), "Unsupported browser test locale");
const catalog = require("../locales/" + locale + ".json");
function t(key, values = {}) {
  assert(Object.hasOwn(catalog, key), "Unknown browser test key: " + key);
  return catalog[key].replace(/{{\s*([A-Za-z][A-Za-z0-9_]*)\s*}}/g, (_, name) => {
    assert(Object.hasOwn(values, name), "Missing browser test placeholder: " + name);
    return String(values[name]);
  });
}
module.exports = { locale, t };
