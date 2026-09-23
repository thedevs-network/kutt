const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const Database = require("better-sqlite3");
module.exports = async ({ request, session, database, account, restart, root, directory, env }) => {
  const db = new Database(database), owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
  const create = async (address, target = "https://192.0.2.1/base?fixed=owner#part") => {
    const response = await request("POST", "/api/links", { customurl: address, target }, session);
    assert.equal(response.status, 201, await response.clone().text()); return response.json();
  };
  try {
    const prefix = "nested-" + randomUUID().slice(0, 8), address = prefix + "/guide/start";
    const link = await create(address), api = "/api/v2/links/" + link.id + "/forwarding";
    let revision = 0;
    const config = { query_keys: ["utm_source", "fixed"], path_prefixes: ["docs", "products/manuals"] };
    const put = async value => {
      const response = await request("PUT", api, { ...value, revision }, session);
      assert.equal(response.status, 200, await response.clone().text()); revision = (await response.json()).revision;
    };
    let response = await request("GET", "/" + address + "?utm_source=ignored");
    assert.equal(response.status, 302); assert.equal(response.headers.get("location"), link.target);
    assert.equal((await request("GET", "/" + address + "/docs/start")).status, 404);
    assert.equal((await request("GET", api)).status, 401);
    assert.equal((await request("GET", "/link/forwarding/" + link.id)).status, 401);
    for (const alias of ["api/links", "API/x", "settings/x", "scripts/file", ".well-known/file", "a//b", "a/../b", "a/./b", "/a", "a/", "a%2fb", "a\\b", Array(9).fill("a").join("/"), "a/" + "b".repeat(63)]) {
      assert.equal((await request("POST", "/api/links", { customurl: alias, target: "https://192.0.2.1/" }, session)).status, 400, alias);
    }
    await put(config);
    const expected = "https://192.0.2.1/base/docs/start?fixed=owner&utm_source=a+b&utm_source=c#part";
    response = await request("GET", "/" + address + "/docs/start?fixed=attacker&utm_source=a%20b&utm_source=c&token=secret&unknown=no");
    assert.equal(response.status, 302); assert.equal(response.headers.get("location"), expected);
    assert.match(response.headers.get("cache-control"), /no-store/);
    for (const suffix of ["docs-other", "other", "products", "docs//x", "docs/%252e%252e/x", "docs/a%2fb", "docs/a%5cb", "docs/%00", "docs/" + "a".repeat(257)]) {
      response = await request("GET", "/" + address + "/" + suffix);
      assert([400, 404].includes(response.status), suffix + ": " + response.status);
    }
    // A child wins even when its parent has a matching forwarding prefix.
    const child = await create(address + "/docs", "https://192.0.2.1/child");
    assert.equal((await request("GET", "/" + address + "/docs")).headers.get("location"), child.target);
    assert.equal((await request("GET", "/" + address + "/docs/start")).status, 404);
    assert.equal((await request("DELETE", "/api/links/" + child.id, undefined, session)).status, 200);
    assert.equal((await request("GET", "/" + address + "/docs")).status, 410);
    const renamed = await create(address + "/products/manuals", "https://192.0.2.1/retired");
    assert.equal((await request("PATCH", "/api/links/" + renamed.id, { address: prefix + "/moved" }, session)).status, 200);
    assert.equal((await request("GET", "/" + address + "/products/manuals/chapter")).status, 410);
    // Remove only this disposable child and its claim to resume parent tests.
    db.prepare("DELETE FROM link_alias_claims WHERE link_uuid=?").run(child.id);
    db.prepare("DELETE FROM links WHERE uuid=?").run(child.id);
    const count = db.prepare("SELECT redirect_count FROM links WHERE uuid=?").get(link.id).redirect_count;
    response = await request("POST", api + "/preview", { context: { query: "utm_source=a+b&utm_source=c&fixed=attacker" }, path: "docs/start" }, session);
    assert.equal(response.status, 200); assert.equal((await response.json()).target, expected);
    response = await request("HEAD", "/" + address + "/docs/start?utm_source=head");
    assert.equal(response.status, 302); assert.equal(db.prepare("SELECT redirect_count FROM links WHERE uuid=?").get(link.id).redirect_count, count);
    const rule = { name: "campaign", target: "https://192.0.2.1/campaign", conditions: { query: [{ key: "campaign", op: "present" }] } };
    assert.equal((await request("PUT", "/api/links/" + link.id + "/routing", { rules: [rule], revision: 0 }, session)).status, 200);
    response = await request("GET", "/" + address + "/docs/start?campaign=1&utm_source=book");
    assert.equal(response.headers.get("location"), "https://192.0.2.1/campaign/docs/start?utm_source=book");
    db.prepare("UPDATE links SET password=? WHERE uuid=?").run(require("bcryptjs").hashSync("forward-secret", 4), link.id);
    response = await request("GET", "/" + address + "/docs/start?utm_source=book", undefined, undefined, { Accept: "text/html" });
    assert.equal(response.status, 200); const html = await response.text();
    assert.match(html, /name="suffix_path" value="docs\/start"/); assert(!html.includes(link.target));
    response = await request("POST", "/api/links/" + link.id + "/protected", { password: "forward-secret", forwarding_path: "docs/start", routing_query: "campaign=1&utm_source=book" });
    assert.equal(response.status, 200); assert.equal((await response.json()).target, "https://192.0.2.1/campaign/docs/start?utm_source=book");
    response = await request("POST", "/api/links/" + link.id + "/protected", { password: "forward-secret", suffix_path: "docs/start", routing_query: "campaign=1&utm_source=book" });
    assert.equal(response.status, 200); assert.equal((await response.json()).target, "https://192.0.2.1/campaign/docs/start?utm_source=book");
    assert.equal((await request("POST", "/api/links/" + link.id + "/protected", { password: "forward-secret", suffix_path: "docs/start", forwarding_path: "other" })).status, 400);
    assert.equal((await request("POST", "/api/links/" + link.id + "/protected", { password: "forward-secret", forwarding_path: "../../evil" })).status, 400);
    assert.equal((await request("POST", "/api/links/" + link.id + "/protected", { password: "forward-secret", forwarding_path: "products/manuals/chapter" })).status, 410, "Protected UUID entry cannot bypass a retired child alias");
    assert.equal((await request("POST", "/api/links/" + link.id + "/protected", { password: "wrong", forwarding_path: "docs/start" })).status, 401);
    response = await request("GET", "/" + address + "/docs/start?utm_source=book", undefined, undefined, { Authorization: "Basic " + Buffer.from("any:forward-secret").toString("base64") });
    assert.equal(response.headers.get("location"), "https://192.0.2.1/base/docs/start?fixed=owner&utm_source=book#part");
    db.prepare("UPDATE links SET password=NULL WHERE uuid=?").run(link.id);
    const token = async scopes => {
      const response = await request("POST", "/api/tokens", { name: "Forwarding test", scopes, domain_scope: "default" }, session);
      assert.equal(response.status, 201); return response.json();
    };
    const read = await token(["links:read"]), update = await token(["links:update"]);
    assert.equal((await request("GET", api, undefined, undefined, { "X-API-Key": read.token })).status, 200);
    assert.equal((await request("PUT", api, { ...config, revision }, session, { "X-API-Key": read.token })).status, 403);
    assert.equal((await request("GET", api, undefined, session, { "X-API-Key": update.token })).status, 403);
    assert.equal((await request("PUT", api, { ...config, revision }, undefined, { "X-API-Key": update.token })).status, 200); revision++;
    assert.equal((await request("GET", "/link/forwarding/" + link.id, undefined, session, { "X-API-Key": read.token })).status, 403);
    assert.equal((await request("POST", api + "/preview", { context: {}, path: "docs/start" }, undefined, { "X-API-Key": read.token })).status, 200);
    assert.equal((await request("PUT", api, { ...config, revision }, session, { Origin: "https://attacker.invalid" })).status, 403);
    assert.equal((await request("PUT", api, { ...config, revision }, session, { "Sec-Fetch-Site": "cross-site" })).status, 403);
    const domain = Number(db.prepare("INSERT INTO domains(uuid,address,user_id,banned) VALUES(?,?,?,0)").run(randomUUID(), prefix + ".example.invalid", owner).lastInsertRowid);
    db.prepare("UPDATE links SET domain_id=? WHERE uuid=?").run(domain, link.id);
    assert.equal((await request("GET", api, undefined, session, { "X-API-Key": read.token })).status, 404);
    assert.equal((await request("PUT", api, { ...config, revision }, session, { "X-API-Key": update.token })).status, 404);
    assert.equal((await request("GET", api, undefined, session)).status, 200);
    db.prepare("UPDATE links SET domain_id=NULL WHERE uuid=?").run(link.id);
    assert.equal((await request("DELETE", "/api/tokens/" + read.id, undefined, session)).status, 204);
    assert.equal((await request("GET", api, undefined, session, { "X-API-Key": read.token })).status, 401);
    for (const bad of [{ query_keys: ["token"] }, { query_keys: ["x[]"] }, { query_keys: "x" }, { path_prefixes: [""] }, { path_prefixes: ["docs/../secret"] }, { path_prefixes: ["%2f"] }, { extra: true }]) {
      assert.equal((await request("PUT", api, { ...bad, revision }, session)).status, 400);
    }
    const writes = await Promise.all([1, 2].map(() => request("PUT", api, { ...config, revision }, session)));
    assert.deepEqual(writes.map(row => row.status).sort(), [200, 409]); revision++;
    db.exec("CREATE TRIGGER forwarding_fail BEFORE INSERT ON link_history WHEN NEW.action='forwarding_updated' BEGIN SELECT RAISE(ABORT,'forced audit failure'); END");
    assert.equal((await request("PUT", api, { query_keys: [], path_prefixes: [], revision }, session)).status, 500);
    db.exec("DROP TRIGGER forwarding_fail");
    await restart(); assert.equal((await (await request("GET", api, undefined, session)).json()).revision, revision);
    for (const format of ["json", "csv"]) {
      const exported = await request("GET", "/api/transfer/export?format=" + format + "&q=" + address, undefined, session);
      assert.equal(exported.status, 200); const content = await exported.text();
      const input = { format, content, conflict: "rename" };
      const preview = await (await request("POST", "/api/transfer/preview", input, session)).json();
      assert.equal(preview.valid, true, JSON.stringify(preview));
      const committed = await request("POST", "/api/transfer/commit", { ...input, preview_token: preview.preview_token }, session);
      assert.equal(committed.status, 201); const restored = (await committed.json()).created.find(item => item.address.includes("guide/start"));
      assert(restored);
      const current = await (await request("GET", "/api/links/" + restored.id + "/forwarding", undefined, session)).json();
      assert.deepEqual(current.query_keys, config.query_keys); assert.deepEqual(current.path_prefixes, config.path_prefixes);
    }
    const other = db.prepare("SELECT id FROM users WHERE email='other@example.com'").get().id;
    db.prepare("UPDATE links SET user_id=? WHERE uuid=?").run(other, link.id);
    assert.equal((await request("GET", api, undefined, session)).status, 404, "Even an admin cannot manage another owner's policy");
    db.prepare("UPDATE links SET user_id=? WHERE uuid=?").run(owner, link.id);
    db.prepare("UPDATE links SET paused=1 WHERE uuid=?").run(link.id);
    assert.equal((await request("GET", "/" + address + "/docs/start")).status, 410);
    db.prepare("UPDATE links SET paused=0,max_visits=redirect_count+1 WHERE uuid=?").run(link.id);
    assert.equal((await request("GET", "/" + address + "/docs/start")).status, 302);
    assert.equal((await request("GET", "/" + address + "/docs/start")).status, 410);
    db.prepare("UPDATE links SET max_visits=NULL WHERE uuid=?").run(link.id);
    db.prepare("UPDATE link_forwarding SET policy='broken' WHERE link_id=(SELECT id FROM links WHERE uuid=?)").run(link.id);
    assert.equal((await request("GET", "/" + address + "/docs/start")).status, 503);
    await put({});
    assert.equal((await request("GET", "/" + address + "/docs/start")).status, 404);
    assert.equal((await request("GET", "/" + address + "?utm_source=ignored")).headers.get("location"), link.target);
    const down = spawnSync(process.execPath, [path.join(root, "node_modules/knex/bin/cli.js"), "--knexfile", path.join(root, "knexfile.js"), "migrate:down", "20260914070000_link_forwarding.js"], { cwd: directory, env, encoding: "utf8", timeout: 60000 });
    assert.notEqual(down.status, 0); assert.match(down.stdout + down.stderr, /Cannot discard forwarding/);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok"); assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: nested aliases, reserved paths, exact/longest child and tombstone precedence, explicit bounded forwarding, target query precedence, protected/Basic/rule/HEAD/quota paths, owner/scoped/CSRF boundaries, conflicts, rollback/restart, transfer and downgrade guard");
  } finally { db.close(); }
};
