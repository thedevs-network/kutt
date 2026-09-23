const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");

module.exports = async db => {
  const moderation = require("../server/moderation"), tokens = require("../server/api-tokens");
  const ids = [], links = [];
  const user = async role => {
    const email = randomUUID() + "@example.invalid";
    await db("users").insert({ email, password: "disposable-not-for-login", verified: true, role });
    const row = await db("users").where({ email }).first(); ids.push(row.id); return row;
  };
  try {
    const a = await user("ADMIN"), b = await user("ADMIN"), owner = await user("USER");
    const existingAdmins = await db("users").where({ role: "ADMIN", banned: false, verified: true }).whereNotIn("id", [a.id, b.id]);
    assert.equal(existingAdmins.length, 0, "Fixture requires exactly two disposable administrators");
    const cross = await Promise.allSettled([
      moderation.moderate("user", String(b.id), true, a),
      moderation.moderate("user", String(a.id), true, b)
    ]);
    assert.equal(cross.filter(row => row.status === "fulfilled").length, 1);
    assert.equal(cross.filter(row => row.status === "rejected").length, 1);
    const survivor = await db("users").where({ role: "ADMIN", banned: false, verified: true }).first();
    const removed = survivor.id === a.id ? b : a;
    await assert.rejects(moderation.removeUser(survivor, survivor), /last active administrator/);
    await moderation.moderate("user", String(removed.id), false, survivor);

    const issued = await tokens.create(owner.id, { name: "fixture", scopes: ["links:read"] }, owner.auth_version);
    assert(await tokens.resolve(issued.token));
    const race = await Promise.allSettled([
      tokens.create(owner.id, { name: "racing", scopes: ["links:read"] }, owner.auth_version),
      moderation.moderate("user", String(owner.id), true, survivor)
    ]);
    assert.equal(race[1].status, "fulfilled");
    await moderation.moderate("user", String(owner.id), false, survivor);
    assert.equal(await tokens.resolve(issued.token), null);
    if (race[0].status === "fulfilled") assert.equal(await tokens.resolve(race[0].value.token), null);
    await assert.rejects(tokens.create(owner.id, { name: "stale", scopes: ["links:read"] }, owner.auth_version), /Sign in again/);
    const fresh = await db("users").where({ id: owner.id }).first();
    const newToken = await tokens.create(owner.id, { name: "fresh", scopes: ["links:read"] }, fresh.auth_version);
    assert(await tokens.resolve(newToken.token));

    const uuid = randomUUID(); links.push(uuid);
    await db("links").insert({ uuid, address: "moderation-" + uuid, target: "https://192.0.2.1/", user_id: survivor.id });
    const before = Number((await db("moderation_events").count({ total: "id" }).first()).total);
    await assert.rejects(moderation.moderate("link", uuid, true, survivor, { user: true }), /own account/);
    assert.equal(!!(await db("links").where({ uuid }).first()).banned, false);
    assert.equal(Number((await db("moderation_events").count({ total: "id" }).first()).total), before);
    assert.equal((await db("link_history").join("links", "links.id", "link_history.link_id").where({ "links.uuid": uuid })).length, 0);
    const env = require("../server/env"), redis = require("../server/redis");
    const envModule = require.cache[require.resolve("../server/env")], remove = redis.remove.link;
    let invalidations = 0;
    try {
      envModule.exports = { ...env, REDIS_ENABLED: true };
      redis.remove.link = async () => { if (++invalidations === 1) throw new Error("fixture-cache-unavailable"); };
      const cached = await db("links").where({ uuid }).first();
      await assert.rejects(moderation.moderate("link", uuid, true, survivor), /fixture-cache-unavailable/);
      assert.equal(await require("../server/link-lifecycle").allow(cached), false, "A delayed stale fill cannot bypass the authoritative ban");
      await moderation.moderate("link", uuid, true, survivor);
      assert.equal(invalidations, 2, "An idempotent retry must invalidate again");
    } finally { envModule.exports = env; redis.remove.link = remove; }
    await assert.rejects(require("../server/migrations/20260922000000_moderation").down(db), /Preserve the moderation audit/);
    console.log("PASS: " + db.client.config.client + " moderation concurrency, last administrator, token/ban race, no credential resurrection, rollback and downgrade guard");
  } finally {
    for (const uuid of links) await db("links").where({ uuid }).delete();
    for (const table of ["users", "domains", "links", "hosts"]) await db(table).whereIn("banned_by_id", ids).update({ banned_by_id: null });
    await db("users").whereIn("id", ids).delete();
  }
};
