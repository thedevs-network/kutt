const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { randomBytes, randomUUID, createHash } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const Database = require("better-sqlite3");
const { SignJWT, generateKeyPair, exportJWK } = require("jose");

module.exports = async function ({ root, directory, env, algorithm = "RS256", management = false }) {
  const { privateKey, publicKey } = await generateKeyPair(algorithm);
  const jwk = { ...await exportJWK(publicKey), kid: "test", alg: algorithm, use: "sig" };
  const alternate = algorithm === "ES256" ? "RS256" : "ES256";
  const otherKey = await generateKeyPair(alternate);
  const otherJwk = { ...await exportJWK(otherKey.publicKey), kid: "other", alg: alternate, use: "sig" };
  const unknownKey = await generateKeyPair(algorithm);
  let signingAlgorithm = algorithm;
  let useUnknownKey = false;
  const codes = new Map();
  let unavailable = false;
  let profile = { sub: "stable-subject", email: "oidc@example.com", email_verified: true, sid: "session-a" };
  let issuer, app, processExit, output = "";
  const clientSecret = randomBytes(32).toString("hex");
  const sign = payload => new SignJWT(payload).setProtectedHeader({ alg: signingAlgorithm, kid: signingAlgorithm === algorithm ? "test" : "other" })
    .setIssuer(payload.iss ?? issuer).setAudience(payload.aud ?? "test-client").setIssuedAt(payload.iat ?? Math.floor(Date.now() / 1000)).setExpirationTime("5m")
    .sign(useUnknownKey ? unknownKey.privateKey : signingAlgorithm === "HS256" ? Buffer.from(clientSecret) : signingAlgorithm === algorithm ? privateKey : otherKey.privateKey);
  const provider = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, issuer);
      res.setHeader("Content-Type", "application/json");
      if (unavailable) return res.writeHead(503).end();
      if (url.pathname === "/.well-known/openid-configuration") return res.end(JSON.stringify({
        issuer, authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token",
        userinfo_endpoint: issuer + "/userinfo", jwks_uri: issuer + "/jwks", response_types_supported: ["code"],
        subject_types_supported: ["public"], id_token_signing_alg_values_supported: [algorithm, alternate],
        token_endpoint_auth_methods_supported: ["client_secret_basic"], code_challenge_methods_supported: ["S256"]
      }));
      if (url.pathname === "/jwks") return res.end(JSON.stringify({ keys: [jwk, otherJwk] }));
      if (url.pathname === "/authorize") {
        assert.equal(url.searchParams.get("redirect_uri"), (management ? `http://localhost:${port}` : base) + "/login/oidc");
        assert.equal(url.searchParams.get("code_challenge_method"), "S256");
        const code = randomUUID();
        codes.set(code, { params: url.searchParams, profile: { ...profile } });
        const callback = new URL(url.searchParams.get("redirect_uri"));
        callback.searchParams.set("code", code); callback.searchParams.set("state", url.searchParams.get("state"));
        res.writeHead(302, { Location: callback.href }); return res.end();
      }
      if (url.pathname === "/token") {
        let body = ""; for await (const data of req) body += data;
        const values = new URLSearchParams(body), record = codes.get(values.get("code"));
        assert(record); codes.delete(values.get("code"));
        assert.equal(req.headers.authorization, "Basic " + Buffer.from("test-client:" + clientSecret).toString("base64"));
        assert.equal(createHash("sha256").update(values.get("code_verifier")).digest("base64url"), record.params.get("code_challenge"));
        const claims = { ...record.profile, ...(record.params.get("nonce") ? { nonce: record.params.get("nonce") } : {}) };
        return res.end(JSON.stringify({ access_token: Buffer.from(JSON.stringify(record.profile)).toString("base64url"), token_type: "Bearer", expires_in: 300,
          id_token: await sign(claims) }));
      }
      if (url.pathname === "/userinfo") return res.end(Buffer.from(req.headers.authorization.split(" ")[1], "base64url").toString());
      res.writeHead(404).end();
    } catch (error) { output += error.stack; res.writeHead(400).end(JSON.stringify({ error: "invalid_request" })); }
  });
  await new Promise(resolve => provider.listen(0, "127.0.0.1", resolve));
  issuer = `http://127.0.0.1:${provider.address().port}`;
  const reserve = http.createServer();
  await new Promise(resolve => reserve.listen(0, "127.0.0.1", resolve));
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const base = `http://${management ? "localhost" : "127.0.0.1"}:${port}`;
  const filename = path.join(directory, "oidc-" + algorithm + (management ? "-management" : "") + ".sqlite");
  const childEnv = { ...env, NODE_ENV: "development", PORT: String(port), DEFAULT_DOMAIN: `127.0.0.1:${port}`,
    MANAGEMENT_ORIGIN: management ? `http://localhost:${port}` : "",
    DB_FILENAME: filename, OIDC_ENABLED: "true", OIDC_ISSUER: issuer, OIDC_CLIENT_ID: "test-client", OIDC_CLIENT_SECRET: clientSecret,
    ...(algorithm !== "RS256" ? { OIDC_ID_TOKEN_SIGNING_ALG: algorithm } : {}) };
  const migrate = spawnSync(process.execPath, [path.join(root, "node_modules/knex/bin/cli.js"), "--knexfile", path.join(root, "knexfile.js"), "migrate:latest"],
    { cwd: directory, env: childEnv, encoding: "utf8", timeout: 60000 });
  assert.equal(migrate.status, 0, migrate.stderr);
  const db = new Database(filename);
  const jar = new Map();
  async function request(method, pathname, body, cookies = jar, extra = {}, publicHost = false) {
    const response = await fetch((publicHost ? `http://127.0.0.1:${port}` : base) + pathname, { method, redirect: "manual", signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json", "Content-Type": "application/json", Cookie: [...cookies].map(([key, value]) => key + "=" + value).join("; "), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body) });
    for (const cookie of response.headers.getSetCookie()) {
      if (management) assert(!/Domain=/i.test(cookie), "Split-origin OIDC cookies remain host-only");
      const [pair] = cookie.split(";"); const index = pair.indexOf("="); cookies.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return response;
  }
  async function start() {
    app = spawn(process.execPath, [path.join(root, "server/server.js")], { cwd: directory, env: childEnv, stdio: ["ignore", "pipe", "pipe"] });
    processExit = new Promise(resolve => app.once("exit", resolve));
    app.stdout.on("data", data => output += data); app.stderr.on("data", data => output += data);
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await request("GET", "/api/health")).status === 200) return; } catch {}
      await delay(100);
    }
    throw new Error("OIDC test server failed to start: " + output);
  }
  async function stop() {
    if (!app) return;
    app.kill("SIGTERM");
    if (await Promise.race([processExit.then(() => true), delay(5000).then(() => false)]) === false) { app.kill("SIGKILL"); await processExit; }
    app = undefined;
  }
  async function login(cookies = new Map(), mutateCallback = () => {}) {
    const initiation = await request("GET", "/login/oidc", undefined, cookies);
    assert.equal(initiation.status, 302, await initiation.text());
    const authorization = await fetch(initiation.headers.get("location"), { redirect: "manual" });
    assert.equal(authorization.status, 302, output);
    const callback = new URL(authorization.headers.get("location"));
    mutateCallback(callback);
    const result = await request("GET", callback.pathname + callback.search, undefined, cookies, { Accept: "text/html" });
    return { result, cookies };
  }
  const logout = async overrides => request("POST", "/api/auth/oidc/backchannel", { logout_token: await sign({
    sub: "stable-subject", sid: "session-a", jti: randomUUID(), events: { "http://schemas.openid.net/event/backchannel-logout": {} }, ...overrides
  }) }, new Map());
  try {
    await start();
    const adminResponse = await request("POST", "/api/auth/create-admin", { email: "admin-oidc@example.com", password: randomBytes(32).toString("hex") });
    assert.equal(adminResponse.status, 201);
    jar.set("token", (await adminResponse.json()).token);
    assert.equal((await request("GET", "/api/auth/security", undefined, new Map())).status, 401);
    for (const unexpected of [alternate, "HS256"]) {
      signingAlgorithm = unexpected;
      assert.equal((await login()).result.status, 401, "Reject unexpected ID token signature " + unexpected);
    }
    signingAlgorithm = algorithm;
    useUnknownKey = true;
    assert.equal((await login()).result.status, 401, "Unknown signing key must not create a session");
    useUnknownKey = false;
    assert.equal(db.prepare("SELECT count(*) AS n FROM oidc_identities").get().n, 0);
    const first = await login();
    assert.equal(first.result.status, 303, await first.result.text());
    assert.equal(first.result.headers.get("location"), "/");
    assert.equal((await request("GET", "/api/links", undefined, first.cookies)).status, 200);
    assert.equal((await login(new Map(), callback => callback.searchParams.set("state", "wrong-state"))).result.status, 401);
    const account = db.prepare("SELECT * FROM users WHERE email = ?").get(profile.email);
    assert.equal(account.role, "USER"); assert.match(account.password, /^\$2/);
    const originalId = account.id;
    const publicLink = await request("POST", "/api/links", { customurl: "oidc-public", target: "https://example.com/" }, first.cookies);
    assert.equal(publicLink.status, 201);
    profile = { ...profile, email: "changed@example.com", sid: "session-b" };
    const second = await login();
    assert.equal(second.result.status, 303, await second.result.text());
    assert.equal(second.result.headers.get("location"), "/");
    assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 2, "Email changes must not create another account");
    assert.equal(db.prepare("SELECT user_id FROM oidc_identities").get().user_id, originalId);
    assert.equal((await request("GET", "/api/auth/security", undefined, second.cookies)).status, 200);
    const details = await (await request("GET", "/api/auth/security", undefined, second.cookies)).json();
    assert(!details.provider, "Only administrators see provider diagnostics");
    profile = { ...profile, sub: "reassigned", email: "oidc@example.com" };
    const reassigned = await login();
    assert.equal(reassigned.result.status, 401, "Existing email must not be auto-linked");
    assert.equal((await request("GET", "/api/links", undefined, reassigned.cookies)).status, 401);
    assert.equal(db.prepare("SELECT count(*) AS n FROM oidc_identities").get().n, 1);
    profile = { ...profile, email: "unverified@example.com", email_verified: false };
    assert.equal((await login()).result.status, 401);
    assert.equal(db.prepare("SELECT count(*) AS n FROM users").get().n, 2);
    profile = { ...profile, email: "oidc@example.com", email_verified: true };
    const oldSessionAttempt = await login(new Map(first.cookies));
    assert.equal(oldSessionAttempt.result.status, 401, "An existing cookie must not skip callback validation");
    profile = { ...profile, email: "unverified@example.com", email_verified: false };
    assert.equal((await login()).result.status, 401);
    const diagnostics = await (await request("GET", "/api/auth/security")).json();
    assert.equal(diagnostics.provider.last_auth_error, "OIDC_VERIFIED_EMAIL_REQUIRED");
    assert(!JSON.stringify(diagnostics).includes(clientSecret));
    for (const unexpected of [alternate, "HS256"]) {
      signingAlgorithm = unexpected;
      assert.equal((await logout({})).status, 400, "Reject unexpected logout signature " + unexpected);
      assert.equal((await request("GET", "/api/links", undefined, second.cookies)).status, 200);
    }
    signingAlgorithm = algorithm;
    useUnknownKey = true;
    assert.equal((await logout({})).status, 400, "Unknown signing key must not revoke sessions");
    useUnknownKey = false;
    const tampered = (await sign({ sub: "stable-subject", sid: "session-b", jti: randomUUID(), events: { "http://schemas.openid.net/event/backchannel-logout": {} } })).split(".");
    tampered[2] = (tampered[2][0] === "A" ? "B" : "A") + tampered[2].slice(1);
    assert.equal((await request("POST", "/api/auth/oidc/backchannel", { logout_token: tampered.join(".") }, new Map())).status, 400);
    assert.equal(db.prepare("SELECT count(*) AS n FROM oidc_logout_events").get().n, 0);
    assert.equal((await request("GET", "/api/links", undefined, second.cookies)).status, 200);
    for (const overrides of [{ nonce: "no" }, { events: {} }, { sub: "", sid: "" }, { iat: 1 },
      { jti: "" }, { jti: undefined }, { aud: "other-client" }, { iss: issuer + "/other" },
      { events: { "http://schemas.openid.net/event/backchannel-logout": [] } }]) {
      assert.equal((await logout(overrides)).status, 400);
    }
    const unsigned = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url") + "." + Buffer.from("{}").toString("base64url") + ".";
    assert.equal((await request("POST", "/api/auth/oidc/backchannel", { logout_token: unsigned }, new Map())).status, 400);
    assert.equal((await request("POST", "/api/auth/oidc/backchannel", { logout_token: "invalid" }, new Map())).status, 400);
    const replay = { jti: randomUUID() };
    assert.equal((await logout(replay)).status, 200);
    const received = db.prepare("SELECT received_at FROM oidc_logout_events").get().received_at;
    assert.equal((await logout(replay)).status, 200);
    assert.equal(db.prepare("SELECT count(*) AS n FROM oidc_logout_events").get().n, 1);
    assert.equal(db.prepare("SELECT received_at FROM oidc_logout_events").get().received_at, received, "Replay must not extend revocation");
    assert.equal((await request("GET", "/api/links", undefined, first.cookies)).status, 401);
    assert.equal((await request("GET", "/api/links", undefined, second.cookies)).status, 200, "SID-specific logout must preserve other sessions");
    await stop(); await start();
    assert.equal((await request("GET", "/api/links", undefined, first.cookies)).status, 401, "Logout survives restart");
    assert.equal((await request("GET", "/api/links", undefined, second.cookies)).status, 200);
    const jwt = require("jsonwebtoken"), oldPayload = jwt.decode(second.cookies.get("token"));
    for (const oa of [Date.now() - 3600001, Date.now() + 60000]) {
      const expired = new Map([["token", jwt.sign({ ...oldPayload, oa, exp: Math.floor(Date.now() / 1000) + 500 }, childEnv.JWT_SECRET)]]);
      assert.equal((await request("GET", "/api/links", undefined, expired)).status, 401, "Absolute OIDC lifetime cannot be extended by JWT renewal");
    }
    const tokenResponse = await request("POST", "/api/tokens", { name: "Independent API", scopes: ["links:read"] }, second.cookies);
    assert.equal(tokenResponse.status, 201);
    const apiKey = (await tokenResponse.json()).token;
    assert.equal((await request("POST", "/api/auth/revoke-sessions", {}, second.cookies, { Origin: "https://evil.example" })).status, 403);
    assert.equal((await request("POST", "/api/auth/revoke-sessions", {}, second.cookies, { "X-API-Key": apiKey })).status, 403);
    const copied = new Map(second.cookies);
    assert.equal((await request("POST", "/api/auth/revoke-sessions", {}, second.cookies)).status, 204);
    assert.equal((await request("GET", "/api/links", undefined, copied)).status, 401);
    assert.equal((await request("GET", "/api/links", undefined, new Map(), { "X-API-Key": apiKey })).status, 200);
    assert.equal((await request("GET", "/api/auth/security")).status, 200, "Other accounts must remain signed in");

    // A failed discovery must not disable public redirects or need a restart to recover.
    await stop(); unavailable = true; await start();
    assert.equal((await request("GET", "/login/oidc", undefined, new Map(), { Accept: "text/html" })).status, 503);
    assert.equal((await request("GET", "/oidc-public", undefined, new Map(), {}, true)).status, 302);
    unavailable = false; await delay(10100);
    profile = { sub: "stable-subject", email: "changed@example.com", email_verified: true, sid: "session-c" };
    const recovered = await login();
    assert.equal(recovered.result.status, 303);
    assert.equal(recovered.result.headers.get("location"), "/");
    assert.equal((await request("GET", "/api/links", undefined, recovered.cookies)).status, 200);
    assert.equal((await logout({ sid: undefined })).status, 200);
    assert.equal((await request("GET", "/api/links", undefined, recovered.cookies)).status, 401, "Subject logout must revoke all current sessions");

    const adminId = db.prepare("SELECT id FROM users WHERE email = ?").get("admin-oidc@example.com").id;
    const mapping = { issuer, subject: "admin-stable", user_id: adminId };
    const bind = rows => spawnSync(process.execPath, [path.join(root, "scripts/bind-oidc.cjs")],
      { cwd: directory, env: childEnv, input: JSON.stringify(rows), encoding: "utf8", timeout: 10000 });
    assert.notEqual(bind([mapping, { ...mapping, subject: "stable-subject" }]).status, 0, "Conflicting batch must roll back");
    assert.equal(db.prepare("SELECT count(*) AS n FROM oidc_identities WHERE user_id = ?").get(adminId).n, 0);
    assert.equal(db.prepare("SELECT auth_version FROM users WHERE id = ?").get(adminId).auth_version, 0);
    assert.equal(bind([mapping]).status, 0);
    assert.equal(bind([mapping]).status, 0);
    assert.equal(db.prepare("SELECT auth_version FROM users WHERE id = ?").get(adminId).auth_version, 1, "Repeated binding is idempotent");
    assert.equal((await request("GET", "/api/auth/security")).status, 401, "Binding revokes pre-migration cookies");
    profile = { sub: "admin-stable", email: "admin-oidc@example.com", email_verified: true, sid: "admin-session" };
    const boundAdmin = await login();
    assert.equal(boundAdmin.result.status, 303);
    assert.equal(boundAdmin.result.headers.get("location"), "/");
    assert((await (await request("GET", "/api/auth/security", undefined, boundAdmin.cookies)).json()).provider);
    assert.notEqual(bind([{ ...mapping, subject: "another-admin" }]).status, 0);
    db.prepare("UPDATE users SET banned = 1 WHERE id = ?").run(adminId);
    assert.equal((await request("GET", "/api/auth/security", undefined, boundAdmin.cookies)).status, 403, "Bans apply immediately");
    assert.equal((await login()).result.status, 401);
    const down = spawnSync(process.execPath, [path.join(root, "node_modules/knex/bin/cli.js"), "--knexfile", path.join(root, "knexfile.js"), "migrate:down", "20260914002000_oidc_security.js"],
      { cwd: directory, env: childEnv, encoding: "utf8", timeout: 10000 });
    assert.notEqual(down.status, 0, "Downgrade must preserve bindings and revoked sessions");
    childEnv.OIDC_ALLOW_REGISTRATION = "false";
    await stop(); await start();
    profile = { sub: "new-subject", email: "new@example.com", email_verified: true };
    assert.equal((await login()).result.status, 401, "Explicit OIDC registration restriction is enforced");
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.equal(db.pragma("foreign_key_check").length, 0);
    console.log("PASS: " + algorithm + (management ? " management-origin" : "") + " code/PKCE, stable identities, email boundary, signed logout/replay, absolute expiry, revocation, outage recovery, binding rollback and guarded downgrade");
  } finally {
    db.close(); await stop(); await new Promise(resolve => provider.close(resolve));
  }
};
