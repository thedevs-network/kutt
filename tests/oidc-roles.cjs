const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { randomBytes, randomUUID, createHash } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const Database = require("better-sqlite3");
const { SignJWT, generateKeyPair, exportJWK } = require("jose");
const bcrypt = require("bcryptjs");

module.exports = async function ({ root, directory, env, algorithm = "RS256" }) {
  const config = require("../server/oidc-role-config");
  const valid = { OIDC_ADMIN_MAPPING_ENABLED: true, OIDC_ENABLED: true, DISALLOW_LOGIN_FORM: false,
    OIDC_ISSUER: "https://idp.invalid/", OIDC_CLIENT_ID: "client", OIDC_CLIENT_SECRET: "fixture",
    OIDC_ID_TOKEN_SIGNING_ALG: algorithm, OIDC_EMAIL_CLAIM: "email", OIDC_ADMIN_CLAIM: "kutt.roles",
    OIDC_ADMIN_VALUES: '["kutt-admin"]', OIDC_BREAK_GLASS_USER_ID: "1", OIDC_ADMIN_MAX_AGE_SECONDS: 300 };
  const parsed = config.parse(valid);
  for (const patch of [{ OIDC_ADMIN_MAPPING_ENABLED: "false" }, { OIDC_ENABLED: false }, { DISALLOW_LOGIN_FORM: true },
    { OIDC_ADMIN_CLAIM: "email" }, { OIDC_ADMIN_CLAIM: "sub" }, { OIDC_ADMIN_CLAIM: "" }, { OIDC_ADMIN_CLAIM: "roles[0]" },
    { OIDC_ISSUER: "http://idp.invalid/" }, { OIDC_ISSUER: "https://idp.invalid/?x=1" },
    { OIDC_ADMIN_CLAIM: "roles\n" }, { OIDC_BREAK_GLASS_USER_ID: "1\n" },
    { OIDC_ADMIN_VALUES: "admin" }, { OIDC_ADMIN_VALUES: "[]" }, { OIDC_ADMIN_VALUES: '["a","a"]' },
    { OIDC_ADMIN_VALUES: '[1]' }, { OIDC_ADMIN_VALUES: '["\\n"]' }, { OIDC_BREAK_GLASS_USER_ID: "01" },
    { OIDC_BREAK_GLASS_USER_ID: "0" }, { OIDC_BREAK_GLASS_USER_ID: "2147483648" }, { OIDC_ADMIN_MAX_AGE_SECONDS: 301 }]) {
    assert.throws(() => config.parse({ ...valid, ...patch }), /configuration/);
  }
  assert.equal(config.parse({ OIDC_ADMIN_MAPPING_ENABLED: false }).enabled, false);
  assert.equal(config.decision(parsed, { "kutt.roles": "kutt-admin" }), "ADMIN");
  assert.equal(config.decision(parsed, { kutt: { roles: "kutt-admin" } }), "USER", "Dotted claim name is literal");
  for (const value of ["KUTT-ADMIN", " kutt-admin", "kutt-admin ", "kutt-admin-other", []]) assert.equal(config.decision(parsed, { "kutt.roles": value }), "USER");
  for (const value of [null, true, 4, {}, ["kutt-admin", {}], Array(65).fill("kutt-admin")]) assert.equal(config.decision(parsed, { "kutt.roles": value }), null);
  const hbs = require("handlebars").create(), i18n = require("../server/i18n");
  i18n.register(hbs); hbs.registerPartial("header", ""); hbs.registerPartial("footer", "");
  const template = hbs.compile(require("node:fs").readFileSync(path.join(root, "server/views/security.hbs"), "utf8"));
  for (const locale of ["en", "fr", "es"]) i18n.run(locale, () => {
    assert(template({ role_mapping: { enabled: true, claim: "roles", value_count: 1, max_age_seconds: 300,
      protected_user_id: 1234567 } }).includes("<dd>1234567</dd>"), "Recovery IDs are machine identifiers, not localized quantities");
  });

  const pair = await generateKeyPair(algorithm), wrong = await generateKeyPair(algorithm);
  const jwk = { ...await exportJWK(pair.publicKey), kid: "fixture", alg: algorithm, use: "sig" };
  const secret = randomBytes(32).toString("hex"), password = randomBytes(32).toString("hex");
  const codes = new Map();
  let issuer, app, exited, output = "", lastToken, replay, badSignature = false;
  let claims = { sub: "subject-roles", email: "mapped@example.invalid", email_verified: true, sid: "mapped-session", "kutt.roles": ["kutt-admin"] };
  let userinfoRoles = ["kutt-admin"];
  const sign = payload => new SignJWT(payload).setProtectedHeader({ alg: algorithm, kid: "fixture" })
    .setIssuer(payload.iss || issuer).setAudience(payload.aud || "roles-client").setIssuedAt(payload.iat ?? Math.floor(Date.now() / 1000))
    .setExpirationTime(payload.exp ?? Math.floor(Date.now() / 1000) + 300).sign(badSignature ? wrong.privateKey : pair.privateKey);
  const provider = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, issuer); res.setHeader("Content-Type", "application/json");
      if (url.pathname === "/.well-known/openid-configuration") return res.end(JSON.stringify({ issuer,
        authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token", userinfo_endpoint: issuer + "/userinfo",
        jwks_uri: issuer + "/jwks", response_types_supported: ["code"], subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: [algorithm], token_endpoint_auth_methods_supported: ["client_secret_basic"] }));
      if (url.pathname === "/jwks") return res.end(JSON.stringify({ keys: [jwk] }));
      if (url.pathname === "/authorize") {
        assert.equal(url.searchParams.get("code_challenge_method"), "S256");
        const code = randomUUID(); codes.set(code, url.searchParams);
        const callback = new URL(url.searchParams.get("redirect_uri"));
        callback.searchParams.set("code", code); callback.searchParams.set("state", url.searchParams.get("state"));
        return res.writeHead(302, { Location: callback.href }).end();
      }
      if (url.pathname === "/token") {
        let body = ""; for await (const chunk of req) body += chunk;
        const params = new URLSearchParams(body), record = codes.get(params.get("code"));
        assert(record); codes.delete(params.get("code"));
        assert.equal(req.headers.authorization, "Basic " + Buffer.from("roles-client:" + secret).toString("base64"));
        assert.equal(createHash("sha256").update(params.get("code_verifier")).digest("base64url"), record.get("code_challenge"));
        lastToken = replay || await sign({ ...claims, jti: randomUUID(), ...(record.get("nonce") ? { nonce: record.get("nonce") } : {}) });
        return res.end(JSON.stringify({ id_token: lastToken, access_token: "fixture", token_type: "Bearer", expires_in: 300 }));
      }
      if (url.pathname === "/userinfo") return res.end(JSON.stringify({ sub: claims.sub, email: claims.email,
        email_verified: true, "kutt.roles": userinfoRoles }));
      res.writeHead(404).end();
    } catch (error) { output += error.stack; res.writeHead(400).end(); }
  });
  await new Promise(resolve => provider.listen(0, "127.0.0.1", resolve));
  issuer = `http://127.0.0.1:${provider.address().port}`;
  const reserve = http.createServer(); await new Promise(resolve => reserve.listen(0, "127.0.0.1", resolve));
  const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve));
  const base = `http://127.0.0.1:${port}`, filename = path.join(directory, "roles-" + algorithm + ".sqlite");
  const childEnv = { ...env, NODE_ENV: "development", PORT: String(port), DEFAULT_DOMAIN: `127.0.0.1:${port}`,
    DB_FILENAME: filename, OIDC_ENABLED: "true", OIDC_ISSUER: issuer, OIDC_CLIENT_ID: "roles-client", OIDC_CLIENT_SECRET: secret,
    OIDC_ID_TOKEN_SIGNING_ALG: algorithm, OIDC_ADMIN_MAPPING_ENABLED: "true", OIDC_ADMIN_CLAIM: "kutt.roles",
    OIDC_ADMIN_VALUES: '["kutt-admin"]', OIDC_BREAK_GLASS_USER_ID: "1", OIDC_ADMIN_MAX_AGE_SECONDS: "300" };
  const command = (file, args = [], input, overrides = {}) => spawnSync(process.execPath, [path.join(root, file), ...args],
    { cwd: directory, env: { ...childEnv, ...overrides }, input, encoding: "utf8", timeout: 60000 });
  const migrate = command("node_modules/knex/bin/cli.js", ["--knexfile", path.join(root, "knexfile.js"), "migrate:latest"]);
  assert.equal(migrate.status, 0, migrate.stderr);
  const db = new Database(filename);
  const hashed = await bcrypt.hash(password, 12);
  db.prepare("INSERT INTO users(id,email,password,role,verified,apikey) VALUES(?,?,?,?,?,?)").run(1, "recovery@example.invalid", hashed, "ADMIN", 1, null);
  db.prepare("INSERT INTO users(id,email,password,role,verified,apikey) VALUES(?,?,?,?,?,?)").run(2, "mapped@example.invalid", hashed, "ADMIN", 1, "old-legacy");
  const identity = createHash("sha256").update(issuer + "\0subject-roles").digest("hex");
  db.prepare("INSERT INTO oidc_identities(id,issuer,subject,user_id,created_at) VALUES(?,?,?,?,?)").run(identity, issuer, "subject-roles", 2, Date.now());
  const row = () => db.prepare("SELECT * FROM users WHERE id=2").get();
  const state = () => db.prepare("SELECT * FROM oidc_role_state WHERE user_id=2").get();
  async function request(method, pathname, body, jar = new Map(), headers = {}) {
    const response = await fetch(base + pathname, { method, redirect: "manual", signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json", "Content-Type": "application/json", Origin: base,
        Cookie: [...jar].map(([key, value]) => key + "=" + value).join("; "), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body) });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(";")[0], n = pair.indexOf("="); jar.set(pair.slice(0, n), pair.slice(n + 1)); }
    const text = await response.text(); // Drain even intentionally ignored denial bodies (Node/undici keep-alive).
    return { status: response.status, headers: response.headers, text, json: () => JSON.parse(text) };
  }
  async function start(expectFailure = false) {
    output = "";
    app = spawn(process.execPath, [path.join(root, "server/server.js")], { cwd: directory, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    exited = new Promise(resolve => app.once("exit", resolve));
    app.stdout.on("data", chunk => output += chunk); app.stderr.on("data", chunk => output += chunk);
    if (expectFailure) { assert.notEqual(await exited, 0); app = undefined; assert.match(output, /Application initialization failed\..*protected local OIDC recovery administrator/); return; }
    for (let n = 0; n < 100; n++) {
      try { if ((await request("GET", "/api/health")).status === 200) return; } catch {}
      if (app.exitCode !== null) break;
      await delay(100);
    }
    throw new Error("Role fixture startup failed: " + output);
  }
  async function stop() {
    if (!app) return;
    app.kill("SIGTERM");
    if (!await Promise.race([exited.then(() => true), delay(5000).then(() => false)])) { app.kill("SIGKILL"); await exited; }
    app = undefined;
  }
  async function login(fresh = false) {
    if (fresh) { while (Math.floor(Date.now() / 1000) <= Number(state()?.last_iat || 0)) await delay(30); delete claims.iat; }
    const jar = new Map(), init = await request("GET", "/login/oidc", undefined, jar);
    assert.equal(init.status, 302, init.text);
    const authorization = await fetch(init.headers.get("location"), { redirect: "manual" });
    await authorization.text(); assert.equal(authorization.status, 302, output);
    const url = new URL(authorization.headers.get("location"));
    return { jar, result: await request("GET", url.pathname + url.search, undefined, jar, { Accept: "text/html" }) };
  }
  const get = (pathname, jar, headers) => request("GET", pathname, undefined, jar, headers);
  async function credentials(jar) {
    const scoped = await request("POST", "/api/tokens", { name: "role-fixture", scopes: ["links:read"], expires_in_days: 7 }, jar);
    assert.equal(scoped.status, 201, scoped.text);
    const legacy = await request("POST", "/api/auth/apikey", {}, jar); assert.equal(legacy.status, 201, legacy.text);
    return { scoped: scoped.json().token, legacy: legacy.json().apikey, jar: new Map(jar) };
  }
  async function denied(creds) {
    assert.equal((await get("/api/users/admin", creds.jar)).status, 401);
    assert.equal((await get("/api/links", new Map(), { "X-API-Key": creds.scoped })).status, 401);
    assert.equal((await get("/api/links", new Map(), { "X-API-Key": creds.legacy })).status, 401);
    assert.equal(row().role, "USER"); assert.equal(row().apikey, null);
  }
  try {
    await start(); assert.equal(row().role, "USER"); assert.equal(row().auth_version, 1); assert.equal(row().apikey, null);
    const local = await request("POST", "/api/auth/login", { email: "recovery@example.invalid", password });
    assert.equal(local.status, 200, local.text); const recovery = new Map([["token", local.json().token]]);
    const diagnostic = await get("/api/auth/security", recovery); assert.equal(diagnostic.json().role_mapping.enabled, true);
    for (const locale of ["en", "fr", "es"]) {
      const catalog = require("../locales/" + locale + ".json");
      const page = await get("/settings/security", recovery, { Accept: "text/html", "Accept-Language": locale });
      assert.equal(page.status, 200); assert(page.text.includes(catalog["oidc_roles.title"]));
      assert(page.text.includes(catalog["oidc_roles.recovery"])); assert(page.text.includes('lang="' + locale + '"'));
    }
    assert(!diagnostic.text.includes("kutt-admin")); assert.equal(diagnostic.json().role_mapping.protected_user_id, 1);
    const promoted = await login(true); assert.equal(promoted.result.status, 303, promoted.result.text);
    assert.equal(row().role, "ADMIN"); assert.equal((await get("/api/users/admin", promoted.jar)).status, 200);
    const creds = await credentials(promoted.jar);
    assert.equal((await get("/api/users/admin", new Map(), { "X-API-Key": creds.scoped })).status, 403);
    assert.equal((await get("/api/links", new Map(), { "X-API-Key": creds.scoped })).status, 200);
    assert.equal((await request("POST", "/api/users/admin/ban/1", {}, promoted.jar)).status, 409);
    assert.equal((await request("DELETE", "/api/users/admin/1", undefined, promoted.jar)).status, 409);
    const bind = command("scripts/bind-oidc.cjs", [], JSON.stringify([{ issuer, subject: "recovery-sub", user_id: 1 }]));
    assert.notEqual(bind.status, 0); assert.equal(db.prepare("SELECT count(*) AS n FROM oidc_identities WHERE user_id=1").get().n, 0);
    db.prepare("INSERT INTO users(id,email,password,role,verified) VALUES(?,?,?,?,?)").run(3, "late-binding@example.invalid", hashed, "ADMIN", 1);
    const late = await request("POST", "/api/auth/login", { email: "late-binding@example.invalid", password });
    assert.equal(late.status, 200); const lateJar = new Map([["token", late.json().token]]);
    assert.equal(command("scripts/bind-oidc.cjs", [], JSON.stringify([{ issuer, subject: "late-sub", user_id: 3 }]), { OIDC_ADMIN_MAPPING_ENABLED: "false" }).status, 0);
    assert.equal((await get("/api/users/admin", lateJar)).status, 401);
    assert.equal(db.prepare("SELECT role FROM users WHERE id=3").get().role, "USER", "Mismatched CLI cannot create unmanaged OIDC admin");
    const newUser = { email: "created@example.invalid", password, verified: true, role: "ADMIN" };
    assert.equal((await request("POST", "/api/users/admin", newUser, promoted.jar)).status, 403, "Mapped grants cannot mint permanent local administrators");
    assert.equal((await request("POST", "/api/users/admin", { ...newUser, role: "USER" }, promoted.jar)).status, 201);
    assert.equal((await request("POST", "/api/users/admin", { ...newUser, email: "other-local@example.invalid" }, recovery)).status, 201);
    assert.equal((await request("POST", "/api/users/delete", { password }, recovery)).status, 409, "Recovery cannot self-delete");
    const oldAssertion = lastToken;
    delete claims["kutt.roles"]; const missing = await login(true); assert.equal(missing.result.status, 303, missing.result.text);
    await denied(creds); assert.equal((await get("/api/users/admin", missing.jar)).status, 401);
    assert.equal((await get("/api/auth/security", missing.jar)).json().role_mapping, undefined);
    replay = oldAssertion; assert.equal((await login()).result.status, 401); replay = undefined; assert.equal(row().role, "USER");
    claims["kutt.roles"] = ["kutt-admin"]; claims.iat = Number(state().last_iat) - 1;
    assert.equal((await login()).result.status, 401); delete claims.iat;
    let elevated = await login(true); assert.equal(elevated.result.status, 303); const malformedCreds = await credentials(elevated.jar);
    claims["kutt.roles"] = { groups: ["kutt-admin"] };
    assert.equal((await login(true)).result.status, 401); await denied(malformedCreds);
    for (const malformed of [null, true, ["kutt-admin", 1]]) { claims["kutt.roles"] = malformed; assert.equal((await login()).result.status, 401); }
    claims["kutt.roles"] = "KUTT-ADMIN"; assert.equal((await login()).result.status, 303); assert.equal(row().role, "USER");
    const savedClaims = { ...claims }, beforeUsers = db.prepare("SELECT count(*) AS n FROM users").get().n;
    claims = { ...claims, sub: "new-subject", email: "new-role@example.invalid", "kutt.roles": { admin: true } };
    assert.equal((await login()).result.status, 401); assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, beforeUsers);
    claims["kutt.roles"] = "kutt-admin"; assert.equal((await login()).result.status, 303);
    const createdOidc = db.prepare("SELECT id,role FROM users WHERE email=?").get(claims.email);
    assert.equal(createdOidc.role, "ADMIN");
    const consumed = lastToken, assertions = db.prepare("SELECT count(*) AS n FROM oidc_role_assertions").get().n;
    assert.equal((await request("DELETE", "/api/users/admin/" + createdOidc.id, undefined, recovery)).status, 200);
    assert.equal(db.prepare("SELECT count(*) AS n FROM oidc_role_assertions").get().n, assertions, "Deletion cannot erase unexpired replay hashes");
    replay = consumed; assert.equal((await login()).result.status, 401); replay = undefined;
    assert.equal(db.prepare("SELECT count(*) AS n FROM users WHERE email=?").get(claims.email).n, 0);
    claims = savedClaims;
    claims["kutt.roles"] = "kutt-admin";
    badSignature = true; assert.equal((await login(true)).result.status, 401); badSignature = false; assert.equal(row().role, "USER");
    claims.iss = issuer + "/other"; assert.equal((await login()).result.status, 401); delete claims.iss;
    claims.aud = "other-client"; assert.equal((await login()).result.status, 401); delete claims.aud;
    claims.exp = Math.floor(Date.now() / 1000) - 60; assert.equal((await login()).result.status, 401); delete claims.exp;
    elevated = await login(true); assert.equal(elevated.result.status, 303); const replayedToken = lastToken, av = row().auth_version;
    replay = replayedToken; assert.equal((await login()).result.status, 401); replay = undefined; assert.equal(row().auth_version, av);
    // Expiry is persisted and checked even on a local-password cookie or API-only request.
    const localMapped = await request("POST", "/api/auth/login", { email: "mapped@example.invalid", password });
    assert.equal(localMapped.status, 200); const localJar = new Map([["token", localMapped.json().token]]);
    const expiredCreds = await credentials(elevated.jar);
    db.prepare("UPDATE oidc_role_state SET active_until=? WHERE user_id=2").run(Date.now() - 1);
    assert.equal((await get("/api/links", new Map(), { "X-API-Key": expiredCreds.scoped })).status, 401);
    await denied(expiredCreds); assert.equal((await get("/api/users/admin", localJar)).status, 401);
    for (const credential of ["legacy", "cookie", "stream"]) {
      elevated = await login(true); assert.equal(elevated.result.status, 303);
      const expired = await credentials(elevated.jar);
      let stream;
      if (credential === "stream") {
        stream = await fetch(base + "/api/events/stream", { headers: { Cookie: "token=" + elevated.jar.get("token") }, signal: AbortSignal.timeout(10000) });
        assert.equal(stream.status, 200);
      }
      db.prepare("UPDATE oidc_role_state SET active_until=? WHERE user_id=2").run(Date.now() - 1);
      if (stream) assert.match(await stream.text(), /event: revoked/);
      else if (credential === "legacy") assert.equal((await get("/api/links", new Map(), { "X-API-Key": expired.legacy })).status, 401);
      else assert.equal((await get("/api/auth/security", expired.jar)).status, 401);
      await denied(expired);
    }
    elevated = await login(true); assert.equal(elevated.result.status, 303); const logoutCreds = await credentials(elevated.jar);
    const logoutToken = await sign({ sub: claims.sub, sid: claims.sid, jti: randomUUID(), events: { "http://schemas.openid.net/event/backchannel-logout": {} } });
    assert.equal((await request("POST", "/api/auth/oidc/backchannel", { logout_token: logoutToken })).status, 200);
    await denied(logoutCreds); const revokedVersion = row().auth_version;
    assert.equal((await request("POST", "/api/auth/oidc/backchannel", { logout_token: logoutToken })).status, 200);
    assert.equal(row().auth_version, revokedVersion);
    elevated = await login(true); assert.equal(elevated.result.status, 303); const policyCreds = await credentials(elevated.jar);
    await stop(); childEnv.OIDC_ADMIN_VALUES = '["new-admin"]'; await start(); await denied(policyCreds);
    claims["kutt.roles"] = "new-admin"; elevated = await login(true); assert.equal(elevated.result.status, 303);
    const fingerprint = db.prepare("SELECT fingerprint FROM oidc_role_policy WHERE id=1").get().fingerprint;
    db.prepare("UPDATE oidc_role_policy SET fingerprint=? WHERE id=1").run("conflicting-process");
    assert.equal((await get("/api/users/admin", elevated.jar)).status, 401); assert.equal(row().role, "USER");
    assert.equal((await get("/api/users/admin", recovery)).status, 200, "Local recovery stays usable during policy mismatch");
    db.prepare("UPDATE oidc_role_policy SET fingerprint=? WHERE id=1").run(fingerprint);
    elevated = await login(true); assert.equal(elevated.result.status, 303);
    const disabledCreds = await credentials(elevated.jar); await stop(); childEnv.OIDC_ADMIN_MAPPING_ENABLED = "false"; await start();
    await denied(disabledCreds); assert.equal((await get("/api/users/admin", recovery)).status, 200);
    assert.equal((await login(true)).result.status, 303); assert.equal(row().role, "USER", "Disabling never preserves mapped ADMIN");
    const down = command("node_modules/knex/bin/cli.js", ["--knexfile", path.join(root, "knexfile.js"), "migrate:down", "20260923000000_oidc_roles.js"]);
    assert.notEqual(down.status, 0); assert.match(down.stdout + down.stderr, /Preserve OIDC role revocation state/);
    await stop(); childEnv.OIDC_ADMIN_MAPPING_ENABLED = "true";
    db.prepare("UPDATE users SET banned=1 WHERE id=1").run(); await start(true);
    assert(!output.includes(secret) && !output.includes(password));
    console.log(`PASS (${algorithm}): strict role config, real signed PKCE promotion/demotion, missing/malformed/profile-only claims, replay/order/signature/issuer/audience/expiry denial, session/key freshness, protected recovery, logout, policy/off revocation and guarded migration`);
  } finally { await stop(); db.close(); await new Promise(resolve => provider.close(resolve)); }
};

if (require.main === module) {
  const fs = require("node:fs");
  const root = path.resolve(__dirname, ".."), directory = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "kutt-oidc-roles-"));
  assert(!fs.existsSync(path.join(root, ".env")), "Isolated checkout required");
  const env = { PATH: process.env.PATH, NODE_APP_INSTANCE: "1", DB_CLIENT: "better-sqlite3", JWT_SECRET: randomBytes(48).toString("hex"),
    REDIS_ENABLED: "false", MAIL_ENABLED: "false", DISALLOW_ANONYMOUS_LINKS: "true", DISALLOW_REGISTRATION: "true",
    DISALLOW_LOGIN_FORM: "false", ENABLE_RATE_LIMIT: "false", TRUST_PROXY: "false" };
  const algorithm = process.argv[2] || "RS256";
  module.exports({ root, directory, env, algorithm }).catch(error => { console.error(error); process.exitCode = 1; })
    .finally(() => fs.rmSync(directory, { recursive: true, force: true }));
}
