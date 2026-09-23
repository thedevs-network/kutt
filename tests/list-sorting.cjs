const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { randomUUID } = require("node:crypto");

module.exports = async ({ request, session, database, account, restart }) => {
  const db = new Database(database);
  const prefix = "order-" + randomUUID().slice(0, 8);
  let workspaceId, tokenId;
  const checked = async (promise, expected = 200) => {
    const response = await promise;
    assert.equal(response.status, expected, await response.clone().text());
    return response.status === 204 ? null : response.json();
  };
  try {
    const owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
    const other = db.prepare("SELECT id FROM users WHERE email='other@example.com'").get().id;
    const own = [];
    for (const [index, count] of [2, 10, 2].entries()) {
      const id = randomUUID(), address = prefix + "-" + (3 - index);
      const result = db.prepare("INSERT INTO links(uuid,user_id,address,target,visit_count,created_at) VALUES(?,?,?,?,?,?)")
        .run(id, owner, address, "https://example.org/" + index, count, "2026-01-01 00:00:00");
      own.push({ id, internal: Number(result.lastInsertRowid), address, count });
    }
    const foreign = randomUUID();
    db.prepare("INSERT INTO links(uuid,user_id,address,target,visit_count) VALUES(?,?,?,?,?)")
      .run(foreign, other, prefix + "-foreign", "https://example.org/foreign", 999);
    for (const api of ["/api", "/api/v2"]) {
      for (const direction of ["asc", "desc"]) {
        const expected = [...own].sort((a, b) => (direction === "asc" ? a.count - b.count : b.count - a.count) || b.internal - a.internal).map(row => row.id);
        const query = new URLSearchParams({ search: prefix, sort: "visit_count", direction, limit: "2" });
        const first = await checked(request("GET", api + "/links?" + query, undefined, session));
        query.set("skip", "2");
        const second = await checked(request("GET", api + "/links?" + query, undefined, session));
        assert.equal(first.total, 3); assert.equal(second.total, 3);
        assert.deepEqual([...first.data, ...second.data].map(row => row.id), expected);
        const library = await checked(request("GET", api + "/library?" + new URLSearchParams({ q: prefix, sort: "visit_count", direction }), undefined, session));
        assert.deepEqual(library.data.map(row => row.id), expected);
      }
      for (const route of ["/links", "/links/admin", "/users/admin", "/domains/admin", "/library", "/links/trash"]) {
        for (const query of ["sort=__proto__", "sort=id%20desc%3B--", "sort[]=id", "direction[x]=asc", "direction=DESC", "sort=", "direction="]) {
          const response = await request("GET", api + route + "?" + query, undefined, session);
          assert.equal(response.status, 400, route + "?" + query + ": " + await response.text());
        }
      }
      assert.equal((await request("GET", api + "/links?sort=address")).status, 401);
    }
    const credential = await checked(request("POST", "/api/tokens", { name: "Sort read", scopes: ["links:read"], domain_scope: "default" }, session), 201);
    const token = credential.token;
    tokenId = credential.id;
    const scoped = await checked(request("GET", "/api/links?search=" + prefix + "&sort=visit_count&direction=desc", undefined, undefined, { "X-API-Key": token }));
    assert(!scoped.data.some(row => row.id === foreign));
    assert.equal(scoped.total, 3);
    assert.equal((await request("GET", "/api/users/admin?sort=email", undefined, session, { "X-API-Key": token })).status, 403);
    const saved = await checked(request("POST", "/api/library/filters", { name: prefix, filters: { q: prefix, sort: "address", direction: "asc" } }, session), 201);
    await restart();
    const result = await checked(request("GET", "/api/library?saved=" + saved.id, undefined, session));
    assert.equal(result.filters.sort, "address"); assert.equal(result.filters.direction, "asc");
    assert.deepEqual(result.data.map(row => row.address), own.map(row => row.address).sort());
    const pageResponse = await request("GET", "/settings/library", undefined, session, { Accept: "text/html" });
    const invalidLabel = await request("POST", "/settings/library", {
      operation: "save_label", kind: "tag", name: "", return_to: "/settings/library?q=" + prefix + "&sort=address&direction=asc"
    }, session, { Accept: "text/html", Origin: new URL(pageResponse.url).origin });
    assert.equal(invalidLabel.status, 400);
    const failurePage = await invalidLabel.text();
    assert.match(failurePage, /value="address"\s+selected/);
    assert.match(failurePage, /value="asc"\s+selected/);
    assert(failurePage.includes('value="' + prefix + '"'));
    const space = await checked(request("POST", "/api/workspaces", { name: prefix }, session), 201);
    workspaceId = space.id;
    for (const row of own) await checked(request("POST", "/api/workspaces/" + space.id + "/shares", { link_id: row.id }, session), 204);
    const shared = await checked(request("GET", "/api/workspaces/" + space.id + "?sort=address&direction=asc", undefined, session));
    assert.deepEqual(shared.data.map(row => row.address), own.map(row => row.address).sort());
    assert.equal((await request("GET", "/api/workspaces/" + space.id + "?sort=constructor", undefined, session)).status, 400);
    console.log("PASS: sorted HTTP lists, stable pages/counts, malformed parameters, owner/scoped isolation, saved-filter restart and workspace sorting");
  } finally {
    if (workspaceId) db.prepare("DELETE FROM workspaces WHERE id=?").run(workspaceId);
    if (tokenId) db.prepare("DELETE FROM api_tokens WHERE id=?").run(tokenId);
    db.prepare("DELETE FROM library_filters WHERE name=?").run(prefix);
    db.prepare("DELETE FROM links WHERE address LIKE ?").run(prefix + "-%");
    db.close();
  }
};
