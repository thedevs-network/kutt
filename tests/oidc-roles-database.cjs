const assert = require("node:assert/strict");
const { randomBytes, createHash } = require("node:crypto");
assert.equal(process.env.KUTT_DATABASE_DISPOSABLE, "1");
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert.equal(process.env.DB_NAME, "kutt_search_regression");
assert(["pg", "mysql2"].includes(process.env.DB_CLIENT));
Object.assign(process.env, { OIDC_ENABLED: "true", OIDC_ISSUER: "https://idp.example.invalid/", OIDC_CLIENT_ID: "fixture",
  OIDC_CLIENT_SECRET: randomBytes(32).toString("hex"), OIDC_ADMIN_MAPPING_ENABLED: "true", OIDC_ADMIN_CLAIM: "roles",
  OIDC_ADMIN_VALUES: '["admin"]', OIDC_BREAK_GLASS_USER_ID: "1", DISALLOW_LOGIN_FORM: "false" });
const db = require("../server/knex");

(async () => {
  assert(!await db.schema.hasTable("users"), "Fresh disposable schema required");
  await db.migrate.latest({ directory: require("node:path").resolve(__dirname, "../server/migrations") });
  const password = await require("bcryptjs").hash(randomBytes(32).toString("hex"), 12);
  for (const id of [1, 2, 3]) await db("users").insert({ email: `role-${id}@example.invalid`, password, role: "ADMIN", verified: true });
  const roles = require("../server/oidc-roles"), tokens = require("../server/api-tokens"), moderation = require("../server/moderation");
  const issuer = process.env.OIDC_ISSUER, subject = "database-subject", identity = createHash("sha256").update(issuer + "\0" + subject).digest("hex");
  await db("oidc_identities").insert({ id: identity, issuer, subject, user_id: 2, created_at: Date.now() });
  await roles.initialize();
  const user = () => db("users").where({ id: 2 }).first();
  assert.equal((await user()).role, "USER"); assert.equal((await db("users").where({ id: 3 }).first()).role, "ADMIN", "Unbound local roles are unchanged");
  let iat = Math.floor(Date.now() / 1000);
  // This test isolates DB transactions; asymmetric protocol validation is in oidc-roles.cjs.
  const apply = role => db.transaction(async transaction => {
    await roles.lock(transaction);
    return roles.apply(transaction, await transaction("users").where({ id: 2 }).first(), identity,
      { iss: issuer, sub: subject, roles: role, iat: iat++, exp: Math.floor(Date.now() / 1000) + 300 }, randomBytes(64).toString("hex"));
  });
  assert.equal((await apply("admin")).user.role, "ADMIN");
  const owner = await user(), issued = await tokens.create(2, { name: "before", scopes: ["links:read"] }, owner.auth_version);
  const users = require("../server/queries/user.queries");
  await assert.rejects(users.create({ email: "blocked@example.invalid", password, role: "ADMIN", verified: true }, owner), /unmanaged local/);
  assert.equal((await users.create({ email: "ordinary@example.invalid", password, role: "USER", verified: true }, owner)).role, "USER");
  const recovery = await db("users").where({ id: 1 }).first();
  assert.equal((await users.create({ email: "allowed@example.invalid", password, role: "ADMIN", verified: true }, recovery)).role, "ADMIN");
  await assert.rejects(moderation.moderate("user", "1", true, owner), /protected local/);
  await assert.rejects(moderation.removeUser(await db("users").where({ id: 1 }).first(), owner, true), /protected local/);
  const race = await Promise.allSettled([tokens.create(2, { name: "race", scopes: ["links:read"] }, owner.auth_version), apply([])]);
  assert.equal(race[1].status, "fulfilled"); assert.equal((await user()).role, "USER");
  assert.equal(await tokens.resolve(issued.token), null);
  if (race[0].status === "fulfilled") assert.equal(await tokens.resolve(race[0].value.token), null);
  assert.equal((await apply("admin")).user.role, "ADMIN");
  const result = await apply({ unsafe: "admin" }); assert.equal(result.error, "OIDC_ROLE_CLAIM_INVALID");
  assert.equal((await user()).role, "USER");
  assert.equal((await apply("admin")).user.role, "ADMIN");
  const access = require("../server/domain-access"), domainUuid = require("node:crypto").randomUUID();
  await db("domains").insert({ uuid: domainUuid, address: "roles-sharing.example.invalid", user_id: 3 });
  const authorizedActor = await user();
  const grant = await access.grant({ user: authorizedActor }, domainUuid, { email: "role-1@example.invalid" });
  await access.revoke({ user: authorizedActor }, domainUuid, grant.id);
  await db("oidc_role_state").where({ user_id: 2 }).update({ active_until: Date.now() - 1 });
  await assert.rejects(access.grant({ user: authorizedActor }, domainUuid, { email: "role-1@example.invalid" }), /not found/,
    "An expired mapped administrator cannot grant using an already authenticated principal");
  assert.equal((await roles.fresh(await user())).role, "USER");
  const av = Number((await user()).auth_version); await roles.initialize(); assert.equal(Number((await user()).auth_version), av, "Identical restart is idempotent");
  await assert.rejects(require("../server/migrations/20260923000000_oidc_roles").down(db), /Preserve OIDC role/);
  await assert.rejects(db("users").where({ id: 1 }).delete(), "Recovery reference protects direct deletion too");
  console.log("PASS: " + process.env.DB_CLIENT + " additive role migration, policy enrollment, unchanged local admins, promotion/demotion, token race, protected recovery, malformed-claim commit, expiry, restart and downgrade guard");
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.destroy());
