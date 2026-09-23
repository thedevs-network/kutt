// Loaded explicitly by the disposable test harness, never by application code.
const assert = require("node:assert/strict");
assert(process.env.DB_FILENAME?.startsWith("/tmp/kutt-smoke-") && process.env.DEFAULT_DOMAIN?.startsWith("127.0.0.1:") && process.env.NODE_APP_INSTANCE === "1");
const { Resolver } = require("node:dns").promises;
Resolver.prototype.resolve4 = async function (host) {
  if (host === "hooks.example.com") return ["8.8.8.8"];
  if (host === "mixed.example.com") return ["8.8.8.8", "127.0.0.1"];
  throw Object.assign(new Error("No fixture DNS"), { code: "ENOTFOUND" });
};
Resolver.prototype.resolve6 = async function () { throw Object.assign(new Error("No fixture IPv6"), { code: "ENODATA" }); };
