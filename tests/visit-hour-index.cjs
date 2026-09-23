const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async function (db) {
  const migration = require("../server/migrations/20260922090000_visit_hour_lookup");
  const utils = require("../server/utils");
  const users = require("../server/queries/user.queries");
  const links = require("../server/queries/link.queries");
  const visits = require("../server/queries/visit.queries");
  const owner = await users.add({ email: randomUUID() + "@example.invalid", password: "disposable-fixture", verified: true });
  const link = await links.create({ user_id: owner.id, address: "hour-" + randomUUID(), target: "https://192.0.2.1/" });
  const job = { link_id: link.id, user_id: owner.id, browser: "safari", os: "ios", country: "FR", referrer: "direct", tracking_revision: 0 };
  const lookup = hour => db.select("*").from(db("visits").select("visits.*")
    .select({ created_at_hours: utils.truncatedCreatedAtHour }).where({ link_id: link.id }).as("subquery"))
    .where("created_at_hours", hour).first();
  const sqlite = ["sqlite3", "better-sqlite3"].includes(db.client.config.client);
  if (sqlite) {
    const dates = ["2020-01-01 09:59:59", "2020-01-01 10:00:00", "2020-01-01T10:15:00.123Z", "2020-01-01T11:30:00+01:00", "2020-01-01T10:59:59Z", "2020-01-01 11:00:00"];
    for (const created_at of dates) await db("visits").insert({ link_id: link.id, user_id: owner.id, created_at, total: 1, countries: '{"fr":1}', referrers: '{"direct":1}' });
    const sql = lookup("2020-01-01 10:00:00").toSQL();
    const indexed = await db.raw("EXPLAIN QUERY PLAN " + sql.sql, sql.bindings);
    assert(indexed.some(row => /visits_link_utc_hour_index/.test(row.detail)), JSON.stringify(indexed));
    const matches = () => db("visits").select("created_at").where({ link_id: link.id }).where(utils.truncatedCreatedAtHour, "2020-01-01 10:00:00").orderBy("created_at");
    const before = await matches(); assert.equal(before.length, 4, "Preserve legacy UTC parsing, offsets and ISO formats");
    await migration.down(db);
    assert.deepEqual(await matches(), before);
    await migration.up(db);
    assert.deepEqual(await matches(), before);
    assert.equal(Number((await db("visits").where({ link_id: link.id }).count({ n: "id" }).first()).n), dates.length);
  } else {
    // Other engines retain their existing query and migration behavior.
    await migration.down(db); await migration.up(db);
  }
  const count = 16;
  await Promise.all(Array.from({ length: count }, () => visits.add(job)));
  const saved = await db("links").where({ id: link.id }).first();
  assert.equal(Number(saved.visit_count), count);
  const total = await db("visits").where({ link_id: link.id }).sum({ n: "total" }).first();
  assert.equal(Number(total.n), count + (sqlite ? 6 : 0));
  const hour = new Date().toISOString().slice(0, 13).replace("T", " ") + ":00:00";
  assert.equal(Number((await lookup(hour)).total), count, "One serialized hourly aggregate");
  await db("link_tracking").insert({ link_id: link.id, enabled: false, revision: 1 });
  await visits.add(job);
  assert.equal(Number((await db("links").where({ id: link.id }).first()).visit_count), count);
  await db("link_tracking").where({ link_id: link.id }).update({ enabled: true, revision: 2 });
  await visits.add(job);
  assert.equal(Number((await db("links").where({ id: link.id }).first()).visit_count), count, "Stale queued privacy revision is ignored");
  await visits.add({ ...job, tracking_revision: 2 });
  assert.equal(Number((await db("links").where({ id: link.id }).first()).visit_count), count + 1);
  await db("links").where({ id: link.id }).update({ banned: true });
  await visits.add({ ...job, tracking_revision: 2 });
  assert.equal(Number((await db("links").where({ id: link.id }).first()).visit_count), count + 1);
  console.log("PASS: " + db.client.config.client + " hourly query compatibility, retained rows/rollback, concurrent counters, privacy revisions and ban boundaries" + (sqlite ? ", indexed UTC/ISO/offset lookup" : ""));
  await db("visits").where({ link_id: link.id }).del();
  await db("link_tracking").where({ link_id: link.id }).del();
  await db("links").where({ id: link.id }).del();
  await db("users").where({ id: owner.id }).del();
};
