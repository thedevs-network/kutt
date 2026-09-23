const i18n = require("./i18n");
const { createHash } = require("node:crypto");
const knex = require("./knex");
const env = require("./env");

const key = (domain, address) => createHash("sha256").update(domain.toLowerCase() + "\0" + address).digest("hex");
const fail = (message, status = 409) => { throw new (require("./utils").CustomError)(message, status); };

async function domainName(db, link) {
  if (link.archived_domain) return link.archived_domain.toLowerCase();
  if (link.domain_id == null) return env.DEFAULT_DOMAIN.toLowerCase();
  const domain = await db("domains").where({ id: link.domain_id }).first();
  if (!domain) fail(i18n.t("messages.the_link_s_domain_is_unavailable"));
  return domain.address.toLowerCase();
}

async function reserved(address, domainId) {
  const domain = await domainName(knex, { domain_id: domainId });
  return !!await knex("link_alias_claims").where({ key: key(domain, address) }).first();
}

async function claim(db, link) {
  const domain = await domainName(db, link);
  const match = { key: key(domain, link.address) };
  await db("link_alias_claims").insert({ ...match, domain, address: link.address, link_uuid: link.uuid })
    .onConflict("key").ignore();
  const row = await db("link_alias_claims").where(match).first();
  // A repeatable-read snapshot can hide the winning concurrent claim.
  if (!row || row.link_uuid !== link.uuid || row.retired_at != null) fail(i18n.t("messages.this_alias_is_in_use_or_permanently_reserved_by_a_previous"));
}

async function record(db, link, action, fields = [], actor = {}) {
  await db("link_history").insert({
    link_id: link.id, actor_id: actor.id || null, source: actor.id ? (actor.apiToken ? "api_token" : "session") : "system",
    action, fields: JSON.stringify(fields), created_at: Date.now()
  });
  await require("./webhooks").record(db, link, action, fields, actor);
}

async function beforeUpdate(db, link, update, actor) {
  const fields = Object.keys(update).filter(field => update[field] !== undefined && update[field] !== link[field]);
  if (!fields.length) return;
  if (fields.includes("address") || fields.includes("domain_id")) {
    const oldDomain = await domainName(db, link);
    const next = { ...link, ...update };
    await claim(db, next);
    if (key(oldDomain, link.address) !== key(await domainName(db, next), next.address)) {
      await db("link_alias_claims").where({ key: key(oldDomain, link.address) }).update({ retired_at: Date.now() });
    }
  }
  // Record field names, not passwords, target query strings or other secret values.
  await record(db, link, "updated", fields.filter(field => field !== "banned_by_id"), actor);
}

async function trash(db, link, actor) {
  if (link.deleted_at != null) return;
  const changed = await db("links").where({ id: link.id }).whereNull("deleted_at").update({ deleted_at: Date.now() });
  if (changed) await record(db, link, "trashed", [], actor);
}

async function restore(id, userId, actor, tokenDomain, request) {
  return knex.transaction(async db => {
    await require("./domain-access").lock(db);
    const link = await db("links").where({ uuid: id, user_id: userId }).first();
    if (!link || (tokenDomain !== undefined && (link.domain_id !== tokenDomain || link.archived_domain))) fail(i18n.t("messages.link_was_not_found"), 404);
    if (link.banned) fail(i18n.t("messages.a_banned_link_cannot_be_restored"));
    let domainId = link.domain_id;
    if (link.domain_id != null || link.archived_domain) {
      const domain = await require("./domain-access").find(db, userId, { address: await domainName(db, link) });
      if (!domain) fail(i18n.t("messages.restore_requires_current_ownership_of_the_original_domain"));
      domainId = domain.id;
    }
    if (request) await require("./domain-access").request(db, request, domainId, "links:update");
    await claim(db, link);
    if (link.deleted_at != null) {
      const changed = await db("links").where({ id: link.id, user_id: userId }).whereNotNull("deleted_at")
        .update({ deleted_at: null, archived_domain: null, domain_id: domainId });
      if (changed) await record(db, link, "restored", [], actor);
    }
    return link;
  });
}

module.exports = { key, domainName, reserved, claim, record, beforeUpdate, trash, restore };
