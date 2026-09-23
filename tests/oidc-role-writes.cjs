const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes, createHash } = require("node:crypto");

assert(!fs.existsSync(path.join(__dirname, "../.env")), "Disposable checkout required");
const remote = ["mysql2", "pg"].includes(process.env.DB_CLIENT);
if (remote) {
  assert.equal(process.env.KUTT_DATABASE_DISPOSABLE, "1");
  assert.equal(process.env.DB_HOST, "127.0.0.1");
  assert.equal(process.env.DB_NAME, "kutt_search_regression");
}
const directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "kutt-role-writes-"));
const mapping = !process.argv.includes("--mapping-off");
Object.assign(process.env, {
  NODE_ENV: "production", DEFAULT_DOMAIN: "short.example.invalid", NODE_APP_INSTANCE: "1",
  ...(!remote && { DB_CLIENT: "better-sqlite3", DB_FILENAME: path.join(directory, "test.sqlite") }),
  JWT_SECRET: randomBytes(48).toString("hex"), REDIS_ENABLED: "false", MAIL_ENABLED: "false", ENABLE_RATE_LIMIT: "false",
  OIDC_ENABLED: "true", OIDC_ISSUER: "https://idp.example.invalid/", OIDC_CLIENT_ID: "fixture",
  OIDC_CLIENT_SECRET: randomBytes(32).toString("hex"), DISALLOW_LOGIN_FORM: "false",
  OIDC_ADMIN_MAPPING_ENABLED: String(mapping), OIDC_ADMIN_CLAIM: "roles", OIDC_ADMIN_VALUES: '["admin"]',
  OIDC_BREAK_GLASS_USER_ID: "1", DESTINATION_ALLOWED_HOSTS: '["allowed.example.invalid"]'
});
const db = require("../server/knex"), clock = Date.now;
let server;

(async () => {
  assert(!await db.schema.hasTable("users"), "Fresh disposable schema required");
  await db.migrate.latest({ directory: path.join(__dirname, "../server/migrations") });
  const password = await require("bcryptjs").hash(randomBytes(32).toString("hex"), 12);
  for (const id of [1, 2, 3, 4, 5]) await db("users").insert({ id, email: `write-${id}@example.invalid`, password,
    role: id <= 2 ? "ADMIN" : "USER", verified: true });
  const roles = require("../server/oidc-roles"), queries = require("../server/queries");
  const access = require("../server/domain-access"), utils = require("../server/utils");
  const issuer = process.env.OIDC_ISSUER, subject = "write-fixture", identity = createHash("sha256").update(issuer + "\0" + subject).digest("hex");
  if (mapping) await db("oidc_identities").insert({ id: identity, issuer, subject, user_id: 2, created_at: clock() });
  await roles.initialize();
  if (mapping) await db.transaction(async transaction => {
    await roles.lock(transaction);
    const result = await roles.apply(transaction, await transaction("users").where({ id: 2 }).first(), identity,
      { iss: issuer, sub: subject, roles: ["admin"], iat: Math.floor(clock() / 1000) + 1, exp: Math.floor(clock() / 1000) + 300 }, randomBytes(64).toString("hex"));
    assert.equal(result.user.role, "ADMIN");
  });
  const actor = await db("users").where({ id: 2 }).first();
  const state = mapping && await db("oidc_role_state").where({ user_id: 2 }).first();
  const token = user => utils.signToken(user, mapping && user.id === 2 ? { oi: identity, os: "fixture", oa: clock() } : {});
  const session = token(actor);
  const reset = async () => {
    Date.now = clock;
    await db("users").where({ id: actor.id }).update({ role: actor.role, auth_version: actor.auth_version });
    if (mapping) await db("oidc_role_state").where({ user_id: actor.id }).update({ active_until: state.active_until });
  };

  // The real routers/authentication run first. Interleave only when they call the
  // real write wrapper; no test hook or alternate authorization enters production.
  let interleave, hit;
  for (const name of ["update", "remove"]) {
    const original = queries.link[name];
    queries.link[name] = async function (...args) {
      if (interleave) {
        const change = interleave; interleave = null; hit = true;
        await change();
      }
      return original.apply(this, args);
    };
  }
  require("../server/passport");
  const app = require("express")(), locals = require("../server/handlers/locals.handler");
  app.use(require("cookie-parser")()); app.use(require("../server/i18n").middleware);
  app.use(require("express").json()); app.use(require("passport").initialize());
  app.use(locals.isHTML); app.use(locals.config);
  app.use("/api/v2", require("../server/routes").api); app.use("/api", require("../server/routes").api);
  app.use(require("../server/handlers/helpers.handler").error);
  server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
  const origin = "http://127.0.0.1:" + server.address().port;
  const request = async (method, route, credential, body) => {
    const response = await fetch(origin + route, { method, redirect: "manual", signal: AbortSignal.timeout(10000),
      headers: { Cookie: "token=" + credential, Accept: "application/json", "Content-Type": "application/json", Connection: "close" },
      body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await response.text(); return { status: response.status, text };
  };
  let number = 0;
  const create = (userId = 3, domainId = null) => queries.link.create({ user_id: userId, domain_id: domainId,
    address: "role-write-" + ++number, target: "https://denied.example.invalid/stored", description: "unchanged" });
  const failures = [];
  for (const prefix of ["/api", "/api/v2"]) for (const [method, route] of [["PATCH", "/links/"], ["PATCH", "/links/admin/"], ["DELETE", "/links/"]]) {
    for (const reason of [...(mapping ? ["expiry"] : []), "role", "session"]) {
      await reset(); const link = await create(), before = await db("link_history").where({ link_id: link.id }).count("* as n").first();
      hit = false;
      interleave = async () => {
        if (reason === "expiry") {
          Date.now = () => Number(state.active_until) + 1;
          assert.equal(await roles.allowsAdmin(db, await db("users").where({ id: actor.id }).first()), false);
        } else if (reason === "role") await db("users").where({ id: actor.id }).update({ role: "USER" });
        else await db("users").where({ id: actor.id }).increment("auth_version", 1);
      };
      const response = await request(method, prefix + route + link.uuid, session,
        method === "PATCH" ? { target: link.target, description: "must-not-commit" } : undefined);
      Date.now = clock; assert(hit, "The authenticated route reached its write wrapper");
      const row = await db("links").where({ id: link.id }).first();
      const after = await db("link_history").where({ link_id: link.id }).count("* as n").first();
      const denied = [401, 403, 404].includes(response.status) && row.description === link.description && row.deleted_at == null && row.target === link.target && Number(before.n) === Number(after.n);
      console.log(`${denied ? "PASS" : "FAIL"}: ${method} ${prefix}${route}: ${reason}, status=${response.status}, unchanged=${row.description === link.description && row.deleted_at == null}`);
      if (!denied) failures.push(`${method} ${prefix}${route} ${reason}`);
    }
    await reset(); const link = await create();
    const response = await request(method, prefix + route + link.uuid, session,
      method === "PATCH" ? { target: link.target, description: "current-admin" } : undefined);
    assert.equal(response.status, 200, response.text);
  }
  await reset();
  const recovery = await db("users").where({ id: 1 }).first(), owner = await db("users").where({ id: 3 }).first();
  for (const user of [recovery, owner]) {
    const link = await create();
    const response = await request("PATCH", "/api/links/" + link.uuid, token(user), { description: "ordinary-permission" });
    assert.equal(response.status, 200, response.text);
  }
  const shared = await queries.domain.add({ address: "granted.example.invalid", user_id: owner.id });
  const grant = await access.grant({ user: owner }, shared.uuid, { email: "write-4@example.invalid" });
  const recipient = await db("users").where({ id: 4 }).first(), editor = await db("users").where({ id: 5 }).first();
  const link = await create(recipient.id, shared.id);
  assert.equal((await request("PATCH", "/api/links/" + link.uuid, token(recipient), { description: "granted-creator" })).status, 200);
  const workspaces = require("../server/workspaces"), space = await workspaces.create(recipient.id, { name: "Role write controls" });
  const invitation = await workspaces.invite(recipient.id, space.id, { email: editor.email, role: "editor" });
  await workspaces.respond(editor.id, invitation.id, true); await workspaces.share(recipient.id, space.id, link.uuid);
  const edit = async () => workspaces.changeLink(editor.id, space.id, "edit", link.uuid, { description: "collaborator",
    edit_revision: require("../server/workspace-edit").revision(await db("links").where({ id: link.id }).first()) }, { id: editor.id }, { user: editor });
  await edit();
  assert.equal((await db("links").where({ id: link.id }).first()).user_id, recipient.id, "Workspace edits preserve creator ownership");
  await workspaces.membership(recipient.id, space.id, invitation.id, null);
  await assert.rejects(edit(), error => error.statusCode === 404);
  await access.revoke({ user: owner }, shared.uuid, grant.id);
  assert.equal((await request("PATCH", "/api/links/" + link.uuid, token(recipient), { description: "revoked" })).status, 403);
  assert.equal((await request("DELETE", "/api/links/" + link.uuid, token(recipient))).status, 200, "A creator can still trash a link after domain grant revocation");
  console.log("PASS: current mapped/local admins, ordinary owners, granted-domain creators, workspace editors/revocation and creator trash after domain revocation");
  assert.deepEqual(failures, [], "Stale authority must not commit any link or history changes");
  console.log(`PASS: ${process.env.DB_CLIENT}, mapping=${mapping}, both edit routes and delete reauthorize at the write boundary`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  Date.now = clock;
  if (server) await new Promise(resolve => server.close(resolve));
  await db.destroy(); fs.rmSync(directory, { recursive: true, force: true });
});
