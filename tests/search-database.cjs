const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const path = require("node:path");

assert.equal(process.env.KUTT_DATABASE_DISPOSABLE, "1");
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert(/^kutt_search_/.test(process.env.DB_NAME));
assert(["pg", "mysql2"].includes(process.env.DB_CLIENT));
const db = require("../server/knex");

(async () => {
  assert.equal(await db.schema.hasTable("users"), false, "Refuse an initialized database");
  await db.migrate.latest({ directory: path.join(__dirname, "../server/migrations") });
  const users = require("../server/queries/user.queries");
  const links = require("../server/queries/link.queries");
  const owner = await users.add({ email: randomUUID() + "@example.invalid", password: "disposable-fixture", verified: true });
  const other = await users.add({ email: randomUUID() + "@example.invalid", password: "disposable-fixture", verified: true });
  // Four-byte Unicode catches utf8_bin/utf8mb4 collation mismatches.
  const description = "\u00c9cole \ud83e\uddea";
  for (const [user, suffix] of [[owner, "one"], [owner, "two"], [other, "foreign"]]) {
    await links.create({ user_id: user.id, address: "search-" + suffix, description, target: "https://192.0.2.1/" + suffix });
  }
  const match = { user_id: owner.id };
  for (const search of ["cole", "COLE", "\ud83e\uddea"]) {
    const first = await links.get(match, { search, limit: 1, skip: 0 });
    const second = await links.get(match, { search, limit: 1, skip: 1 });
    assert.equal(await links.total(match, { search }), 2);
    assert.equal(first.length, 1); assert.equal(second.length, 1);
    assert.notEqual(first[0].id, second[0].id);
    assert.equal(first[0].description, description);
    assert.equal(first[0].user_id, owner.id); assert.equal(second[0].user_id, owner.id);
    assert.equal((await links.get(match, { search, limit: 1, skip: 2 })).length, 0);
    assert.equal(await links.totalAdmin({}, { search }), 3);
    assert.equal((await links.getAdmin({}, { search, limit: 2, skip: 0 })).length, 2);
  }
  for (const search of ["missing", "' OR 1=1 --"]) {
    assert.equal(await links.total(match, { search }), 0);
    assert.deepEqual(await links.get(match, { search, limit: 10, skip: 0 }), []);
  }
  console.log("PASS: " + process.env.DB_CLIENT + " Unicode search, case matching, count/list pagination, owner isolation and bound input");
  await require("./list-sort-database.cjs")(db);
  await require("./moderation-database.cjs")(db);
  await require("./visit-hour-index.cjs")(db);
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(() => db.destroy());
