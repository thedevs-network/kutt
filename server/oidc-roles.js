const { createHash } = require("node:crypto");
const knex = require("./knex");
const env = require("./env");
const config = require("./oidc-role-config");
const policy = config.parse(env);

// Use the same first lock as moderation: role changes cannot race the last-admin guard.
async function lock(db) {
  await require("./domain-access").lock(db);
  await db("admin_mutation_state").where({ id: 1 }).increment("sequence", 1);
}

async function protectedId(db = knex) {
  const stored = await db("oidc_role_policy").where({ id: 1 }).first();
  return stored?.protected_user_id || policy.protectedId || null;
}

async function protectedAccount(db, id) {
  if (!id) return false;
  const user = await db("users").where({ id, role: "ADMIN", verified: true, banned: false }).first();
  return !!(user && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password || "") &&
    !await db("oidc_identities").where({ user_id: id }).first() &&
    !await db("oidc_role_state").where({ user_id: id }).first());
}

async function revoke(db, userId, role = "USER") {
  await db("users").where({ id: userId }).increment("auth_version", 1)
    .update({ ...require("./account-tokens"), role, apikey: null });
  await db("api_tokens").where({ user_id: userId }).whereNull("revoked_at").update({ revoked_at: Date.now() });
}

async function reset(db, userId) {
  await revoke(db, userId);
  await db("oidc_role_state").insert({ user_id: userId, policy_hash: policy.fingerprint, decision: "USER" })
    .onConflict("user_id").merge({ identity_id: null, policy_hash: policy.fingerprint, decision: "USER", active_until: 0, sid: null });
}

async function initialize() {
  await knex.transaction(async db => {
    await lock(db);
    const stored = await db("oidc_role_policy").where({ id: 1 }).first();
    if (!policy.enabled && !stored) return;
    if (policy.enabled && !await protectedAccount(db, policy.protectedId)) throw new Error("OIDC_ROLE_BREAK_GLASS_INVALID");
    if (stored?.fingerprint === policy.fingerprint) return;
    const managed = await db("oidc_role_state").select("user_id");
    const bound = policy.enabled ? await db("oidc_identities").select("user_id") : [];
    for (const userId of new Set([...managed, ...bound].map(row => row.user_id))) await reset(db, userId);
    await db("oidc_role_policy").insert({ id: 1, fingerprint: policy.fingerprint,
      protected_user_id: policy.protectedId || stored.protected_user_id, updated_at: Date.now() })
      .onConflict("id").merge();
  });
}

async function ready(db) {
  const stored = await db("oidc_role_policy").where({ id: 1 }).first();
  return !!(stored && stored.fingerprint === policy.fingerprint && await protectedAccount(db, stored.protected_user_id));
}

// Called only inside the verified OIDC callback's transaction, after lock().
async function apply(db, user, identityId, claims, token) {
  if (Number(user.id) === Number(await protectedId(db))) return { error: "OIDC_ROLE_POLICY_INVALID" };
  if (!policy.enabled) {
    const stored = await db("oidc_role_policy").where({ id: 1 }).first();
    if (!stored) return { user };
    if (stored.fingerprint !== policy.fingerprint) return { error: "OIDC_ROLE_POLICY_INVALID" };
    if (!await db("oidc_role_state").where({ user_id: user.id }).first()) await reset(db, user.id);
    return { user: await db("users").where({ id: user.id }).first() };
  }
  if (!await ready(db)) return { error: "OIDC_ROLE_POLICY_INVALID" };
  const now = Date.now();
  const stored = await db("oidc_role_policy").where({ id: 1 }).first();
  const until = Math.min(claims.exp * 1000, (claims.iat + policy.maxAge) * 1000);
  if (!Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || claims.iat * 1000 > now + 15000 ||
      claims.iat < Math.floor(Number(stored.updated_at) / 1000) ||
      !Number.isSafeInteger(until) || until <= now || typeof token !== "string" || token.length > 16384 || !token.length) {
    return { error: "OIDC_ROLE_ASSERTION_INVALID" };
  }
  const state = await db("oidc_role_state").where({ user_id: user.id }).first();
  const decision = config.decision(policy, claims);
  if (state && (claims.iat < Number(state.last_iat) ||
      (decision === "ADMIN" && state.decision === "USER" && claims.iat <= Number(state.last_iat)))) return { error: "OIDC_ROLE_ASSERTION_STALE" };
  const logout = await db("oidc_logout_events").where({ issuer: claims.iss }).where("expires_at", ">", now)
    .where("received_at", ">=", claims.iat * 1000)
    .where(builder => builder.whereNull("subject").orWhere("subject", claims.sub))
    .where(builder => builder.whereNull("sid").orWhere("sid", claims.sid || "")).first();
  if (logout) return { error: "OIDC_ROLE_ASSERTION_STALE" };
  const id = createHash("sha256").update(token).digest("hex");
  await db("oidc_role_assertions").where("expires_at", "<=", now).delete();
  if (await db("oidc_role_assertions").where({ id }).first()) return { error: "OIDC_ROLE_ASSERTION_REPLAY" };
  // Keep anonymous replay hashes through expiry, even if the account is deleted.
  await db("oidc_role_assertions").insert({ id, expires_at: until });
  const role = decision || "USER";
  if (!state || role !== user.role || state.policy_hash !== policy.fingerprint ||
      (role === "ADMIN" && Number(state.active_until) <= now) || decision === null) await revoke(db, user.id, role);
  await db("oidc_role_state").insert({ user_id: user.id, identity_id: identityId, policy_hash: policy.fingerprint,
    decision: role, last_iat: claims.iat, active_until: role === "ADMIN" ? until : 0, sid: claims.sid || null })
    .onConflict("user_id").merge();
  return decision === null ? { error: "OIDC_ROLE_CLAIM_INVALID" } : { user: await db("users").where({ id: user.id }).first() };
}

async function fresh(user) {
  if (!user) return null;
  const state = await knex("oidc_role_state").where({ user_id: user.id }).first();
  if (!state) {
    const stored = await knex("oidc_role_policy").where({ id: 1 }).first();
    if (!policy.enabled && !stored) return user;
    if (Number(user.id) === Number(stored?.protected_user_id || policy.protectedId)) return user;
    if (!await knex("oidc_identities").where({ user_id: user.id }).first()) return user;
  }
  return knex.transaction(async db => {
    await lock(db);
    const current = await db("users").where({ id: user.id }).first();
    if (!current) return null;
    const latest = await db("oidc_role_state").where({ user_id: user.id }).first();
    const validPolicy = await ready(db);
    // A binding introduced by a mismatched CLI/process cannot bypass enrollment.
    if (!latest) {
      await reset(db, user.id);
      return validPolicy ? db("users").where({ id: user.id }).first() : null;
    }
    const validAdmin = policy.enabled && validPolicy && latest.policy_hash === policy.fingerprint &&
      latest.decision === "ADMIN" && Number(latest.active_until) > Date.now();
    if ((current.role === "ADMIN" && !validAdmin) || (latest.decision === "ADMIN" && !validAdmin)) {
      await reset(db, user.id);
      return validPolicy ? db("users").where({ id: user.id }).first() : null;
    }
    // A conflicting process configuration cannot authorize a persisted mapped account.
    return validPolicy ? current : null;
  });
}

async function allowsAdmin(db, user) {
  if (!user || user.role !== "ADMIN") return false;
  const state = await db("oidc_role_state").where({ user_id: user.id }).first();
  return !state || (policy.enabled && state.policy_hash === policy.fingerprint && state.decision === "ADMIN" &&
    Number(state.active_until) > Date.now() && await ready(db));
}

async function canCreateLocalAdmin(user, db = knex) {
  if (!policy.enabled && !await db("oidc_role_policy").where({ id: 1 }).first()) return true;
  return !await db("oidc_role_state").where({ user_id: user.id }).first() &&
    !await db("oidc_identities").where({ user_id: user.id }).first();
}

async function logout(db, claims) {
  const identities = db("oidc_identities").where({ issuer: claims.iss }).select("id");
  if (claims.sub) identities.where({ subject: claims.sub });
  const states = db("oidc_role_state").whereIn("identity_id", identities);
  if (claims.sid) states.where({ sid: claims.sid });
  for (const state of await states) {
    await revoke(db, state.user_id);
    await db("oidc_role_state").where({ user_id: state.user_id }).update({ decision: "USER", active_until: 0,
      last_iat: Math.max(Number(state.last_iat), claims.iat) });
  }
}

async function status() {
  return { enabled: policy.enabled, claim: policy.claim || null, value_count: policy.values?.length || 0,
    protected_user_id: await protectedId(), max_age_seconds: policy.maxAge || null };
}

module.exports = { policy, lock, protectedId, initialize, apply, fresh, allowsAdmin, canCreateLocalAdmin, logout, reset, status };
