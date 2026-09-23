const assert = require("node:assert/strict");
const { mkdtempSync, rmSync, existsSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { randomBytes } = require("node:crypto");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
assert(!existsSync(path.join(root, ".env")), "Use an isolated checkout");
const selected = process.argv[2];
assert([undefined, "RS256", "ES256", "PS256", "EdDSA"].includes(selected));
const directory = mkdtempSync(path.join(tmpdir(), "kutt-oidc-algorithms-"));
const env = {
  PATH: process.env.PATH, NODE_ENV: "development", NODE_APP_INSTANCE: "1",
  DB_CLIENT: "better-sqlite3", DB_FILENAME: path.join(directory, "unused.sqlite"),
  JWT_SECRET: randomBytes(48).toString("hex"), REDIS_ENABLED: "false", MAIL_ENABLED: "false",
  DISALLOW_ANONYMOUS_LINKS: "true", DISALLOW_REGISTRATION: "true", DISALLOW_LOGIN_FORM: "false",
  ENABLE_RATE_LIMIT: "false", TRUST_PROXY: "false", UV_THREADPOOL_SIZE: "16"
};
(async () => {
  for (const algorithm of selected ? [selected] : ["ES256", "PS256", "EdDSA"]) {
    await require("./oidc-security.cjs")({ root, directory, env, algorithm });
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; })
  .finally(() => rmSync(directory, { recursive: true, force: true }));
