// Explicit test preload only. Production never imports this module.
const assert = require("node:assert/strict");
assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
assert.equal(process.env.NODE_APP_INSTANCE, "1");
assert.equal(process.env.MAIL_ENABLED, "false");
assert.equal(process.env.OIDC_ENABLED, "false");
assert(/^127\.0\.0\.1:\d+$/.test(process.env.DEFAULT_DOMAIN));
assert(/^\/tmp\/kutt-smoke-/.test(process.env.DB_FILENAME));
const jwt = require("jsonwebtoken"), { Resolver } = require("node:dns/promises");
const records = new Map(), originalSign = jwt.sign;
jwt.sign = function(payload, secret, options, ...rest) {
  const result = originalSign.call(this, payload, secret, options, ...rest);
  if (options?.audience === "kutt-domain-ownership-v1" && payload.address?.endsWith(".example.invalid")) {
    records.set("_kutt-verification." + payload.address, payload.value);
  }
  return result;
};
Resolver.prototype.resolveTxt = async name => {
  if (!records.has(name)) throw Object.assign(new Error("Offline DNS fixture"), { code: "ENODATA" });
  return [[records.get(name)]];
};
