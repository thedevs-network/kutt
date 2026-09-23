const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { randomUUID, createHmac, createHash } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");

module.exports = async function ({ request, session, database, account, restart, idempotencySecret }) {
  const db = new Database(database);
  try {
    const owner = db.prepare("SELECT * FROM users WHERE email = ?").get(account.email);
    const other = db.prepare("SELECT * FROM users WHERE email = 'other@example.com'").get();
    const target = "https://192.0.2.1/lifecycle";
    const create = async input => {
      const response = await request("POST", "/api/links", { target, customurl: "lc-" + randomUUID(), ...input }, session);
      assert.equal(response.status, 201, await response.clone().text());
      return response.json();
    };
    const edit = (link, body, headers = {}, token = session) => request("PATCH", `/api/v2/links/${link.id}/lifecycle`, body, token, headers);
    const count = link => db.prepare("SELECT redirect_count FROM links WHERE uuid = ?").get(link.id).redirect_count;
    let link = await create({ paused: true, password: "secret" });
    for (const method of ["GET", "HEAD"]) assert.equal((await request(method, "/" + link.address)).status, 410);
    assert.equal((await request("GET", "/" + link.address + "+")).status, 410);
    assert.equal((await request("POST", `/api/links/${link.id}/protected`, { password: "secret" })).status, 410);
    assert.equal(count(link), 0);
    for (const body of [{ paused: "false" }, { max_visits: 0 }, { max_visits: "2" }, { max_visits: 1.5 },
      { max_visits: 2147483648 }, { starts_at: "2026-02-30T00:00:00Z" }, { ends_at: "tomorrow" },
      { ends_at: "2026-10-01T00:00" }, { starts_at: "2027-01-02T00:00:00Z", ends_at: "2027-01-01T00:00:00Z" }]) {
      assert.equal((await edit(link, body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await edit(link, { paused: false }, { Origin: "https://attacker.example" })).status, 403);
    assert.equal((await edit(link, { paused: false })).status, 200);
    assert.equal((await request("PATCH", `/api/links/${link.id}/lifecycle`, { paused: true })).status, 401);
    db.prepare("UPDATE links SET user_id = ? WHERE uuid = ?").run(other.id, link.id);
    assert.equal((await edit(link, { paused: false })).status, 404, "Admin session must not silently edit another owner's lifecycle");
    db.prepare("UPDATE links SET user_id = ? WHERE uuid = ?").run(owner.id, link.id);
    let tokenResponse = await request("POST", "/api/tokens", { name: "Lifecycle", scopes: ["links:update"], domain_scope: "default" }, session);
    const key = (await tokenResponse.json()).token;
    assert.equal((await edit(link, { paused: false, max_visits: 2 }, { "X-API-Key": key })).status, 200);
    const basic = { Authorization: "Basic " + Buffer.from("user:secret").toString("base64") };
    assert.equal((await request("HEAD", "/" + link.address, undefined, undefined, basic)).status, 302);
    assert.equal(count(link), 0);
    assert.equal((await request("POST", `/api/links/${link.id}/protected`, { password: "wrong" })).status, 401);
    assert.equal(count(link), 0);
    assert.equal((await request("GET", "/" + link.address, undefined, undefined, basic)).status, 302);
    assert.equal((await request("POST", `/api/links/${link.id}/protected`, { password: "secret" })).status, 200);
    assert.equal((await request("GET", "/" + link.address, undefined, undefined, basic)).status, 410);
    assert.equal(count(link), 2);
    assert.equal((await edit(link, { max_visits: null })).status, 200);
    assert.equal((await request("GET", "/" + link.address, undefined, undefined, basic)).status, 302);

    link = await create({ max_visits: 3 });
    const info = await request("GET", "/" + link.address + "+");
    assert.equal(info.status, 200);
    assert.equal(count(link), 0);
    const responses = await Promise.all(Array.from({ length: 12 }, () => request("GET", "/" + link.address)));
    assert.equal(responses.filter(response => response.status === 302).length, 3);
    assert.equal(responses.filter(response => response.status === 410).length, 9);
    assert(responses.every(response => response.headers.get("cache-control") === "no-store"));
    assert.equal(count(link), 3);
    await restart();
    assert.equal((await request("GET", "/" + link.address)).status, 410);
    let response = await edit(link, { max_visits: 4 });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).lifecycle_status, "Active");
    assert.equal((await request("GET", "/" + link.address)).status, 302);
    assert.equal((await request("GET", "/" + link.address)).status, 410);

    link = await create({ starts_at: new Date(Date.now() + 60000).toISOString() });
    assert.equal((await request("GET", "/" + link.address)).status, 410);
    assert.equal((await edit(link, { starts_at: "2020-01-01T01:00:00+01:00", ends_at: "2020-01-02T00:00:00Z" })).status, 200);
    assert.equal((await request("GET", "/" + link.address)).status, 410);
    assert.equal((await edit(link, { ends_at: new Date(Date.now() + 2000).toISOString() })).status, 200);
    assert.equal((await request("GET", "/" + link.address)).status, 302);
    await delay(2100);
    assert.equal((await request("GET", "/" + link.address)).status, 410);
    assert.equal((await edit(link, { starts_at: null, ends_at: null })).status, 200);
    assert.equal((await request("GET", "/" + link.address)).status, 302);
    db.prepare("UPDATE links SET expire_in = '2020-01-01 00:00:00' WHERE uuid = ?").run(link.id);
    assert.equal((await request("GET", "/" + link.address)).status, 410);
    await delay(31000);
    assert(db.prepare("SELECT id FROM links WHERE uuid = ?").get(link.id), "Expired links must not be deleted by cron");
    assert.equal((await edit(link, { expire_in: null })).status, 200);
    assert.equal((await request("GET", "/" + link.address)).status, 302);
    const custom = db.prepare("SELECT * FROM domains WHERE user_id = ? LIMIT 1").get(owner.id);
    db.prepare("UPDATE links SET domain_id = ? WHERE uuid = ?").run(custom.id, link.id);
    assert.equal((await edit(link, { paused: true }, { "X-API-Key": key })).status, 404);
    const input = { target, max_visits: 1 };
    const retry = { "Idempotency-Key": randomUUID() };
    response = await request("POST", "/api/links", input, session, retry);
    assert.equal(response.status, 201);
    assert.equal((await request("POST", "/api/links", { ...input, max_visits: 2 }, session, retry)).status, 409);
    assert.equal((await request("POST", "/api/links", input, session, retry)).headers.get("idempotency-replayed"), "true");
    const oldKey = randomUUID();
    const oldInput = { target, expire_in: null };
    assert.equal((await request("POST", "/api/links", oldInput, session, { "Idempotency-Key": oldKey })).status, 201);
    const oldHash = createHmac("sha256", idempotencySecret).update(JSON.stringify({
      target, customurl: null, description: null, password: null, reuse: false, domain: "default", expire_in: null
    })).digest("hex");
    db.prepare("UPDATE link_creation_requests SET request_hash = ? WHERE key_hash = ?")
      .run(oldHash, createHash("sha256").update(oldKey).digest("hex"));
    response = await request("POST", "/api/links", oldInput, session, { "Idempotency-Key": oldKey });
    assert.equal(response.status, 201, "Pre-lifecycle idempotency keys must remain valid");
    assert.equal(response.headers.get("idempotency-replayed"), "true");
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: lifecycle validation, ownership, CSRF, scoped tokens, concurrent limits, password paths, HEAD, scheduling, restart and retained expiry");
  } finally { db.close(); }
};
