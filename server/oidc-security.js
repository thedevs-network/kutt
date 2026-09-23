const { createHash, randomBytes } = require("node:crypto");
const bcrypt = require("bcryptjs");
const knex = require("./knex");
const env = require("./env");

const hash = value => createHash("sha256").update(value).digest("hex");
const identityKey = (issuer, subject) => hash(issuer + "\0" + subject);
const fail = (code, status = 401) => {
  const error = new (require("./utils").CustomError)(code, status);
  error.authCode = code;
  throw error;
};
const string = (value, max = 255) => typeof value === "string" && value.length > 0 && value.length <= max;

async function identity(issuer, claims, userinfo, verifiedToken) {
  if (!string(claims.sub) || claims.iss !== issuer || userinfo.sub !== claims.sub ||
      (claims.sid !== undefined && !string(claims.sid))) fail("OIDC_IDENTITY_INVALID");
  const id = identityKey(issuer, claims.sub);
  const roles = require("./oidc-roles");
  const result = await knex.transaction(async db => {
    await roles.lock(db);
    const existing = await db("oidc_identities").where({ id }).first();
    if (existing) {
      const user = await db("users").where({ id: existing.user_id }).first();
      if (!user || user.banned || !user.verified) fail("OIDC_ACCOUNT_DENIED");
      return { ...await roles.apply(db, user, id, claims, verifiedToken), id };
    }
    const email = userinfo[env.OIDC_EMAIL_CLAIM];
    if (userinfo.email_verified !== true || !string(email) || !require("validator").isEmail(email)) fail("OIDC_VERIFIED_EMAIL_REQUIRED");
    // Email may be reassigned at the provider. Never auto-link an existing account.
    if (await db("users").whereRaw("lower(email) = ?", [email.toLowerCase()]).first()) fail("OIDC_BINDING_REQUIRED");
    if (!env.OIDC_ALLOW_REGISTRATION) fail("OIDC_REGISTRATION_DISABLED");
    if (roles.policy.enabled && require("./oidc-role-config").decision(roles.policy, claims) === null) fail("OIDC_ROLE_CLAIM_INVALID");
    const password = await bcrypt.hash(randomBytes(48).toString("hex"), 12);
    await db("users").insert({ email, password, role: "USER", verified: true });
    const user = await db("users").where({ email }).first();
    await db("oidc_identities").insert({ id, issuer, subject: claims.sub, user_id: user.id, created_at: Date.now() });
    const mapped = await roles.apply(db, user, id, claims, verifiedToken);
    if (mapped.error) fail(mapped.error); // Do not provision an account from an unusable assertion.
    return { ...mapped, id };
  });
  // A malformed signed role claim must commit an existing account's demotion.
  if (result.error) fail(result.error);
  return result;
}

async function validSession(user, payload) {
  if (Number(payload.av || 0) !== Number(user.auth_version)) return false;
  if (!payload.oi) return true; // Existing local/JWT sessions retain their original expiry.
  if (!env.OIDC_ENABLED || !string(payload.oi, 64) || !Number.isSafeInteger(payload.oa)) return false;
  if (payload.oa > Date.now() + 15000 || Date.now() - payload.oa >= env.OIDC_SESSION_MAX_SECONDS * 1000) return false;
  const bound = await knex("oidc_identities").where({ id: payload.oi, user_id: user.id, issuer: env.OIDC_ISSUER }).first();
  if (!bound) return false;
  const revoked = await knex("oidc_logout_events").where({ issuer: bound.issuer })
    .where("received_at", ">=", payload.oa).where("expires_at", ">", Date.now())
    .where(builder => builder.whereNull("subject").orWhere("subject", bound.subject))
    .where(builder => builder.whereNull("sid").orWhere("sid", payload.os || "")).first();
  return !revoked;
}

async function recordLogout(payload) {
  const event = "http://schemas.openid.net/event/backchannel-logout";
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(payload.iat) || payload.iat < now - 300 || payload.iat > now + 15 ||
      !string(payload.jti) || (!string(payload.sub) && !string(payload.sid)) ||
      (payload.sub !== undefined && !string(payload.sub)) || (payload.sid !== undefined && !string(payload.sid)) ||
      payload.nonce !== undefined || !payload.events || Array.isArray(payload.events) ||
      !Object.hasOwn(payload.events, event) || !payload.events[event] ||
      typeof payload.events[event] !== "object" || Array.isArray(payload.events[event]) ||
      Object.keys(payload.events[event]).length) fail("OIDC_LOGOUT_INVALID", 400);
  await knex.transaction(async db => {
    await require("./oidc-roles").lock(db);
    await db("oidc_logout_events").where("expires_at", "<=", Date.now()).delete();
    const id = hash(payload.iss + "\0" + payload.jti);
    if (await db("oidc_logout_events").where({ id }).first()) return;
    await db("oidc_logout_events").insert({
      id, issuer: payload.iss, subject: payload.sub || null, sid: payload.sid || null,
      received_at: Date.now(), expires_at: Date.now() + 7 * 86400000
    }).onConflict("id").ignore();
    await require("./oidc-roles").logout(db, payload);
  });
}

async function revoke(userId) {
  await knex("users").where({ id: userId }).increment("auth_version", 1).update(require("./account-tokens"));
}

module.exports = { identityKey, identity, validSession, recordLogout, revoke, fail };
