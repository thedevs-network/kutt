// Targeted row-locking engine regression, separate from SQLite HTTP coverage.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
assert.equal(process.env.KUTT_DATABASE_DISPOSABLE, "1");
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert(/^kutt_security_/.test(process.env.DB_NAME));
assert(["pg", "mysql2"].includes(process.env.DB_CLIENT));
const knex = require("../server/knex");

(async () => {
  assert.equal(await knex.schema.hasTable("users"), false, "Refuse any initialized database");
  await knex.migrate.latest({ directory: require("node:path").join(__dirname, "../server/migrations") });
  const users = require("../server/queries/user.queries"), domains = require("../server/queries/domain.queries");
  const hooks = require("../server/webhooks"), queue = require("../server/webhook-queue");
  const owners = [];
  for (let i = 0; i < 2; i++) owners.push(await users.add({ email: randomUUID() + "@example.invalid", password: "fixture-not-a-login", verified: true }));
  const address = "racing.example.invalid";
  await knex("domains").insert({ address });
  const before = await knex("domains").where({ address }).first();
  const claimed = await Promise.allSettled(owners.map(user => domains.claim({ address, user })));
  assert.equal(claimed.filter(result => result.status === "fulfilled").length, 1);
  assert.match(claimed.find(result => result.status === "rejected").reason.message, /unavailable/);
  const domain = await knex("domains").where({ address }).first();
  assert.equal(domain.id, before.id); assert.equal(domain.uuid, before.uuid);
  const loser = owners.find(user => user.id !== domain.user_id);
  assert.equal(await domains.release(domain.id, loser.id), null);
  const reqs = [];
  for (const user of owners) {
    const id = randomUUID(), now = Date.now();
    await knex("webhooks").insert({ id, user_id: user.id, name: "Locking fixture", url: "https://example.com/hook", secret: hooks.encrypt("fixture", id), events: '["link.updated"]', enabled: true, revision: 1, auth_version: user.auth_version, created_at: now, updated_at: now });
    reqs.push({ user, params: { id }, body: { revision: 1 } });
  }
  const reset = async () => {
    await knex("management_events").delete();
    await knex("webhook_queue_owners").update({ admitted: 0, window_start: 0, last_served: 0 });
    await knex("webhook_queue_state").where({ id: 1 }).update({ admitted: queue.LIMITS.globalPerMinute - 1, window_start: Date.now() });
  };
  await reset();
  const admission = await Promise.allSettled(reqs.map(req => hooks.test(req)));
  assert.equal(admission.filter(result => result.status === "fulfilled").length, 1);
  assert.match(admission.find(result => result.status === "rejected").reason.message, /capacity/);
  assert.equal(Number((await knex("management_events").count("* as n").first()).n), 1);
  await reset();
  let started, resume;
  const ready = new Promise(resolve => { started = resolve; }), gate = new Promise(resolve => { resume = resolve; });
  const stale = knex.transaction(async db => {
    await db("webhook_queue_state").where({ id: 1 }).first();
    started(); await gate;
    await queue.admit(db, owners[0].id, 1);
  });
  const rejected = assert.rejects(stale, /capacity/);
  await ready; await hooks.test(reqs[1]); resume(); await rejected;
  assert.equal(Number((await knex("webhook_queue_state").where({ id: 1 }).first()).admitted), queue.LIMITS.globalPerMinute);
  await knex("webhook_queue_state").where({ id: 1 }).update({ admitted: 0, window_start: 0 });
  await hooks.test(reqs[0]);
  const first = await hooks.claim(Date.now()), second = await hooks.claim(Date.now());
  assert.notEqual(first.user_id, second.user_id);
  for (const user of owners) {
    await knex("users").where({ id: user.id }).update({ change_email_token: randomUUID(), change_email_address: "pending@example.invalid", change_email_expires: "2099-01-01 00:00:00" });
    await users.update({ id: user.id }, { password: "new-fixture-hash" });
    assert.equal((await knex("users").where({ id: user.id }).first()).change_email_token, null);
  }
  console.log("PASS: " + process.env.DB_CLIENT + " migrations, conditional domain claims, global queue race, stale-snapshot admission, fair leases and recovery invalidation");
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(() => knex.destroy());
