const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { randomBytes } = require("node:crypto");

module.exports = async function testTokens({ request, session, database, account }) {
  const db = new Database(database);
  try {
    const owner = db.prepare("SELECT * FROM users WHERE email = ?").get(account.email);
    const otherId = db.prepare("INSERT INTO users (email, password, verified, role) VALUES (?, ?, 1, 'USER')")
      .run("other@example.com", owner.password).lastInsertRowid;
    const login = await request("POST", "/api/v2/auth/login", { ...account, email: "other@example.com" });
    const otherSession = (await login.json()).token;
    assert(otherSession);
    const input = { target: "https://example.com/", customurl: "token-other" };
    const otherLink = await (await request("POST", "/api/v2/links", input, otherSession)).json();
    assert(otherLink.id);
    const tokenInput = { name: "Read only", scopes: ["links:read"] };
    assert.equal((await request("POST", "/api/v2/tokens", tokenInput)).status, 401);
    let response = await request("POST", "/api/v2/tokens", tokenInput, session);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const read = await response.json();
    assert(read.token.startsWith("kutt_"));
    const stored = db.prepare("SELECT * FROM api_tokens WHERE id = ?").get(read.id);
    assert.match(stored.token_hash, /^[a-f0-9]{64}$/);
    assert(!JSON.stringify(stored).includes(read.token), "Database must not contain the secret");
    assert(Date.parse(read.expires_at) > Date.now() + 29 * 86400000);
    const keyed = (method, path, body, key = read.token, cookie) =>
      request(method, path, body, cookie, { "X-API-Key": key });
    for (const prefix of ["/api", "/api/v2"]) {
      response = await keyed("GET", prefix + "/links/");
      assert.equal(response.status, 200);
      assert(!(await response.json()).data.some(link => link.id === otherLink.id));
      for (const [method, path, body] of [
        ["POST", "/links", input], ["GET", "/links/admin"],
        ["GET", "/users/admin"], ["POST", "/domains", {}],
        ["GET", "/tokens"], ["POST", "/tokens", tokenInput],
        ["POST", "/auth/apikey", {}], ["POST", "/auth/change-password", {}],
        ["POST", "/users/delete", {}], ["GET", "/future-route"]
      ]) {
        assert.equal((await keyed(method, prefix + path, body, read.token, session)).status, 403,
          `Read token + admin cookie must not authorize ${method} ${path}`);
      }
      assert.equal((await keyed("GET", prefix + "/links", undefined, "kutt_invalid", session)).status, 401);
      assert.equal((await keyed("GET", prefix + "/links", undefined, "invalid-legacy", session)).status, 401);
      assert.equal((await request("GET", prefix + "/links?apikey=" + read.token, undefined, session)).status, 401);
      assert.equal((await request("POST", prefix + "/links", { ...input, apikey: read.token }, session)).status, 401);
      assert.equal((await keyed("POST", prefix + "/links", { ...input, apikey: "other" }, read.token, session)).status, 401);
    }
    response = await request("GET", "/api/v2/tokens", undefined, session);
    const listed = await response.json();
    assert(!JSON.stringify(listed).includes(read.token));
    assert(!JSON.stringify(listed).includes(stored.token_hash));
    assert(listed.data[0].last_used_at);
    assert.equal((await request("DELETE", `/api/v2/tokens/${read.id}`, undefined, otherSession)).status, 404);
    assert.equal((await request("GET", "/api/v2/tokens", undefined, otherSession)).status, 200);
    for (const bad of [
      { name: "", scopes: ["links:read"] }, { ...tokenInput, scopes: [] },
      { ...tokenInput, scopes: ["admin"] }, { ...tokenInput, scopes: ["constructor"] },
      { ...tokenInput, scopes: [null] }, { ...tokenInput, expires_in_days: "forever" },
      { ...tokenInput, expires_at: "2020-01-01T00:00:00Z" },
      { ...tokenInput, expires_at: "invalid" }, { ...tokenInput, expires_at: 123 }
    ]) assert.equal((await request("POST", "/api/v2/tokens", bad, session)).status, 400);
    assert.equal((await request("POST", "/api/v2/tokens", tokenInput, session,
      { Origin: "https://evil.example" })).status, 403);
    assert.equal((await request("DELETE", `/api/v2/tokens/${read.id}`, undefined, session,
      { "Sec-Fetch-Site": "cross-site" })).status, 403);
    const all = {};
    for (const scope of ["links:create", "links:update", "links:delete", "stats:read"]) {
      response = await request("POST", "/api/v2/tokens", { name: scope, scopes: [scope], expires_in_days: "never" }, session);
      assert.equal(response.status, 201);
      all[scope] = await response.json();
      assert.equal(all[scope].expires_at, null);
      assert.equal((await keyed("GET", "/api/v2/links", undefined, all[scope].token)).status, 403);
    }
    response = await keyed("POST", "/api/v2/links", { ...input, customurl: "token-created" }, all["links:create"].token);
    assert.equal(response.status, 201);
    const link = await response.json();
    const created = db.prepare("SELECT * FROM links WHERE uuid = ?").get(link.id);
    assert.equal(created.user_id, owner.id);
    response = await keyed("PATCH", `/api/v2/links/${link.id}`, { description: "Updated" }, all["links:update"].token);
    assert.equal(response.status, 200);
    assert.equal((await keyed("GET", `/api/v2/links/${link.id}/stats`, undefined, all["stats:read"].token)).status, 200);
    for (const [scope, method, suffix, body] of [
      ["links:update", "PATCH", "", { description: "Forbidden" }],
      ["links:delete", "DELETE", ""], ["stats:read", "GET", "/stats"]
    ]) {
      assert.equal((await keyed(method, `/api/v2/links/${otherLink.id}${suffix}`, body, all[scope].token, session)).status, 404);
    }
    assert.equal((await keyed("DELETE", `/api/v2/links/${link.id}`, undefined, all["links:delete"].token)).status, 200);
    // Caller-supplied server-only fields must not bypass domain ownership checks.
    const domainId = db.prepare("INSERT INTO domains (address, user_id) VALUES (?, ?)")
      .run("other-domain.example", Number(otherId)).lastInsertRowid;
    response = await keyed("POST", "/api/v2/links", {
      ...input, customurl: "no-injected-domain", fetched_domain: { id: Number(domainId), address: "other-domain.example" }
    }, all["links:create"].token);
    assert.equal(response.status, 201);
    assert.equal(db.prepare("SELECT domain_id FROM links WHERE address = ?").get("no-injected-domain").domain_id, null);
    response = await keyed("POST", "/api/v2/links", { ...input, customurl: "wrong-domain", domain: "other-domain.example" }, all["links:create"].token);
    assert.equal(response.status, 400);
    db.prepare("UPDATE users SET banned = 1 WHERE id = ?").run(owner.id);
    assert.equal((await keyed("GET", "/api/v2/links")).status, 401);
    db.prepare("UPDATE users SET banned = 0, verified = 0 WHERE id = ?").run(owner.id);
    assert.equal((await keyed("GET", "/api/v2/links")).status, 401);
    db.prepare("UPDATE users SET verified = 1 WHERE id = ?").run(owner.id);
    db.prepare("UPDATE api_tokens SET expires_at = ? WHERE id = ?").run(Date.now() - 1, read.id);
    assert.equal((await keyed("GET", "/api/v2/links", undefined, read.token, session)).status, 401);
    db.prepare("UPDATE api_tokens SET expires_at = NULL WHERE id = ?").run(read.id);
    assert.equal((await request("DELETE", `/api/v2/tokens/${read.id}`, undefined, session)).status, 204);
    assert.equal((await request("DELETE", `/api/v2/tokens/${read.id}`, undefined, session)).status, 204);
    assert.equal((await keyed("GET", "/api/v2/links", undefined, read.token, session)).status, 401);
    const legacy = "kutt_" + randomBytes(18).toString("hex").slice(0, 35);
    db.prepare("UPDATE users SET apikey = ? WHERE id = ?").run(legacy, owner.id);
    assert.equal((await keyed("GET", "/api/v2/links", undefined, legacy)).status, 200);
    assert.equal((await keyed("GET", "/api/v2/links/admin", undefined, legacy)).status, 200);
    assert.equal((await keyed("POST", "/api/v2/tokens", tokenInput, legacy, session)).status, 403);
    const html = await request("GET", "/settings", undefined, session, { Accept: "text/html" });
    assert.equal(html.status, 200);
    assert((await html.text()).includes('id="tokens-wrapper"'));
    assert.equal(html.headers.get("cache-control"), "no-store");
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    console.log("PASS: token hashing, scopes, API aliases, ownership, expiry, revocation, bans, CSRF, cookie isolation, legacy keys and settings");
  } finally {
    db.close();
  }
};
