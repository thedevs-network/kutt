const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { randomUUID } = require("node:crypto");

module.exports = async function ({ request, session, database, account, restart }) {
  const db = new Database(database);
  try {
    const owner = db.prepare("SELECT * FROM users WHERE email = ?").get(account.email);
    const other = db.prepare("SELECT * FROM users WHERE email = 'other@example.com'").get();
    const target = "https://192.0.2.1/history";
    const create = async input => {
      const response = await request("POST", "/api/v2/links", { target, customurl: "hist-" + randomUUID(), ...input }, session);
      assert.equal(response.status, 201, await response.clone().text());
      return response.json();
    };
    const keyResponse = await request("POST", "/api/tokens", {
      name: "History", scopes: ["links:read", "links:update", "links:delete"], domain_scope: "default"
    }, session);
    const key = (await keyResponse.json()).token;
    const call = (method, link, action, body, headers = {}) => request(method, `/api/links/${link.id}${action}`, body, session, { "X-API-Key": key, ...headers });
    let link = await create({ password: "private-value", paused: true, max_visits: 1 });
    const original = db.prepare("SELECT * FROM links WHERE uuid = ?").get(link.id);
    assert.equal((await call("DELETE", link, "", undefined, { Origin: "https://evil.example" })).status, 403);
    assert.equal((await call("DELETE", link, "")).status, 200);
    assert.equal((await call("DELETE", link, "")).status, 200, "Deletion retry is idempotent");
    assert.equal(db.prepare("SELECT count(*) AS n FROM link_history WHERE link_id = ? AND action = 'trashed'").get(original.id).n, 1);
    assert.equal((await request("GET", "/" + link.address)).status, 410);
    assert.equal((await request("HEAD", "/" + link.address)).status, 410);
    assert.equal((await request("POST", `/api/links/${link.id}/protected`, { password: "private-value" })).status, 410);
    const listed = await (await request("GET", "/api/links?limit=50", undefined, session)).json();
    assert(!listed.data.some(row => row.id === link.id));
    const trash = await (await request("GET", "/api/links/trash?limit=50", undefined, session, { "X-API-Key": key })).json();
    assert(trash.data.some(row => row.id === link.id && row.deleted_at));
    assert.equal((await request("GET", "/api/links/trash")).status, 401);
    assert.equal((await request("GET", `/api/links/${link.id}/history`)).status, 401);
    assert.equal((await request("GET", "/api/links/trash?skip=-1", undefined, session)).status, 400);
    assert.equal((await request("POST", "/api/links", { target, customurl: link.address }, session)).status, 409);
    assert.equal((await call("POST", link, "/restore", {}, { Origin: "https://evil.example" })).status, 403);
    await restart();
    assert.equal((await call("POST", link, "/restore", {})).status, 200);

    const expired = await create({ max_visits: 1 });
    assert.equal((await request("GET", "/" + expired.address)).status, 302);
    assert.equal((await call("DELETE", expired, "")).status, 200);
    db.prepare("UPDATE links SET ends_at = 1 WHERE uuid = ?").run(expired.id);
    assert.equal((await call("POST", expired, "/restore", {})).status, 200);
    assert.equal((await request("GET", "/" + expired.address)).status, 410);
    assert.equal(db.prepare("SELECT redirect_count FROM links WHERE uuid = ?").get(expired.id).redirect_count, 1);
    const probe = await request("GET", "/" + expired.address);
    // Fetch normalizes Host to its URL; use HTTP's explicit virtual-host support.
    const unknownHostStatus = await new Promise((resolve, reject) => {
      require("node:http").get(probe.url, { headers: { Host: "unknown.example" } }, response => {
        response.resume(); resolve(response.statusCode);
      }).on("error", reject);
    });
    assert.equal(unknownHostStatus, 404);
    const restored = db.prepare("SELECT * FROM links WHERE uuid = ?").get(link.id);
    for (const field of ["target", "password", "paused", "max_visits", "redirect_count", "visit_count", "uuid"]) {
      assert.equal(restored[field], original[field], field + " preserved");
    }
    assert.equal(restored.deleted_at, null);
    assert.equal((await request("GET", "/" + link.address)).status, 410, "Restore must not clear pause");
    assert.equal((await call("POST", link, "/restore", {})).status, 200);
    assert.equal(db.prepare("SELECT count(*) AS n FROM link_history WHERE link_id = ? AND action = 'restored'").get(original.id).n, 1);
    let response = await call("GET", link, "/history");
    let events = await response.json();
    assert.deepEqual(events.data.map(row => row.action), ["restored", "trashed", "created"]);
    assert(!JSON.stringify(events).includes("private-value"));
    assert(!JSON.stringify(events).includes(original.password));
    assert.equal(events.data[0].source, "api_token");
    assert.equal(events.data[0].actor, "You");
    const page = await (await call("GET", link, "/history?limit=1&skip=1")).json();
    assert.equal(page.data.length, 1);
    assert.equal(page.data[0].action, "trashed");
    db.prepare("UPDATE links SET user_id = ? WHERE uuid = ?").run(other.id, link.id);
    assert.equal((await call("GET", link, "/history")).status, 404);
    assert.equal((await request("POST", `/api/links/${link.id}/restore`, {}, session)).status, 404, "Administrator session cannot restore another user's link");
    db.prepare("UPDATE links SET user_id = ? WHERE uuid = ?").run(owner.id, link.id);
    const readKey = (await (await request("POST", "/api/tokens", { name: "Read", scopes: ["links:read"] }, session)).json()).token;
    assert.equal((await request("POST", `/api/links/${link.id}/restore`, {}, session, { "X-API-Key": readKey })).status, 403);

    link = await create({});
    const oldAddress = link.address;
    const renamed = "renamed-" + randomUUID();
    assert.equal((await call("PATCH", link, "", { address: renamed })).status, 200);
    assert.equal((await request("GET", "/" + oldAddress)).headers.get("location"), "/404");
    assert.equal((await request("GET", "/" + renamed)).headers.get("location"), target);
    assert.equal((await request("POST", "/api/links", { target, customurl: oldAddress }, session)).status, 409);
    assert.equal((await call("PATCH", link, "", { address: oldAddress })).status, 409, "Retired aliases cannot be reactivated by renaming back");
    events = await (await call("GET", link, "/history")).json();
    assert.deepEqual(events.data[0].fields, ["address"]);
    assert.equal((await call("DELETE", link, "")).status, 200);
    db.prepare("UPDATE links SET banned = 1 WHERE uuid = ?").run(link.id);
    assert.equal((await call("POST", link, "/restore", {})).status, 409);
    db.prepare("UPDATE links SET banned = 0 WHERE uuid = ?").run(link.id);
    assert.equal((await call("POST", link, "/restore", {})).status, 200);

    const parallelAlias = "race-" + randomUUID();
    const parallel = await Promise.all(Array.from({ length: 8 }, () => request("POST", "/api/links", { target, customurl: parallelAlias }, session)));
    assert.equal(parallel.filter(result => result.status === 201).length, 1);
    assert(parallel.every(result => [201, 400, 409].includes(result.status)));
    assert.equal(db.prepare("SELECT count(*) AS n FROM links WHERE address = ?").get(parallelAlias).n, 1);

    const host = "history-" + randomUUID() + ".example";
    const domainUuid = randomUUID();
    const domainId = Number(db.prepare("INSERT INTO domains(address, uuid, user_id) VALUES(?,?,?)").run(host, domainUuid, owner.id).lastInsertRowid);
    const custom = await create({ domain: host });
    for (const suffix of ["", "?links=false", "?links=0"]) {
      assert.equal((await request("DELETE", `/api/domains/admin/${domainId}${suffix}`, undefined, session)).status, 409);
      assert.equal(db.prepare("SELECT deleted_at FROM links WHERE uuid = ?").get(custom.id).deleted_at, null);
      assert(db.prepare("SELECT id FROM domains WHERE id = ?").get(domainId));
    }
    assert.equal((await call("GET", custom, "/history")).status, 404);
    assert.equal((await request("DELETE", `/api/links/${custom.id}`, undefined, session)).status, 200);
    db.prepare("UPDATE domains SET user_id = ? WHERE id = ?").run(other.id, domainId);
    assert.equal((await request("POST", `/api/links/${custom.id}/restore`, {}, session)).status, 409);
    db.prepare("UPDATE domains SET user_id = ? WHERE id = ?").run(owner.id, domainId);
    assert.equal((await request("DELETE", `/api/domains/admin/${domainId}?links=true`, undefined, session)).status, 200);
    assert.equal(db.prepare("SELECT archived_domain FROM links WHERE uuid = ?").get(custom.id).archived_domain, host);
    assert.equal((await call("GET", custom, "/history")).status, 404, "Default-domain token cannot access an archived custom domain");
    assert.equal((await request("POST", `/api/links/${custom.id}/restore`, {}, session)).status, 409);
    db.prepare("INSERT INTO domains(address, uuid, user_id) VALUES(?,?,?)").run(host, randomUUID(), owner.id);
    assert.equal((await request("POST", "/api/links", { target, domain: host, customurl: custom.address }, session)).status, 409);
    assert.equal((await request("POST", `/api/links/${custom.id}/restore`, {}, session)).status, 200);
    assert.equal(db.prepare("SELECT archived_domain FROM links WHERE uuid = ?").get(custom.id).archived_domain, null);

    // Account removal is intentionally permanent, but its aliases must stay reserved.
    const removedUserLink = await create({});
    db.prepare("UPDATE links SET user_id = NULL WHERE uuid = ?").run(removedUserLink.id);
    db.prepare("DELETE FROM links WHERE uuid = ?").run(removedUserLink.id);
    assert.equal((await request("POST", "/api/links", { target, customurl: removedUserLink.address }, session)).status, 409);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: trash/restore, preserved policies, audit privacy, owner/domain/scoped access, CSRF, restart, concurrent aliases and domain/account removal");
  } finally { db.close(); }
};
