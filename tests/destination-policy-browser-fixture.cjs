const assert = require("node:assert/strict");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  assert.match(process.env.DEFAULT_DOMAIN, /^127\.0\.0\.1:\d+$/);
  assert.equal(process.env.DB_FILENAME, "/tmp/kutt-policy-edit.sqlite");
  const db = require("../server/knex");
  await db.migrate.latest({ directory: "/kutt/server/migrations" });
  assert.equal(Number((await db("users").count({ n: "id" }).first()).n), 0, "Refuse initialized fixture");
  const password = await require("bcryptjs").hash("Disposable-policy-edit-42!", 12);
  await db("users").insert([
    { id: 1, email: "policy-admin@example.invalid", password, role: "ADMIN", verified: true },
    { id: 2, email: "policy-owner@example.invalid", password, role: "USER", verified: true }
  ]);
  for (const width of [1440, 390, 320]) for (const kind of ["personal", "admin", "shared"]) {
    await require("../server/queries/link.queries").create({ address: "policy-" + kind + "-" + width,
      user_id: 2, target: "https://198.51.100.2/original", description: "Existing denied destination" }, db);
  }
  require("../server/server");
})().catch(error => { console.error(error); process.exit(1); });
