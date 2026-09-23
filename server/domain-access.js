const { randomUUID } = require("node:crypto");
const knex = require("./knex");
const i18n = require("./i18n");
const { CustomError } = require("./utils");
const held = new WeakSet();
const fail = (key, status = 403) => { throw new CustomError(i18n.t(key), status); };

// Acquire before any user/workspace/link lock or snapshot read. One guard avoids
// inverse lock orders in moderation cascades; redirects never acquire it.
async function lock(db) {
  if (!db.isTransaction) throw new Error("Domain authorization writes require a transaction.");
  if (!held.has(db)) {
    await db("domain_access_state").where({ id: 1 }).increment("sequence", 1);
    held.add(db);
  }
}
function available(db, userId) {
  const management = require("./management-origin").configured();
  return db("domains as d").select("d.*").where("d.banned", false)
    .modify(query => { if (management) query.whereNotIn("d.address", [management.host, management.hostname].map(host => host.replace(/^www\./, ""))); })
    .whereExists(db("users as recipient").select("recipient.id").where({ "recipient.id": userId || -1, "recipient.verified": true, "recipient.banned": false }))
    .where(function () {
      this.whereNull("d.user_id").orWhereExists(db("users as owner").select("owner.id")
        .whereColumn("owner.id", "d.user_id").where({ "owner.verified": true, "owner.banned": false }));
    }).where(function () {
      this.where("d.user_id", userId || -1).orWhereExists(db("domain_grants as g").select("g.id")
        .whereColumn("g.domain_id", "d.id").where("g.user_id", userId || -1));
    });
}
function current(db, query) { return db.isTransaction ? query.forUpdate() : query; }
async function find(db, userId, match) {
  if (!userId) return undefined;
  // Locking reads are current reads on MySQL even when an outer caller already
  // established a repeatable-read snapshot before waiting for the guard.
  if (!db.isTransaction || !held.has(db)) return available(db, userId).where(Object.fromEntries(Object.entries(match).map(([key, value]) => ["d." + key, value]))).first();
  const domain = await current(db, db("domains").where({ ...match, banned: false })).first();
  if (!domain || require("./management-origin").reserved(domain.address) || !await current(db, db("users").where({ id: userId, verified: true, banned: false })).first()) return undefined;
  if (domain.user_id && !await current(db, db("users").where({ id: domain.user_id, verified: true, banned: false })).first()) return undefined;
  if (domain.user_id !== userId && !await current(db, db("domain_grants").where({ domain_id: domain.id, user_id: userId })).first()) return undefined;
  return domain;
}
async function requireDomain(db, userId, match) {
  const domain = await find(db, userId, match);
  if (!domain) fail("domain_grants.unavailable");
  return domain;
}
async function link(db, row) {
  if (row.archived_domain) fail("domain_grants.unavailable");
  return row.domain_id == null ? null : requireDomain(db, row.user_id, { id: row.domain_id });
}
async function request(db, req, domainId, scope, ownerId = req.user?.id) {
  let user;
  if (req.user) {
    user = await current(db, db("users").where({ id: req.user.id, verified: true, banned: false })).first();
    if (!user || Number(user.auth_version) !== Number(req.user.auth_version)) fail("messages.sign_in_again", 401);
  }
  if (domainId != null && ownerId !== null) await requireDomain(db, ownerId, { id: domainId });
  if (req.apiToken) {
    const token = await current(db, db("api_tokens").where({ id: req.apiToken, user_id: req.user.id })).first();
    if (!token || token.revoked_at != null || token.expires_at != null && Number(token.expires_at) <= Date.now() ||
        !JSON.parse(token.scopes).includes(scope)) fail("messages.api_token_is_no_longer_authorized");
    const domain = token.domain_scope === "all" || token.domain_scope === "default" ? null :
      await requireDomain(db, req.user.id, { uuid: token.domain_scope });
    if (token.domain_scope !== "all" && (domain?.id ?? null) !== domainId) fail("messages.token_does_not_permit_this_domain");
  }
  return user;
}
async function writeLink(db, req, row, scope) {
  // The caller holds the domain guard. Deletion needs no continuing domain
  // entitlement, but never inherits a stale administrator or token permission.
  const user = await request(db, req, row.domain_id, scope, scope === "links:delete" ? null : row.user_id);
  const administrative = row.user_id !== user?.id || req.user.admin && !req.apiToken;
  if (!user || administrative && (req.apiToken || !await require("./oidc-roles").allowsAdmin(db, user))) {
    fail("messages.administrator_access_is_no_longer_available", 403);
  }
}
async function invalidate(db, domain, userId) {
  const grants = db("domain_grants").where({ domain_id: domain.id });
  if (userId != null) grants.where({ user_id: userId });
  await grants.delete();
  const tokens = db("api_tokens").where({ domain_scope: domain.uuid }).whereNull("revoked_at");
  if (userId != null) tokens.where({ user_id: userId });
  await tokens.update({ revoked_at: Date.now() });
  const links = db("links").select("id").where({ domain_id: domain.id });
  if (userId != null) links.where({ user_id: userId });
  await db("link_health").whereIn("link_id", links).update({ enabled: false, state: "authorization_required",
    next_at: null, lease: null, lease_until: null, revision: db.raw("revision + 1") });
}
async function invalidateUser(db, userId) {
  const domains = await db("domains").where({ user_id: userId });
  for (const domain of domains) await invalidate(db, domain);
  const received = await db("domains as d").join("domain_grants as g", "g.domain_id", "d.id").where("g.user_id", userId).select("d.*");
  for (const domain of received) await invalidate(db, domain, userId);
}
async function manage(db, req, id) {
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) fail("messages.domain_was_not_found", 404);
  const domain = await current(db, db("domains").where({ uuid: id })).first();
  const actor = await current(db, db("users").where({ id: req.user.id, verified: true, banned: false })).first();
  if (!actor || Number(actor.auth_version) !== Number(req.user.auth_version)) fail("messages.sign_in_again", 401);
  const admin = !req.apiToken && await require("./oidc-roles").allowsAdmin(db, actor);
  if (!domain || !admin && domain.user_id !== actor.id) fail("messages.domain_was_not_found", 404);
  if (req.apiToken) await request(db, req, domain.id, "domains:share");
  return domain;
}
async function list(req, id) {
  return knex.transaction(async db => {
    // Keep authorization and recipients in the same ownership epoch. Acquire
    // the shared guard first, as grant/revoke, reassignment and role changes do.
    await lock(db);
    const domain = await manage(db, req, id);
    const rows = await db("domain_grants as g").join("users as u", "u.id", "g.user_id")
      .where("g.domain_id", domain.id).select("g.id", "u.email", "g.created_at").orderBy("u.email");
    return { domain: { id: domain.uuid, address: domain.address, banned: !!domain.banned },
      data: rows.map(row => ({ ...row, created_at: new Date(Number(row.created_at)).toISOString() })) };
  });
}
async function grant(req, id, input) {
  if (!input || typeof input.email !== "string" || input.email.length > 255 || Object.keys(input).some(key => key !== "email")) fail("domain_grants.invalid_recipient", 400);
  return knex.transaction(async db => {
    await lock(db);
    const domain = await manage(db, req, id);
    if (require("./management-origin").reserved(domain.address)) fail("domain_grants.management_reserved", 400);
    if (domain.banned || domain.user_id && !await db("users").where({ id: domain.user_id, verified: true, banned: false }).first()) fail("domain_grants.unavailable");
    const user = await db("users").whereRaw("LOWER(email) = ?", [input.email.trim().toLowerCase()]).where({ verified: true, banned: false }).first();
    if (!user || user.id === domain.user_id) fail("domain_grants.invalid_recipient", 400);
    if (await db("domain_grants").where({ domain_id: domain.id, user_id: user.id }).first()) fail("domain_grants.exists", 409);
    const { n } = await db("domain_grants").where({ domain_id: domain.id }).count("* as n").first();
    const incoming = await db("domain_grants").where({ user_id: user.id }).count("* as n").first();
    if (Number(n) >= 100 || Number(incoming.n) >= 100) fail("domain_grants.limit", 409);
    const row = { id: randomUUID(), domain_id: domain.id, user_id: user.id, granted_by_id: req.user.id, created_at: Date.now() };
    await db("domain_grants").insert(row);
    return { id: row.id, email: user.email, created_at: new Date(row.created_at).toISOString() };
  });
}
async function revoke(req, id, grantId) {
  if (typeof grantId !== "string" || !/^[a-f0-9-]{36}$/i.test(grantId)) fail("domain_grants.not_found", 404);
  return knex.transaction(async db => {
    await lock(db);
    const domain = await manage(db, req, id);
    const row = await db("domain_grants").where({ id: grantId, domain_id: domain.id }).first();
    if (!row) fail("domain_grants.not_found", 404);
    await invalidate(db, domain, row.user_id);
  });
}
module.exports = { lock, available, find, requireDomain, link, request, writeLink, invalidate, invalidateUser, manage, list, grant, revoke };
