const i18n = require("./i18n");
const { createHash, randomBytes, randomUUID } = require("node:crypto");
const knex = require("./knex");
const { CustomError } = require("./utils");

const SCOPES = Object.freeze({
  "domains:share": "domain_grants.token_scope",
  "links:read": "messages.list_links",
  "links:create": "messages.create_links",
  "links:update": "messages.edit_links",
  "links:delete": "messages.delete_links",
  "stats:read": "messages.read_statistics",
  "workspaces:read": "messages.read_joined_workspaces",
  "workspaces:write": "messages.manage_shared_workspace_links",
  "webhooks:read": "messages.read_owner_wide_webhook_configuration_and_deliveries",
  "webhooks:write": "messages.manage_owner_wide_signed_webhooks",
  "events:read": "messages.read_owner_wide_management_events"
});

const hash = value => createHash("sha256").update(value).digest("hex");
const timestamp = value => value == null ? null : new Date(Number(value)).toISOString();

function sanitize(row) {
  return {
    id: row.id, name: row.name, prefix: row.prefix,
    scopes: JSON.parse(row.scopes),
    domain_scope: row.domain_scope,
    created_at: timestamp(row.created_at), expires_at: timestamp(row.expires_at),
    revoked_at: timestamp(row.revoked_at), last_used_at: timestamp(row.last_used_at),
    status: row.revoked_at != null ? "Revoked" :
      row.expires_at != null && Number(row.expires_at) <= Date.now() ? "Expired" : "Active"
  };
}

async function list(userId) {
  const rows = await knex("api_tokens").where({ user_id: userId })
    .orderBy("created_at", "desc").limit(100);
  return rows.map(sanitize);
}

async function create(userId, input, authVersion) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const scopes = typeof input.scopes === "string" ? [input.scopes] : input.scopes;
  if (!name || name.length > 80) throw new CustomError(i18n.t("messages.name_must_be_1_to_80_characters"), 400);
  if (!Array.isArray(scopes) || !scopes.length || scopes.length > Object.keys(SCOPES).length ||
      scopes.some(scope => typeof scope !== "string" || !Object.hasOwn(SCOPES, scope))) {
    throw new CustomError(i18n.t("messages.select_at_least_one_valid_permission"), 400);
  }
  const domainScope = input.domain_scope === undefined ? "all" : input.domain_scope;
  if (typeof domainScope !== "string" || !/^(all|default|[a-f0-9-]{36})$/.test(domainScope)) {
    throw new CustomError(i18n.t("messages.select_a_valid_domain_restriction"), 400);
  }
  if (domainScope !== "all" && domainScope !== "default") {
    const domain = await require("./domain-access").find(knex, userId, { uuid: domainScope });
    if (!domain) throw new CustomError(i18n.t("messages.domain_was_not_found"), 400);
  }
  let expires = null;
  if (input.expires_at != null) {
    if (typeof input.expires_at !== "string" ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(input.expires_at)) {
      throw new CustomError(i18n.t("messages.expiry_must_be_an_iso_8601_utc_date"), 400);
    }
    expires = Date.parse(input.expires_at);
    if (!Number.isFinite(expires) || expires <= Date.now()) {
      throw new CustomError(i18n.t("messages.expiry_must_be_in_the_future"), 400);
    }
  } else if (input.expires_in_days !== undefined) {
    if (!["7", "30", "90", "365", "never"].includes(String(input.expires_in_days))) {
      throw new CustomError(i18n.t("messages.select_a_valid_expiry"), 400);
    }
    if (input.expires_in_days !== "never") expires = Date.now() + Number(input.expires_in_days) * 86400000;
  } else {
    expires = Date.now() + 30 * 86400000;
  }
  // Older releases reject this prefix instead of ignoring the restriction.
  const token = (domainScope === "all" ? "kutt_" : "kutt_d_") + randomBytes(32).toString("base64url");
  const row = {
    id: randomUUID(), user_id: userId, name,
    token_hash: hash(token), prefix: token.slice(0, 13),
    scopes: JSON.stringify([...new Set(scopes)]),
    domain_scope: domainScope,
    created_at: Date.now(), expires_at: expires, revoked_at: null, last_used_at: null
  };
  await knex.transaction(async db => {
    await require("./domain-access").lock(db);
    const owner = await db("users").where({ id: userId }).forUpdate().first();
    if (!owner || owner.banned || !owner.verified || authVersion === undefined || Number(owner.auth_version) !== Number(authVersion)) {
      throw new CustomError(i18n.t("moderation.token_sign_in"), 401);
    }
    if (domainScope !== "all" && domainScope !== "default" &&
        !await require("./domain-access").find(db, userId, { uuid: domainScope })) {
      throw new CustomError(i18n.t("messages.domain_was_not_found"), 400);
    }
    await db("api_tokens").insert(row);
  });
  return { ...sanitize(row), token };
}

async function revoke(userId, id) {
  const row = await knex("api_tokens").where({ id, user_id: userId }).first();
  if (!row) throw new CustomError(i18n.t("messages.token_was_not_found"), 404);
  if (row.revoked_at == null) {
    await knex("api_tokens").where({ id, user_id: userId }).update({ revoked_at: Date.now() });
  }
}

async function resolve(value) {
  if (!/^kutt_(?:d_)?[A-Za-z0-9_-]{43}$/.test(value)) return null;
  const row = await knex("api_tokens").where({ token_hash: hash(value) }).first();
  if (!row || row.revoked_at != null ||
      (row.expires_at != null && Number(row.expires_at) <= Date.now())) return null;
  if (value.length === 50 && row.domain_scope === "all") return null;
  // Bypass the user cache so bans and verification changes apply immediately.
  const original = await knex("users").where({ "users.id": row.user_id })
    .whereExists(db => db.select("api_tokens.id").from("api_tokens")
      .where({ "api_tokens.id": row.id, "api_tokens.token_hash": hash(value) }).whereNull("api_tokens.revoked_at")
      .whereColumn("api_tokens.user_id", "users.id")
      .where(expiry => expiry.whereNull("api_tokens.expires_at").orWhere("api_tokens.expires_at", ">", Date.now())))
    .first();
  const user = await require("./oidc-roles").fresh(original);
  if (!user || user.banned || !user.verified || Number(user.auth_version) !== Number(original.auth_version)) return null;
  let domainId;
  if (row.domain_scope === "default") domainId = null;
  else if (row.domain_scope !== "all") {
    const domain = await require("./domain-access").find(knex, user.id, { uuid: row.domain_scope });
    if (!domain) return null;
    domainId = domain.id;
  }
  return { row, user, domainId };
}

module.exports = { SCOPES, create, list, revoke, resolve };
