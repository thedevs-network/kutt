const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");

module.exports = function ({ root, directory, env }) {
  const filename = path.join(directory, "history-upgrade.sqlite");
  const migrate = action => spawnSync(process.execPath, [path.join(root, "node_modules/knex/bin/cli.js"),
    "--knexfile", path.join(root, "knexfile.js"), action,
    ...(action === "migrate:down" ? ["20260914001000_link_history_trash.js"] : [])], {
    cwd: directory, env: { ...env, DB_FILENAME: filename }, encoding: "utf8", timeout: 60000
  });
  assert.equal(migrate("migrate:latest").status, 0);
  assert.equal(migrate("migrate:down").status, 0);
  let db = new Database(filename);
  const first = randomUUID(), duplicate = randomUUID();
  for (const uuid of [first, duplicate]) db.prepare("INSERT INTO links(address, target, uuid) VALUES(?,?,?)")
    .run("old-duplicate", "https://192.0.2.1/migrated", uuid);
  db.close();
  assert.notEqual(migrate("migrate:latest").status, 0, "Conflicting historical aliases must fail migration");
  db = new Database(filename);
  assert.equal(db.prepare("SELECT count(*) AS n FROM links").get().n, 2, "Failed migration must preserve all old records");
  assert(!db.prepare("PRAGMA table_info(links)").all().some(row => row.name === "deleted_at"), "SQLite migration must roll back its DDL");
  // This is a deliberately seeded, disposable duplicate, never production cleanup.
  db.prepare("DELETE FROM links WHERE uuid = ?").run(duplicate);
  db.close();
  assert.equal(migrate("migrate:latest").status, 0);
  db = new Database(filename);
  assert.equal(db.prepare("SELECT link_uuid FROM link_alias_claims").get().link_uuid, first);
  assert.equal(db.prepare("SELECT action FROM link_history").get().action, "migrated");
  db.prepare("DELETE FROM links WHERE uuid = ?").run(first);
  db.close();
  assert.notEqual(migrate("migrate:down").status, 0, "Orphan alias reservations must survive downgrade attempts");
  console.log("PASS: populated migration, duplicate conflict rollback, retained records and orphan-claim downgrade refusal");
};
