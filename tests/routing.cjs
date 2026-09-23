const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const Database = require("better-sqlite3");

module.exports = async ({ request, session, database, account, restart, root, directory, env }) => {
  const db = new Database(database);
  const owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
  const other = db.prepare("SELECT id FROM users WHERE email='other@example.com'").get().id;
  const ua = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
  try {
    const address = "routing-" + randomUUID(), fallback = "https://192.0.2.1/default";
    let response = await request("POST", "/api/links", { customurl: address, target: fallback }, session);
    assert.equal(response.status, 201); const link = await response.json(), api = "/api/v2/links/" + link.id + "/routing";
    let revision = 0;
    const put = async (rules, extra = {}) => {
      const r = await request("PUT", api, { rules, revision }, session, extra);
      assert.equal(r.status, 200, await r.clone().text()); revision = (await r.json()).revision;
    };
    const rule = (name, conditions) => ({ name, target: "https://192.0.2.1/" + name, conditions });
    const rules = [rule("campaign", { query: [{ key: "campaign", op: "equals", value: "summer" }] }),
      rule("french-mobile", { devices: ["mobile"], languages: ["fr"] }), rule("France", { countries: ["FR"] })];
    assert.equal((await request("GET", api)).status, 401);
    assert.equal((await request("GET", "/link/routing/" + link.id)).status, 401);
    response = await request("GET", api, undefined, session);
    assert.deepEqual(await response.json(), { revision: 0, rules: [], fallback });
    db.prepare("UPDATE links SET password=? WHERE uuid=?").run(require("bcryptjs").hashSync("legacy-password", 4), link.id);
    response = await request("GET", "/" + address + "?legacy=" + "x".repeat(2500), undefined, undefined, { Accept: "text/html" });
    assert.equal(response.status, 200, "Default-only protected links must keep ignoring legacy query strings");
    assert.match(await response.text(), /name="routing_query" value=""/);
    response = await request("POST", "/api/links/" + link.id + "/protected", { password: "legacy-password" }, undefined, { "User-Agent": ua });
    assert.equal((await response.json()).target, fallback);
    db.prepare("UPDATE links SET password=NULL WHERE uuid=?").run(link.id);
    await put(rules);
    response = await request("GET", "/" + address + "?campaign=winter&campaign=summer", undefined, undefined, { "User-Agent": ua, "Accept-Language": "fr-FR" });
    assert.equal(response.status, 302); assert.equal(response.headers.get("location"), rules[0].target);
    response = await request("GET", "/" + address, undefined, undefined, { "User-Agent": ua, "Accept-Language": "en;q=0.1,fr-FR;q=0.9" });
    assert.equal(response.headers.get("location"), rules[1].target);
    response = await request("GET", "/" + address, undefined, undefined, { "User-Agent": ua, "Accept-Language": "en,fr;q=0.1", "CF-IPCountry": "FR" });
    assert.equal(response.headers.get("location"), fallback, "Best language only, untrusted country ignored");
    // Drain the earlier successful redirects' asynchronous analytics before
    // asserting that preview itself has no side effects.
    for (let attempt = 0; attempt < 50; attempt++) {
      const count = db.prepare("SELECT redirect_count,visit_count FROM links WHERE uuid=?").get(link.id);
      if (count.visit_count === count.redirect_count) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const before = db.prepare("SELECT redirect_count,visit_count FROM links WHERE uuid=?").get(link.id);
    assert.equal(before.visit_count, before.redirect_count);
    for (const [context, index] of [[{ device: "desktop", country: "FR" }, 2], [{ device: "mobile", language: "fr-CA" }, 1], [{ device: "desktop", country: "BE" }, null], [{ query: "campaign=summer" }, 0]]) {
      response = await request("POST", api + "/preview", { context }, session);
      assert.equal(response.status, 200); const preview = await response.json();
      assert.equal(preview.rule_index, index); assert.equal(preview.preview, true);
    }
    assert.deepEqual(db.prepare("SELECT redirect_count,visit_count FROM links WHERE uuid=?").get(link.id), before, "Preview never records visits/quota");
    response = await request("HEAD", "/" + address + "?campaign=summer");
    assert.equal(response.headers.get("location"), rules[0].target);
    assert.equal(db.prepare("SELECT redirect_count FROM links WHERE uuid=?").get(link.id).redirect_count, before.redirect_count);
    response = await request("GET", "/" + address + "+"); assert.equal((await response.json()).target, fallback);
    const reversed = [rules[1], rules[0], rules[2]]; await put(reversed);
    response = await request("GET", "/" + address + "?campaign=summer", undefined, undefined, { "User-Agent": ua, "Accept-Language": "fr" });
    assert.equal(response.headers.get("location"), rules[1].target, "Ordered first match");
    const compound = [rule("compound", { query: [{ key: "empty", op: "present" }, { key: "skip", op: "absent" }, { key: "x", op: "equals", value: "a b" }] })];
    await put(compound);
    for (const [query, selected] of [["empty=&x=a+b", true], ["x=a+b", false], ["empty=&x=a%20b&skip=", false]]) {
      response = await request("GET", "/" + address + "?" + query);
      assert.equal(response.headers.get("location"), selected ? compound[0].target : fallback);
    }
    await put([rule("bot", { devices: ["bot"] }), rule("tablet", { devices: ["tablet"] })]);
    response = await request("GET", "/" + address, undefined, undefined, { "User-Agent": "Googlebot/2.1 (+http://www.google.com/bot.html)" });
    assert.equal(response.headers.get("location"), "https://192.0.2.1/bot");
    response = await request("GET", "/" + address, undefined, undefined, { "User-Agent": "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1" });
    assert.equal(response.headers.get("location"), "https://192.0.2.1/tablet");
    await put(rules);
    const token = async scopes => {
      const r = await request("POST", "/api/tokens", { name: "routing test", scopes, domain_scope: "default" }, session);
      assert.equal(r.status, 201); return r.json();
    };
    const read = await token(["links:read"]), update = await token(["links:update"]);
    assert.equal((await request("GET", api, undefined, undefined, { "X-API-Key": read.token })).status, 200);
    assert.equal((await request("PUT", api, { revision, rules }, session, { "X-API-Key": read.token })).status, 403);
    await put(rules, { "X-API-Key": update.token });
    assert.equal((await request("GET", api, undefined, session, { "X-API-Key": update.token })).status, 403);
    assert.equal((await request("POST", api + "/preview", { context: {} }, undefined, { "X-API-Key": read.token })).status, 200);
    assert.equal((await request("GET", "/link/routing/" + link.id, undefined, session, { "X-API-Key": read.token })).status, 403);
    for (const context of [{ device: "tv" }, { country: "France" }, { language: "*" }, { query: "q=" + "a".repeat(2048) }, { query: "q=a#b" }, { extra: true }]) {
      assert.equal((await request("POST", api + "/preview", { context }, session)).status, 400);
    }
    for (const format of ["json", "csv"]) {
      response = await request("GET", "/api/transfer/export?format=" + format + "&q=" + address, undefined, session);
      assert.equal(response.status, 200);
      const content = await response.text(), input = { format, content, conflict: "rename" };
      if (format === "json") assert.deepEqual(JSON.parse(content).links[0].routing_rules, rules);
      const preview = await request("POST", "/api/transfer/preview", input, session);
      assert.equal(preview.status, 200); const plan = await preview.json(); assert.equal(plan.valid, true);
      const committed = await request("POST", "/api/transfer/commit", { ...input, preview_token: plan.preview_token }, session);
      assert.equal(committed.status, 201); const imported = (await committed.json()).created[0];
      const restored = await request("GET", "/api/links/" + imported.id + "/routing", undefined, session);
      assert.deepEqual((await restored.json()).rules, rules);
      assert.equal((await request("GET", "/" + imported.address + "?campaign=summer")).headers.get("location"), rules[0].target);
    }
    const creator = await token(["links:create"]);
    response = await request("POST", "/api/transfer/preview", { format: "json", conflict: "abort", content: JSON.stringify([{ address: "routing-import-denied", target: fallback, routing_rules: rules }]) }, session, { "X-API-Key": creator.token });
    assert.equal(response.status, 200); assert.equal((await response.json()).valid, false, "Creating rules also requires update scope");
    for (const bad of [null, {}, Array(21).fill(rules[0]), [{ ...rules[0], target: "javascript:alert(1)" }], [{ ...rules[0], target: "https://user:pass@192.0.2.1/" }],
      [{ ...rules[0], target: `https://${env.DEFAULT_DOMAIN}/loop` }], [{ ...rules[0], extra: true }], [{ ...rules[0], conditions: {} }], [{ ...rules[0], conditions: { devices: ["tv"] } }],
      [{ ...rules[0], conditions: { languages: ["*" ] } }], [{ ...rules[0], conditions: { countries: ["France"] } }],
      [{ ...rules[0], conditions: { query: [{ key: "q", op: "regex", value: ".*" }] } }]]) {
      assert.equal((await request("PUT", api, { rules: bad, revision }, session)).status, 400);
    }
    assert.equal((await request("PUT", api, { rules, revision }, session, { Origin: "https://attacker.invalid" })).status, 403);
    assert.equal((await request("PUT", api, { rules, revision }, session, { "Sec-Fetch-Site": "cross-site" })).status, 403);
    const writes = await Promise.all([1, 2].map(() => request("PUT", api, { rules, revision }, session)));
    assert.deepEqual(writes.map(r => r.status).sort(), [200, 409], "Stale concurrent edits must not overwrite"); revision++;
    db.exec(`CREATE TRIGGER routing_fail BEFORE INSERT ON link_history WHEN NEW.action='routing_updated' BEGIN SELECT RAISE(ABORT,'forced audit failure'); END`);
    assert.equal((await request("PUT", api, { rules: [], revision }, session)).status, 500);
    db.exec("DROP TRIGGER routing_fail");
    assert.equal((await (await request("GET", api, undefined, session)).json()).revision, revision);
    await restart(); assert.deepEqual((await (await request("GET", api, undefined, session)).json()).rules, rules);
    db.prepare("UPDATE links SET password=? WHERE uuid=?").run(require("bcryptjs").hashSync("secret-route", 4), link.id);
    assert.equal((await request("GET", "/" + address + "?campaign=" + "x".repeat(2500))).status, 400, "Active routing still bounds its query input");
    response = await request("GET", "/" + address + "?campaign=summer", undefined, undefined, { Accept: "text/html" });
    assert.equal(response.status, 200); const html = await response.text(); assert.match(html, /name="routing_query" value="campaign(?:=|&#x3D;)summer"/);
    assert(!html.includes(rules[0].target));
    response = await request("POST", "/api/links/" + link.id + "/protected", { password: "secret-route", routing_query: "campaign=summer" });
    assert.equal(response.status, 200); assert.equal((await response.json()).target, rules[0].target);
    response = await request("GET", "/" + address + "?campaign=summer", undefined, undefined, { Authorization: "Basic " + Buffer.from("any:secret-route").toString("base64") });
    assert.equal(response.headers.get("location"), rules[0].target);
    assert.equal((await request("POST", "/api/links/" + link.id + "/protected", { password: "wrong", routing_query: "campaign=summer" })).status, 401);
    const bannedTarget = Number(db.prepare("INSERT INTO domains(uuid,address,user_id,banned) VALUES(?,?,?,1)").run(randomUUID(), "192.0.2.1", other).lastInsertRowid);
    assert.equal((await request("POST", "/api/links/" + link.id + "/protected", { password: "secret-route", routing_query: "campaign=summer" })).status, 410);
    assert.equal((await request("GET", "/" + address + "?campaign=summer", undefined, undefined, { Authorization: "Basic " + Buffer.from("any:secret-route").toString("base64") })).status, 410);
    db.prepare("DELETE FROM domains WHERE id=?").run(bannedTarget);
    db.prepare("UPDATE links SET paused=1 WHERE uuid=?").run(link.id);
    assert.equal((await request("GET", "/" + address)).status, 410);
    assert.equal((await request("POST", "/api/links/" + link.id + "/protected", { password: "secret-route", routing_query: "campaign=summer" })).status, 410);
    db.prepare("UPDATE links SET paused=0,password=NULL,max_visits=redirect_count+1 WHERE uuid=?").run(link.id);
    assert.equal((await request("GET", "/" + address + "?campaign=summer")).status, 302);
    assert.equal((await request("GET", "/" + address + "?campaign=summer")).status, 410);
    db.prepare("UPDATE links SET max_visits=NULL WHERE uuid=?").run(link.id);
    db.prepare("UPDATE link_routing SET rules='broken' WHERE link_id=(SELECT id FROM links WHERE uuid=?)").run(link.id);
    assert.equal((await request("GET", "/" + address)).status, 503, "Corrupt policy must not silently change routing");
    await put(rules); // Repair does not need a successful parse of corrupt state.
    for (const column of ["user_id", "banned", "deleted_at", "archived_domain"]) {
      db.prepare(`UPDATE links SET ${column}=? WHERE uuid=?`).run(column === "user_id" ? other : column === "banned" ? 1 : column === "deleted_at" ? Date.now() : "retired.invalid", link.id);
      assert.equal((await request("GET", api, undefined, session)).status, ["user_id", "banned"].includes(column) ? 404 : 410);
      db.prepare(`UPDATE links SET ${column}=? WHERE uuid=?`).run(column === "user_id" ? owner : column === "banned" ? 0 : null, link.id);
    }
    const domain = Number(db.prepare("INSERT INTO domains(uuid,address,user_id,banned) VALUES(?,?,?,0)").run(randomUUID(), "routing-owned.invalid", owner).lastInsertRowid);
    db.prepare("UPDATE links SET domain_id=? WHERE uuid=?").run(domain, link.id);
    assert.equal((await request("GET", api, undefined, session, { "X-API-Key": read.token })).status, 404);
    db.prepare("UPDATE domains SET user_id=? WHERE id=?").run(other, domain);
    assert.equal((await request("PUT", api, { rules, revision }, session)).status, 410);
    db.prepare("UPDATE links SET domain_id=NULL WHERE uuid=?").run(link.id);
    db.prepare("UPDATE users SET banned=1 WHERE id=?").run(owner);
    assert.equal((await request("GET", api, undefined, session)).status, 403);
    db.prepare("UPDATE users SET banned=0 WHERE id=?").run(owner);
    await put([]); assert.equal((await request("GET", "/" + address)).headers.get("location"), fallback);
    const down = spawnSync(process.execPath, [path.join(root, "node_modules/knex/bin/cli.js"), "--knexfile", path.join(root, "knexfile.js"), "migrate:down", "20260914030000_link_routing.js"], { cwd: directory, env, encoding: "utf8", timeout: 60000 });
    assert.notEqual(down.status, 0); assert.match(down.stdout + down.stderr, /Cannot discard routing/);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok"); assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: ordered routing, typed conditions, preview/no quota, country-header distrust, password paths, lifecycle, owner/domain/token/CSRF boundaries, optimistic concurrency, atomic rollback, restart and guarded downgrade");
  } finally { db.close(); }
};
