const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { randomUUID, createHash } = require("node:crypto");

module.exports = async function ({ request, session, database, account, restart }) {
  const db = new Database(database);
  try {
    const owner = db.prepare("SELECT * FROM users WHERE email = ?").get(account.email);
    const other = db.prepare("SELECT * FROM users WHERE email = 'other@example.com'").get();
    const domains = [];
    for (const address of ["scope-a.example", "scope-b.example"]) {
      const uuid = randomUUID();
      const id = Number(db.prepare("INSERT INTO domains (address, user_id, uuid) VALUES (?, ?, ?)")
        .run(address, owner.id, uuid).lastInsertRowid);
      domains.push({ id, uuid, address });
    }
    const scopes = ["links:read", "links:create", "links:update", "links:delete", "stats:read"];
    async function token(domain_scope) {
      const response = await request("POST", "/api/v2/tokens", { name: domain_scope, scopes, domain_scope }, session);
      assert.equal(response.status, 201);
      return (await response.json()).token;
    }
    const defaultToken = await token("default");
    const aToken = await token(domains[0].uuid);
    const bToken = await token(domains[1].uuid);
    const allToken = await token("all");
    assert(defaultToken.startsWith("kutt_d_"));
    assert(!/^kutt_[A-Za-z0-9_-]{43}$/.test(defaultToken), "An old image must reject restricted tokens");
    for (const invalid of [null, 42, [], "missing", randomUUID()]) {
      assert.equal((await request("POST", "/api/v2/tokens", { name: "bad", scopes, domain_scope: invalid }, session)).status, 400);
    }
    const foreignDomain = db.prepare("SELECT * FROM domains WHERE user_id = ?").get(other.id);
    assert.equal((await request("POST", "/api/v2/tokens", {
      name: "foreign", scopes, domain_scope: foreignDomain.uuid
    }, session)).status, 400);
    const keyed = (key, method, path, body, headers = {}) => request(method, path, body, session,
      { "X-API-Key": key, ...headers });
    const digest = value => createHash("sha256").update(value).digest("hex");
    const collidingPrefix = "kutt_d_" + "x".repeat(41);
    db.prepare("UPDATE api_tokens SET token_hash = ? WHERE token_hash = ?").run(digest(collidingPrefix), digest(allToken));
    assert.equal((await keyed(collidingPrefix, "GET", "/api/v2/links")).status, 200);
    db.prepare("UPDATE api_tokens SET token_hash = ? WHERE token_hash = ?").run(digest(allToken), digest(collidingPrefix));
    db.prepare("UPDATE api_tokens SET domain_scope = 'all' WHERE token_hash = ?").run(digest(defaultToken));
    assert.equal((await keyed(defaultToken, "GET", "/api/v2/links")).status, 401, "Schema rollback/reapply must not widen a restricted token");
    db.prepare("UPDATE api_tokens SET domain_scope = 'default' WHERE token_hash = ?").run(digest(defaultToken));
    const input = { target: "https://192.0.2.1/", customurl: "domain-default" };
    let response = await keyed(defaultToken, "POST", "/api/v2/links", input);
    assert.equal(response.status, 201);
    const defaultLink = await response.json();
    assert.equal((await keyed(aToken, "POST", "/api/v2/links", { ...input, customurl: "no-default" })).status, 403);
    assert.equal((await keyed(defaultToken, "POST", "/api/v2/links", {
      ...input, customurl: "no-custom", domain: domains[0].address
    })).status, 403);
    response = await keyed(aToken, "POST", "/api/v2/links", {
      ...input, customurl: "domain-custom", domain: domains[0].address
    });
    assert.equal(response.status, 201);
    const aLink = await response.json();
    for (const key of [defaultToken, bToken]) {
      for (const [method, suffix, body] of [["PATCH", "", { description: "not allowed" }], ["DELETE", ""], ["GET", "/stats"]]) {
        assert.equal((await keyed(key, method, `/api/v2/links/${aLink.id}${suffix}`, body)).status, 404);
      }
    }
    response = await keyed(aToken, "GET", "/api/v2/links");
    const listed = await response.json();
    assert.equal(listed.total, 1);
    assert.deepEqual(listed.data.map(link => link.id), [aLink.id]);
    response = await keyed(defaultToken, "GET", "/api/v2/links");
    const defaults = await response.json();
    assert(defaults.data.some(link => link.id === defaultLink.id));
    assert(defaults.data.every(link => !link.domain));
    assert.equal((await keyed(aToken, "PATCH", `/api/v2/links/${aLink.id}`, { description: "allowed" })).status, 200);
    for (const [column, denied, restored] of [["banned", 1, 0], ["user_id", other.id, owner.id]]) {
      db.prepare(`UPDATE domains SET ${column} = ? WHERE id = ?`).run(denied, domains[0].id);
      assert.equal((await keyed(aToken, "GET", "/api/v2/links")).status, 401);
      db.prepare(`UPDATE domains SET ${column} = ? WHERE id = ?`).run(restored, domains[0].id);
    }
    db.prepare("DELETE FROM domains WHERE id = ?").run(domains[1].id);
    db.prepare("INSERT INTO domains (address, user_id, uuid) VALUES (?, ?, ?)")
      .run(domains[1].address, owner.id, randomUUID());
    assert.equal((await keyed(bToken, "GET", "/api/v2/links")).status, 401, "Domain recreation must not reactivate a restricted token");

    const retryInput = { target: "https://192.0.2.1/retry", description: "retry", expire_in: "2 days", password: "secret-link-password" };
    const headers = { "Idempotency-Key": randomUUID() };
    const countBefore = db.prepare("SELECT count(*) AS n FROM links").get().n;
    const responses = await Promise.all(Array.from({ length: 8 }, () => keyed(defaultToken, "POST", "/api/v2/links", retryInput, headers)));
    const bodies = [];
    for (const result of responses) {
      assert.equal(result.status, 201);
      bodies.push(await result.json());
    }
    assert.equal(responses.filter(result => result.headers.get("idempotency-replayed") === "false").length, 1);
    bodies.forEach(body => assert.deepEqual(body, bodies[0]));
    assert.equal(db.prepare("SELECT count(*) AS n FROM links").get().n, countBefore + 1);
    const stored = db.prepare("SELECT * FROM link_creation_requests").all();
    assert.equal(stored.length, 1);
    assert(!JSON.stringify(stored).includes(retryInput.password));
    assert(!JSON.stringify(stored).includes(headers["Idempotency-Key"]));
    await restart();
    response = await keyed(allToken, "POST", "/api/links", retryInput, headers);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("idempotency-replayed"), "true");
    assert.deepEqual(await response.json(), bodies[0]);
    assert.equal((await keyed(defaultToken, "POST", "/api/v2/links", { ...retryInput, password: "different-password" }, headers)).status, 409);
    assert.equal((await keyed(defaultToken, "POST", "/api/v2/links", { ...retryInput, expire_in: "3 days" }, headers)).status, 409);
    assert.equal((await keyed(aToken, "POST", "/api/v2/links", retryInput, headers)).status, 403);
    assert.equal((await request("POST", "/api/v2/links", retryInput, undefined, headers)).status, 401);
    for (const value of ["short", "invalid space", "x".repeat(129)]) {
      assert.equal((await keyed(defaultToken, "POST", "/api/v2/links", retryInput, { "Idempotency-Key": value })).status, 400);
    }
    const failedHeaders = { "Idempotency-Key": randomUUID() };
    const reserved = db.prepare("SELECT count(*) AS n FROM link_creation_requests").get().n;
    assert.equal((await keyed(defaultToken, "POST", "/api/v2/links", input, failedHeaders)).status, 400);
    assert.equal(db.prepare("SELECT count(*) AS n FROM link_creation_requests").get().n, reserved, "Failed insert must roll back its key reservation");
    response = await keyed(defaultToken, "POST", "/api/v2/links", { ...input, customurl: "retry-after-failure" }, failedHeaders);
    assert.equal(response.status, 201);
    assert.equal((await keyed(defaultToken, "DELETE", `/api/v2/links/${bodies[0].id}`)).status, 200);
    assert.equal((await keyed(defaultToken, "POST", "/api/v2/links", retryInput, headers)).status, 409, "Retry must never recreate a deleted link");
    db.prepare("UPDATE link_creation_requests SET created_at = 0").run();
    response = await keyed(defaultToken, "POST", "/api/v2/links", retryInput, headers);
    assert.equal(response.status, 201);
    assert.equal(response.headers.get("idempotency-replayed"), "false");
    assert.notEqual((await response.json()).id, bodies[0].id);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: domain scoping, ownership changes, old-image fail-closed, parallel retries, restart replay, conflicts, retention and transaction rollback");
  } finally {
    db.close();
  }
};
