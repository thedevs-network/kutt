const assert = require("node:assert/strict");
const path = require("node:path");
assert.equal(process.env.KUTT_DATABASE_DISPOSABLE, "1");
assert.equal(process.env.DB_CLIENT, "better-sqlite3");
assert(/^\/tmp\/kutt-sort-[a-z0-9-]+\.sqlite$/.test(process.env.DB_FILENAME));
const db = require("../server/knex");
(async () => {
  assert.equal(await db.schema.hasTable("users"), false);
  await db.migrate.latest({ directory: path.join(__dirname, "../server/migrations") });
  await require("./list-sort-database.cjs")(db);
  await require("./moderation-database.cjs")(db);
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(() => db.destroy());
