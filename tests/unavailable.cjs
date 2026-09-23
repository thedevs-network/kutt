const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");

module.exports = async ({ request, session, database }) => {
  const db = new Database(database), now = Date.now(), prefix = "unavailable-" + randomUUID();
  const states = [{ paused: 1 }, { starts_at: now + 3600000 }, { ends_at: now - 60000 },
    { max_visits: 1, redirect_count: 1 }, { expire_in: "2000-01-01 00:00:00" }];
  try {
    for (const [index, state] of states.entries()) {
      const target = "https://example.org/private-recipient-target-" + index;
      const created = await request("POST", "/api/links", { target, customurl: prefix + index, password: "private-test-only" }, session);
      assert.equal(created.status, 201); const link = await created.json();
      const entries = Object.entries(state);
      db.prepare("UPDATE links SET " + entries.map(([key]) => key + "=?").join(",") + " WHERE uuid=?").run(...entries.map(([, value]) => value), link.id);
      for (const suffix of ["", "+"]) {
        const response = await request("GET", "/" + link.address + suffix, undefined, undefined, { Accept: "text/html" });
        assert.equal(response.status, 410); assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("location"), null); const html = await response.text();
        assert(html.includes("| Link unavailable</title>")); assert(html.includes('<main class="section-container unavailable-link"'));
        assert(html.includes('<h1 id="unavailable-title">Link unavailable</h1>'));
        assert(html.includes("Ask the person who shared it for an updated link."));
        assert(!html.includes(target) && !html.includes("private-test-only"));
      }
      const head = await request("HEAD", "/" + link.address, undefined, undefined, { Accept: "text/html" });
      assert.equal(head.status, 410); assert.equal(await head.text(), "");
      const json = await request("GET", "/" + link.address);
      assert.equal(json.status, 410); assert.equal(await json.text(), "This short link is not currently available.");
      const protectedReply = await request("POST", "/api/links/" + link.id + "/protected", { password: "private-test-only" });
      assert.equal(protectedReply.status, 410); assert.equal(await protectedReply.text(), "This short link is not currently available.");
      assert.equal(db.prepare("SELECT redirect_count FROM links WHERE uuid=?").get(link.id).redirect_count, state.redirect_count || 0);
    }
    const active = await request("POST", "/api/links", { target: "https://example.org/active", customurl: prefix + "active" }, session);
    assert.equal(active.status, 201); const link = await active.json();
    const redirect = await request("GET", "/" + link.address, undefined, undefined, { Accept: "text/html" });
    assert.equal(redirect.status, 302); assert.equal(redirect.headers.get("location"), "https://example.org/active");
    console.log("PASS: named unavailable recipient pages, paused/scheduled/ended/expired/capped protection, private target/password, no-store/HEAD, unchanged API/protected responses and active public redirect");
  } finally { db.close(); }
};
