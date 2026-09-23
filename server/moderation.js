const i18n = require("./i18n");
const dns = require("node:dns/promises");
const knex = require("./knex");
const utils = require("./utils");
const { ROLES } = require("./consts");
const tables = Object.freeze({ user: "users", domain: "domains", link: "links", host: "hosts" });
const fail = (message, status = 409) => { throw new utils.CustomError(message, status); };

function identity(entity, id) {
  if (!Object.hasOwn(tables, entity) || typeof id !== "string" ||
      !(entity === "link" ? /^[a-f0-9-]{36}$/i : /^[1-9]\d{0,14}$/).test(id)) {
    fail(i18n.t("moderation.invalid_target"), 400);
  }
  return { [entity === "link" ? "uuid" : "id"]: id };
}

function flags(entity, input = {}) {
  const allowed = { user: ["links", "domains"], domain: ["links", "user"], link: ["host", "domain", "user", "userLinks"], host: [] }[entity];
  if (!allowed || !input || Array.isArray(input) || Object.keys(input).some(key => !allowed.includes(key))) fail(i18n.t("moderation.invalid_option"), 400);
  return Object.fromEntries(allowed.map(key => {
    const value = input[key];
    if (![undefined, null, true, false, "true", "false", "on", "1", "0", 1, 0].includes(value)) fail(i18n.t("moderation.boolean_options"), 400);
    return [key, [true, "true", "on", "1", 1].includes(value)];
  }));
}

// Serialize administrative removals/bans so two administrators cannot remove
// the final active administrator concurrently, including on SQLite.
async function lock(db, actor, admin = true) {
  await require("./domain-access").lock(db);
  await db("admin_mutation_state").where({ id: 1 }).increment("sequence", 1);
  const current = actor && await db("users").where({ id: actor.id }).forUpdate().first();
  if (!current || current.banned || !current.verified || Number(current.auth_version) !== Number(actor.auth_version) ||
      (admin && !await require("./oidc-roles").allowsAdmin(db, current))) fail(i18n.t("moderation.sign_in"), 403);
  return current;
}

async function protectAdmin(db, row, actor) {
  if (Number(row.id) === Number(await require("./oidc-roles").protectedId(db))) fail(i18n.t("oidc_roles.protected_account"));
  if (Number(row.id) === Number(actor.id)) fail(i18n.t("moderation.self_protected"));
  if (row.role === ROLES.ADMIN && !row.banned && row.verified) {
    const count = await db("users").where({ role: ROLES.ADMIN, banned: false, verified: true }).count({ total: "id" }).first();
    if (Number(count.total) <= 1) fail(i18n.t("moderation.last_admin"));
  }
}

async function audit(db, entity, row, action, actor) {
  await db("moderation_events").insert({ actor_id: actor.id, entity, entity_id: String(entity === "link" ? row.uuid : row.id), action, created_at: Date.now() });
}

async function invalidate(changed) {
  const redis = require("./redis");
  if (!require("./env").REDIS_ENABLED) return;
  await Promise.all(changed.map(({ entity, row }) => redis.remove[entity](row)));
}

async function apply(db, entity, row, banned, actor, changed) {
  // A retry after a committed mutation must retry failed cache invalidation.
  changed.push({ entity, row });
  if (!!row.banned === banned) return;
  if (entity === "user" && banned) await protectAdmin(db, row, actor);
  if (banned && entity === "domain") await require("./domain-access").invalidate(db, row);
  if (banned && entity === "user") await require("./domain-access").invalidateUser(db, row.id);
  const update = { banned, banned_by_id: banned ? actor.id : null, updated_at: utils.dateToUTC(new Date()) };
  if (entity === "user") {
    Object.assign(update, require("./account-tokens"), { apikey: null, auth_version: Number(row.auth_version) + 1 });
    await db("api_tokens").where({ user_id: row.id }).whereNull("revoked_at").update({ revoked_at: Date.now() });
  }
  if (entity === "link") await require("./link-history").beforeUpdate(db, row, update, actor);
  await db(tables[entity]).where({ id: row.id }).update(update);
  await audit(db, entity, row, banned ? "ban" : "unban", actor);
}

async function moderate(entity, id, banned, actor, input = {}) {
  const match = identity(entity, id), options = flags(entity, input);
  if (typeof banned !== "boolean") fail(i18n.t("moderation.invalid_action"), 400);
  if (!banned && Object.values(options).some(Boolean)) fail(i18n.t("moderation.no_cascade"), 400);
  // DNS is external and may fail or stall. Resolve it before any database write.
  let observed, host;
  if (entity === "link" && options.host) {
    observed = await knex("links").where(match).first();
    if (!observed) fail(i18n.t("moderation.not_found"), 404);
    let timeout;
    try {
      host = (await Promise.race([
        dns.lookup(utils.removeWww(new URL(observed.target).hostname)),
        new Promise((resolve, reject) => { timeout = setTimeout(() => reject(new Error("DNS timeout")), 3000); })
      ])).address;
    } catch { fail(i18n.t("moderation.dns_unchanged"), 400); }
    finally { clearTimeout(timeout); }
  }
  const changed = [];
  const result = await knex.transaction(async db => {
    await lock(db, actor);
    const row = await db(tables[entity]).where(match).forUpdate().first();
    if (!row) fail(i18n.t("moderation.not_found"), 404);
    if (observed && observed.target !== row.target) fail(i18n.t("moderation.destination_changed"));
    const applyRows = async (kind, predicate) => {
      const rows = await db(tables[kind]).where(predicate).orderBy("id").forUpdate();
      for (const child of rows) await apply(db, kind, child, true, actor, changed);
    };
    await apply(db, entity, row, banned, actor, changed);
    if (banned) {
      if (entity === "user") {
        if (options.links) await applyRows("link", { user_id: row.id });
        if (options.domains) await applyRows("domain", { user_id: row.id });
      } else if (entity === "domain") {
        if (options.user && row.user_id) await applyRows("user", { id: row.user_id });
        if (options.links) await applyRows("link", { domain_id: row.id });
      } else if (entity === "link") {
        if (options.user && row.user_id) await applyRows("user", { id: row.user_id });
        if (options.userLinks && row.user_id) await applyRows("link", { user_id: row.user_id });
        for (const [kind, address] of [["domain", options.domain && utils.removeWww(new URL(row.target).hostname)], ["host", host]]) {
          if (!address) continue;
          // A destination ban must never replace a claimed domain's owner or homepage.
          await db(tables[kind]).insert({ address: address.toLowerCase(), banned: false }).onConflict("address").ignore();
          await applyRows(kind, { address: address.toLowerCase() });
        }
      }
    }
    return row;
  });
  await invalidate(changed);
  return result;
}

async function removeUser(user, actor = user, administrative = false) {
  const changed = [];
  const result = await knex.transaction(async db => {
    await lock(db, actor, administrative);
    const row = await db("users").where({ id: user.id }).forUpdate().first();
    if (!row) fail(i18n.t("moderation.user_not_found"), 404);
    if (!administrative && Number(row.id) !== Number(actor.id)) fail(i18n.t("messages.unauthorized"), 403);
    // Self-service deletion may remove an administrator only when another remains.
    await protectAdmin(db, row, administrative ? actor : { id: -1 });
    await require("./domain-access").invalidateUser(db, row.id);
    if (await db("workspaces").where({ owner_id: row.id }).first()) fail(i18n.t("messages.close_owned_workspaces_before_deleting_this_account_shared_links_must_remain"));
    changed.push({ entity: "user", row });
    for (const link of await db("links").where({ user_id: row.id })) changed.push({ entity: "link", row: link });
    for (const domain of await db("domains").where({ user_id: row.id })) changed.push({ entity: "domain", row: domain });
    await audit(db, "user", row, "delete", actor);
    // Old foreign keys do not SET NULL. Preserve bans without retaining a
    // deleted administrator solely as their attribution; the audit keeps IDs.
    for (const table of Object.values(tables)) await db(table).where({ banned_by_id: row.id }).update({ banned_by_id: null });
    return db("users").where({ id: row.id }).delete();
  });
  await invalidate(changed);
  return !!result;
}

async function addDomain(input, actor) {
  const address = input.address.toLowerCase(), changed = [];
  if (require("./management-origin").reserved(address)) fail(i18n.t("domain_grants.management_reserved"), 400);
  const result = await knex.transaction(async db => {
    await lock(db, actor);
    if (await db("domains").where({ address }).first()) fail(i18n.t("moderation.domain_exists"));
    try { await db("domains").insert({ address, homepage: input.homepage || null, banned: false }); }
    catch (error) {
      if (["23505", "ER_DUP_ENTRY", "SQLITE_CONSTRAINT_UNIQUE"].includes(error.code)) fail(i18n.t("moderation.domain_exists"));
      throw error;
    }
    const row = await db("domains").where({ address }).first();
    if (input.banned === true) await apply(db, "domain", row, true, actor, changed);
    return row;
  });
  await invalidate(changed);
  return result;
}

function options(req) {
  const input = { ...req.body };
  if (req.authMethod === "localapikey" && typeof input.apikey === "string") delete input.apikey;
  return input;
}

module.exports = { moderate, removeUser, addDomain, identity, flags, lock, protectAdmin, options };
