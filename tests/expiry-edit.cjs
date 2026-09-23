const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");

module.exports = async ({ request, session, database, restart }) => {
  const db = new Database(database);
  const html = { Accept: "text/html" };
  const body = async promise => {
    const response = await promise;
    assert.equal(response.status, 200, await response.clone().text());
    return response.text();
  };
  const field = (page, name) => {
    const tag = page.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`));
    assert(tag, `Missing ${name}`);
    return tag[0].match(/value="([^"]*)"/)?.[1] || "";
  };
  const state = id => db.prepare("SELECT expire_in, ends_at, paused, max_visits, description FROM links WHERE uuid=?").get(id);
  try {
    for (const admin of [false, true]) {
      const response = await request("POST", "/api/links", { target: "https://192.0.2.1/expiry", customurl: "expiry-" + randomUUID(), expire_in: "2 days", paused: true, max_visits: 23 }, session);
      assert.equal(response.status, 201);
      const link = await response.json();
      const endpoint = "/api/links/" + (admin ? "admin/" : "") + link.id;
      const render = () => body(request("GET", (admin ? "/admin" : "") + "/link/edit/" + link.id, undefined, session, html));
      let page = await render();
      const stale = { expire_in: field(page, "expire_in"), expiry_snapshot: field(page, "expiry_snapshot") };
      const laterEnd = "2080-01-01T00:00:00Z";
      assert.equal((await request("PATCH", "/api/links/" + link.id + "/lifecycle", { expire_in: null, ends_at: laterEnd }, session)).status, 200);
      page = await body(request("PATCH", endpoint, { ...stale, description: "Unrelated edit" }, session, html));
      assert(page.includes("Link has been updated."));
      assert.deepEqual(state(link.id), { expire_in: null, ends_at: Date.parse(laterEnd), paused: 1, max_visits: 23, description: "Unrelated edit" });

      // A genuinely changed stale duration conflicts, and unrelated edits are
      // atomic with that conflict. The response retains the draft for review.
      page = await body(request("PATCH", endpoint, { ...stale, expire_in: "3 days", description: "Must not save" }, session, html));
      assert(page.includes("Expiry changed elsewhere."));
      assert.equal(field(page, "expire_in"), "3 days");
      assert.equal(state(link.id).description, "Unrelated edit");
      assert.equal(state(link.id).expire_in, null);
      page = await body(request("PATCH", endpoint, { expire_in: "3 days", expiry_snapshot: field(page, "expiry_snapshot") }, session, html));
      assert(page.includes("Link has been updated."));
      const saved = state(link.id).expire_in;
      const duration = field(page, "expire_in"), snapshot = field(page, "expiry_snapshot");
      page = await body(request("PATCH", endpoint, { expire_in: duration, expiry_snapshot: snapshot, description: "No sliding expiry" }, session, html));
      assert(page.includes("Link has been updated."));
      assert.equal(state(link.id).expire_in, saved);

      // Validation must not silently advance the stale optimistic snapshot.
      const rejected = await body(request("PATCH", endpoint, { expire_in: "4 days", expiry_snapshot: snapshot, address: "bad alias" }, session, html));
      assert.equal(field(rejected, "expiry_snapshot"), snapshot);
      assert.equal(field(rejected, "expire_in"), "4 days");
      assert.equal(state(link.id).expire_in, saved);
      for (const expiry_snapshot of [snapshot + "x", "", "not-a-snapshot"]) {
        const rejected = await body(request("PATCH", endpoint, { expire_in: "4 days", expiry_snapshot }, session, html));
        assert(rejected.includes("Reload the editor"));
        assert.equal(state(link.id).expire_in, saved);
      }
      // JSON callers continue to issue relative expiry explicitly, without a UI token.
      assert.equal((await request("PATCH", endpoint, { expire_in: "5 days" }, session)).status, 200);
      assert.notEqual(state(link.id).expire_in, saved);
      assert.equal(state(link.id).paused, 1);
      assert.equal(state(link.id).max_visits, 23);
      assert.equal((await request("GET", "/" + link.address)).status, 410);

      if (!admin) {
        page = await render();
        const token = field(page, "expiry_snapshot");
        assert.equal((await request("PATCH", endpoint, { expire_in: "6 days" }, session)).status, 200);
        const before = state(link.id);
        let result = await body(request("PATCH", endpoint + "/lifecycle", { clear_expiry: "on", expiry_snapshot: token, paused: "on", max_visits: "23", ends_at: "2081-01-01T00:00" }, session, html));
        assert(result.includes("Expiry changed elsewhere."));
        assert.deepEqual(state(link.id), before);
        assert(result.includes('name="clear_expiry" checked'));
        result = await body(request("PATCH", endpoint + "/lifecycle", { clear_expiry: "on", expiry_snapshot: field(result, "expiry_snapshot"), paused: "on", max_visits: "23", ends_at: "2081-01-01T00:00" }, session, html));
        assert(result.includes("Lifecycle updated."));
        assert.equal(state(link.id).expire_in, null);
        assert.equal(state(link.id).ends_at, Date.parse("2081-01-01T00:00Z"));
        assert.equal(state(link.id).paused, 1);
        assert.equal(state(link.id).max_visits, 23);
      }
    }
    // Admin editing of legacy anonymous links still requires a null-owner
    // predicate, qualified correctly when the saved row rejoins domains.
    const anonymous = await (await request("POST", "/api/links", { target: "https://192.0.2.1/anonymous-expiry" }, session)).json();
    db.prepare("UPDATE links SET user_id=NULL WHERE uuid=?").run(anonymous.id);
    const anonymousHtml = await body(request("GET", "/admin/link/edit/" + anonymous.id, undefined, session, html));
    const anonymousSaved = await body(request("PATCH", "/api/links/admin/" + anonymous.id,
      { description: "Anonymous admin edit", expire_in: "2 days", expiry_snapshot: field(anonymousHtml, "expiry_snapshot") }, session, html));
    assert(anonymousSaved.includes("Link has been updated."));
    assert.equal(state(anonymous.id).description, "Anonymous admin edit");
    assert(state(anonymous.id).expire_in);
    await restart();
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: expiry intent, personal/admin stale saves, atomic conflicts/review retry, invalid snapshots, error draft, lifecycle clear, legacy API and restart");
  } finally { db.close(); }
};
