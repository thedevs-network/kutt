const assert = require("node:assert/strict");

module.exports = async ({ owner, other, admin, id, denied, allowed }) => {
  const db = require("../server/knex"), policy = require("../server/destination-policy");
  const edit = require("../server/link-expiry-edit");
  const response = { locals: {} };
  try {
    const user = await db("users").where({ id: owner }).first();
    const load = () => db("links").where({ uuid: id }).first();
    const req = () => ({ user: { ...user, admin: false }, body: { target: denied }, isHTML: false });
    let snapshot = await load(), request = req();
    await policy.editTarget(request, response, snapshot); assert(!Object.hasOwn(request.body, "target"));
    await db("links").where({ uuid: id }).update({ target: allowed });
    await edit.save(request, response, snapshot, { ...request.body, description: "Concurrent repair retained" });
    assert.equal((await load()).target, allowed);
    await assert.rejects(require("../server/queries/link.queries").update({ uuid: id }, { target: denied }, { id: owner }), error => error.statusCode === 400);
    await db("links").where({ uuid: id }).update({ target: denied });
    snapshot = await load(); request = req(); await policy.editTarget(request, response, snapshot);
    await db("links").where({ uuid: id }).update({ user_id: other });
    await assert.rejects(edit.save(request, response, snapshot, { description: "No stale-owner write" }), error => error.statusCode === 409);
    assert.notEqual((await load()).description, "No stale-owner write");
    await db("links").where({ uuid: id }).update({ user_id: owner });
    const domainId = Number((await db("domains").insert({ uuid: require("node:crypto").randomUUID(),
      address: "policy-race.example.invalid", user_id: owner }, "id"))[0].id);
    snapshot = await load(); request = { ...req(), apiToken: "test-scoped-token", apiTokenDomain: null };
    await policy.editTarget(request, response, snapshot);
    await db("links").where({ uuid: id }).update({ domain_id: domainId });
    await assert.rejects(edit.save(request, response, snapshot, { description: "No stale-scope write" }), error => error.statusCode === 409);
    await assert.rejects(policy.editTarget({ ...req(), apiToken: "test-scoped-token", apiTokenDomain: null }, response, await load()), error => error.statusCode === 404);
    await db("links").where({ uuid: id }).update({ domain_id: null });
    await db("domains").where({ id: domainId }).delete();
    const administrator = await db("users").where({ id: admin }).first();
    await db("users").where({ id: admin }).update({ role: "USER" });
    await assert.rejects(policy.editTarget({ user: { ...administrator, admin: true }, body: { target: denied } }, response, await load()), error => error.statusCode === 404);
    await db("users").where({ id: admin }).update({ role: administrator.role });
    await db("users").where({ id: owner }).increment("auth_version", 1);
    await assert.rejects(policy.editTarget(req(), response, await load()), error => error.statusCode === 401);
    await db("users").where({ id: owner }).update({ auth_version: user.auth_version });
    console.log("PASS: deterministic repair/ownership/domain-scope interleavings, write-time changed-target denial, stale admin and revoked-session denial");
  } finally { await db.destroy(); }
};
