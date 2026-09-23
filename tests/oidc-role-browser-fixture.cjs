const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const path = require("node:path");

async function main() {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  assert.equal(process.env.DB_FILENAME, "/tmp/kutt-browser-roles.sqlite");
  assert(!require("node:fs").existsSync(process.env.DB_FILENAME));
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  process.env.OIDC_CLIENT_SECRET = randomBytes(32).toString("hex");
  process.env.OIDC_ADMIN_CLAIM = "roles." + "x".repeat(122);
  const root = path.resolve(__dirname, "..");
  const migration = spawnSync(process.execPath, [path.join(root, "node_modules/knex/bin/cli.js"), "--knexfile", path.join(root, "knexfile.js"), "migrate:latest"], { env: process.env, encoding: "utf8" });
  assert.equal(migration.status, 0, migration.stderr);
  const db = new (require("better-sqlite3"))(process.env.DB_FILENAME);
  // Public test-only credentials in a disposable loopback fixture, never an operator account.
  const password = await require("bcryptjs").hash("DisposableRoleBrowserFixture!2026", 12);
  db.prepare("INSERT INTO users(id,email,password,role,verified) VALUES(?,?,?,?,?)").run(1, "recovery@example.invalid", password, "ADMIN", 1);
  db.close();
  require("../server/server");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
