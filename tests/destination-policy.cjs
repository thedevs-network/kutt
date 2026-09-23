const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const Database = require("better-sqlite3");

module.exports = async function ({ request, session, database, account, restart, env, root, directory }) {
  const policy = require("../server/destination-policy");
  const rules = ["192.0.2.1", "example.com", "*.trusted.example", "BÜCHER.example.", "[2001:db8::1]"];
  const compiled = policy.compile(JSON.stringify(rules));
  assert.deepEqual(compiled.hosts, ["192.0.2.1", "example.com", "*.trusted.example", "xn--bcher-kva.example", "[2001:db8::1]"]);
  for (const url of ["https://192.0.2.1/a?q=x#f", "http://EXAMPLE.COM.:8080/path", "https://a.b.trusted.example", "https://bücher.example", "http://[2001:db8::1]:8080/"]) assert(compiled.allows(url), url);
  for (const url of ["https://notexample.com", "https://www.example.com", "https://trusted.example", "https://trusted.example.attacker.test", "https://user:pass@example.com", "ftp://example.com", "javascript:alert(1)", "//example.com", "https://example.com\\@evil.test", "https://example.com/\n", null, {}]) assert.equal(compiled.allows(url), false);
  assert(policy.compile("").allows("mailto:test@example.com"), "Disabled policy preserves legacy destinations");
  assert.equal(policy.compile("[]").allows("https://example.com"), false);
  for (const input of [" ", "null", "{}", '"example.com"', '["https://example.com"]', '["example.com:443"]', '["*.com"]', '["*.192.0.2.1"]', '["127.1"]', '["0x7f000001"]', '["999.999.999.999"]', '["bad..example"]', '["example.com/"]', '["user@example.com"]', '["*"]', '[null]', JSON.stringify(Array(101).fill("example.com"))]) {
    assert.throws(() => policy.compile(input), /DESTINATION_ALLOWED_HOSTS/, input);
  }
  const invalid = spawnSync(process.execPath, ["-e", `require(${JSON.stringify(path.join(root, "server/env"))})`], {
    cwd: directory, env: { ...env, DESTINATION_ALLOWED_HOSTS: '["https://PRIVATE_CONFIG.example/SECRET"]' }, encoding: "utf8"
  });
  assert.notEqual(invalid.status, 0); assert(!invalid.stderr.includes("PRIVATE_CONFIG") && !invalid.stderr.includes("SECRET"));
  const db = new Database(database), prefix = "policy-" + randomUUID().slice(0, 8);
  const allowed = "https://192.0.2.1/allowed", denied = "https://198.51.100.2/blocked";
  const checked = async (promise, status = 200) => {
    const response = await promise;
    assert.equal(response.status, status, await response.clone().text());
    return response;
  };
  const json = async (promise, status = 200) => (await checked(promise, status)).json();
  // Node fetch normalizes Host; use native HTTP for real virtual-host coverage.
  const customRequest = (hostname, pathname) => new Promise((resolve, reject) => {
    const req = require("node:http").get({ hostname: "127.0.0.1", port: env.PORT, path: pathname, headers: { Host: hostname, Accept: "application/json" } }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () => resolve(new Response(Buffer.concat(chunks), { status: response.statusCode, headers: response.headers })));
    });
    req.on("error", reject); req.setTimeout(10000, () => req.destroy(new Error("Virtual-host test timeout")));
  });
  const create = (target, extra = {}, api = "/api") => json(request("POST", api + "/links", { target, customurl: prefix + "-" + randomUUID(), ...extra }, session), 201);
  const owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
  const startPolicy = async value => { env.DESTINATION_ALLOWED_HOSTS = value; await restart(); };
  try {
    assert.deepEqual(await json(request("GET", "/api/destination-policy", undefined, session)), { enabled: false, hosts: [] });
    const old = await create(denied), guarded = await create(denied, { password: "test-password", max_visits: 2 });
    const editable = await create(allowed);
    const customHost = prefix + ".example.invalid";
    const customDomain = Number(db.prepare("INSERT INTO domains(uuid,address,user_id,homepage,banned) VALUES(?,?,?,?,0)").run(randomUUID(), customHost, owner, denied).lastInsertRowid);
    const transfer = { format: "json", conflict: "abort", content: JSON.stringify({ schema_version: 1, links: [{ address: prefix + "/import", target: denied }] }) };
    const prepared = await json(request("POST", "/api/transfer/preview", transfer, session));
    assert(prepared.valid && prepared.preview_token);
    const token = await json(request("POST", "/api/tokens", { name: prefix, scopes: ["links:read", "links:create", "links:update"], domain_scope: "default" }, session), 201);
    const writeOnly = await json(request("POST", "/api/tokens", { name: prefix + "-write", scopes: ["links:create"], domain_scope: "default" }, session), 201);
    await startPolicy(JSON.stringify(["192.0.2.1"]));
    const healthCheck = spawnSync(process.execPath, ["-e", `(async()=>{const assert=require('node:assert/strict');const h=require(${JSON.stringify(path.join(root, "server/link-health"))});const safe=require(${JSON.stringify(path.join(root, "server/safe-http"))});let calls=0;safe.send=async()=>{calls++;throw new Error('Network must not be used')};const result=await h.probe({name:'Default',target:${JSON.stringify(denied)}});assert.equal(result.code,'DESTINATION_POLICY_DENIED');assert.equal(result.http_status,null);assert.equal(calls,0);await require(${JSON.stringify(path.join(root, "server/knex"))}).destroy()})().catch(e=>{console.error(e);process.exit(1)})`], { cwd: directory, env, encoding: "utf8", timeout: 30000 });
    assert.equal(healthCheck.status, 0, healthCheck.stderr);
    for (const api of ["/api", "/api/v2"]) {
      await checked(request("GET", api + "/destination-policy"), 401);
      const response = await checked(request("GET", api + "/destination-policy", undefined, undefined, { "X-API-Key": token.token }));
      assert.deepEqual(await response.json(), { enabled: true, hosts: ["192.0.2.1"] });
      assert.match(response.headers.get("cache-control"), /no-store/);
      await checked(request("GET", api + "/destination-policy", undefined, session, { "X-API-Key": writeOnly.token }), 403);
      await checked(request("GET", api + "/destination-policy", undefined, session, { "X-API-Key": "invalid" }), 401);
      await checked(request("POST", api + "/links", { target: denied }, session), 400);
      await checked(request("POST", api + "/links", { target: denied }, undefined, { "X-API-Key": token.token }), 400);
      await create(allowed, {}, api);
      for (const scope of ["/links/", "/links/admin/"]) await checked(request("PATCH", api + scope + editable.id, { target: denied }, session), 400);
      await checked(request("PATCH", api + "/links/" + old.id, { description: "Repair remains possible " + api }, session));
      for (const route of ["/domains", "/domains/admin"]) await checked(request("POST", api + route, { address: prefix + ".rejected.invalid", homepage: denied }, session), 400);
    }
    for (const route of ["/", "/missing-flat-alias"]) {
      const fallback = await checked(customRequest(customHost, route), 410);
      assert.equal(fallback.headers.get("location"), null); assert.match(fallback.headers.get("cache-control"), /no-store/);
    }
    db.prepare("UPDATE domains SET homepage=? WHERE id=?").run(allowed, customDomain);
    assert.equal((await customRequest(customHost, "/")).headers.get("location"), allowed);
    assert.equal(db.prepare("SELECT target FROM links WHERE uuid=?").get(editable.id).target, allowed);
    for (const method of ["GET", "HEAD"]) {
      const response = await checked(request(method, "/" + old.address), 410);
      assert.equal(response.headers.get("location"), null); assert.match(response.headers.get("cache-control"), /no-store/);
      await checked(request(method, "/" + guarded.address, undefined, undefined, { Authorization: "Basic " + Buffer.from("user:test-password").toString("base64") }), 410);
    }
    await checked(request("POST", "/api/links/" + guarded.id + "/protected", { password: "test-password" }), 410);
    assert.equal(db.prepare("SELECT redirect_count FROM links WHERE uuid=?").get(guarded.id).redirect_count, 0);
    assert.equal(db.prepare("SELECT visit_count FROM links WHERE uuid=?").get(old.id).visit_count, 0);
    const before = db.prepare("SELECT count(*) n FROM links").get().n;
    const preview = await json(request("POST", "/api/transfer/preview", transfer, session));
    assert.equal(preview.valid, false); assert.equal(preview.preview_token, null);
    const routingImport = { ...transfer, content: JSON.stringify({ schema_version: 1, links: [{ address: prefix + "/rules", target: allowed, routing_rules: [{ name: "French", target: denied, conditions: { languages: ["fr"] } }] }] }) };
    const refusedImport = await json(request("POST", "/api/transfer/preview", routingImport, session));
    assert.equal(refusedImport.valid, false); assert.equal(refusedImport.preview_token, null);
    await checked(request("POST", "/api/transfer/commit", { ...transfer, preview_token: prepared.preview_token }, session), 409);
    assert.equal(db.prepare("SELECT count(*) n FROM links").get().n, before);
    const routing = "/api/links/" + editable.id + "/routing";
    const rule = { name: "French", target: allowed, conditions: { languages: ["fr"] } };
    await checked(request("PUT", routing, { revision: 0, rules: [rule] }, session));
    const refusedRule = await checked(request("PUT", routing, { revision: 1, rules: [{ ...rule, target: denied }] }, session), 400);
    assert((await refusedRule.text()).includes(require("../locales/en.json")["destination_policy.denied"]));
    const editableId = db.prepare("SELECT id FROM links WHERE uuid=?").get(editable.id).id;
    db.prepare("UPDATE link_routing SET rules=? WHERE link_id=?").run(JSON.stringify([{ ...rule, target: denied }]), editableId);
    await checked(request("GET", "/" + editable.address, undefined, undefined, { "Accept-Language": "fr" }), 410);
    assert.equal((await request("GET", "/" + editable.address, undefined, undefined, { "Accept-Language": "en" })).headers.get("location"), allowed);
    await checked(request("POST", routing + "/preview", { context: { language: "fr" } }, session), 400);
    const forwarding = "/api/links/" + old.id + "/forwarding";
    await checked(request("PUT", forwarding, { revision: 0, query_keys: ["campaign"], path_prefixes: [] }, session), 400);
    await checked(request("POST", forwarding + "/preview", { context: {} }, session), 400);
    const workspace = await json(request("POST", "/api/workspaces", { name: prefix }, session), 201);
    await checked(request("POST", "/api/workspaces/" + workspace.id + "/links", { target: denied, address: prefix + "/shared" }, session), 400);
    const shared = await json(request("POST", "/api/workspaces/" + workspace.id + "/links", { target: allowed, address: prefix + "/shared" }, session), 201);
    await checked(request("PATCH", "/api/workspaces/" + workspace.id + "/links/" + shared.id, { target: denied }, session), 400);
    for (const locale of ["en", "fr", "es"]) {
      const catalog = require("../locales/" + locale + ".json");
      const page = await checked(request("GET", "/settings/destination-policy", undefined, session, { Accept: "text/html", "Accept-Language": locale }));
      const html = await page.text(); assert(html.includes(catalog["destination_policy.title"])); assert(html.includes("192.0.2.1"));
      const response = await checked(request("POST", "/api/links", { target: denied }, session, { "Accept-Language": locale }), 400);
      assert((await response.text()).includes(catalog["destination_policy.denied"]));
    }
    await checked(request("PATCH", "/api/links/" + old.id, { target: allowed }, session, { Origin: "https://other.example" }), 403);
    await checked(request("PATCH", "/api/links/" + old.id, { target: allowed }, session));
    assert.equal((await request("GET", "/" + old.address)).headers.get("location"), allowed);
    await startPolicy("[]");
    await checked(request("GET", "/" + old.address), 410);
    assert.deepEqual(await json(request("GET", "/api/destination-policy", undefined, session)), { enabled: true, hosts: [] });
    await startPolicy("");
    assert.equal((await request("GET", "/" + old.address)).headers.get("location"), allowed);
    assert.equal((await request("GET", "/" + guarded.address, undefined, undefined, { Authorization: "Basic " + Buffer.from("user:test-password").toString("base64") })).headers.get("location"), denied);
    await require("./destination-policy-edit.cjs")({ request, session, database, account, restart, env, root, directory });
    assert.equal(db.pragma("quick_check", { simple: true }), "ok"); assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: destination allowlist grammar/IDNA/wildcards, fail-closed startup, default compatibility, API/scopes/localized UI, create/edit/import/workspace denial, public/protected/HEAD counters, repair and restart rollback");
  } finally {
    env.DESTINATION_ALLOWED_HOSTS = "";
    await restart();
    db.close();
  }
};
