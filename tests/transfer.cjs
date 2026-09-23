const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { randomUUID, createHmac } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { parse } = require("csv-parse/sync");

module.exports = async function ({ request, session, database, account, restart, root, directory, env }) {
  const db = new Database(database);
  try {
    const owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
    const other = db.prepare("SELECT id FROM users WHERE email='other@example.com'").get().id;
    const call = (method, suffix, body, headers) => request(method, "/api/v2/transfer" + suffix, body, session, headers);
    const checked = async (response, status = 200) => {
      response = await response; assert.equal(response.status, status, await response.clone().text()); return response.json();
    };
    const row = (extra = {}) => ({ address: "transfer-" + randomUUID(), target: "https://192.0.2.1/transfer", ...extra });
    const input = (rows, conflict = "abort") => ({ format: "json", conflict, content: JSON.stringify({ schema_version: 1, links: rows }) });
    const preview = (body, headers) => checked(call("POST", "/preview", body, headers));
    const prepared = async (body, headers) => {
      const result = await preview(body, headers); assert.equal(result.valid, true, JSON.stringify(result));
      return { ...body, preview_token: result.preview_token };
    };
    const commit = (body, headers, status = 201) => checked(call("POST", "/commit", body, headers), status);
    const counts = () => Object.fromEntries(["links", "library_labels", "link_alias_claims", "link_history", "link_imports"].map(table => [table, db.prepare(`SELECT count(*) n FROM ${table}`).get().n]));
    const page = await request("GET", "/settings/transfer", undefined, session, { Accept: "text/html" });
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /<form[^>]*id="transfer-import"[^>]*method="post"/);
    assert.match(html, /<button[^>]*type="submit"[^>]*disabled[^>]*>Dry run<\/button>/);
    const templateBefore = counts();
    for (const prefix of ["/api/transfer", "/api/v2/transfer"]) {
      assert.equal((await request("GET", prefix + "/template")).status, 401);
      for (const format of ["json", "csv"]) {
        const response = await request("GET", prefix + "/template?format=" + format, undefined, session);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("cache-control"), "no-store");
        assert.equal(response.headers.get("x-content-type-options"), "nosniff");
        assert.equal(response.headers.get("content-disposition"), `attachment; filename="kutt-import-template.${format}"`);
        assert(response.headers.get("content-type").includes(format === "json" ? "application/json" : "text/csv"));
        const content = await response.text();
        const result = await preview({ format, conflict: "abort", content });
        assert(result.valid && result.rows.length === 1 && result.rows[0].action === "create");
        const sample = format === "json" ? JSON.parse(content).links[0] : parse(content, { columns: true })[0];
        assert.equal(String(sample.paused), "true", "Sample never starts as an active redirect");
        assert(!content.includes(account.email) && !content.includes(session));
      }
    }
    assert.deepEqual(counts(), templateBefore, "Template downloads and previews cannot write data");
    for (const query of ["format=xml", "format[x]=json", "format=json&format=csv"]) await checked(call("GET", "/template?" + query), 400);
    for (const [format, content, message] of [
      ["json", '{"bad":true}', "Start with the JSON template"],
      ["json", '{"target":"PRIVATE_VALUE",}', "Check commas"],
      ["csv", 'alias,url\nsecret,https://example.org', "address and target"],
      ["csv", 'address,target,paused\na,https://example.org,PRIVATE_VALUE', "Row 1, paused"],
      ["csv", 'address,target,max_visits\na,https://example.org,PRIVATE_VALUE', "Row 1, max_visits"],
      ["csv", 'address,target,tags\na,https://example.org,PRIVATE_VALUE', "Row 1, tags"],
      ["csv", 'address,target\n"PRIVATE_VALUE', "Malformed CSV near line 2"],
    ]) {
      const result = await checked(call("POST", "/preview", { format, conflict: "abort", content }), 400);
      assert(result.error.includes(message), result.error);
      assert(!result.error.includes("PRIVATE_VALUE"), "Never reflect parser input or credentials in errors");
    }
    for (const suffix of ["/export", "/preview", "/commit"]) assert.equal((await request(suffix === "/export" ? "GET" : "POST", "/api/transfer" + suffix, suffix === "/export" ? undefined : {})).status, 401);
    await checked(call("POST", "/preview", input([row()]), { Origin: "https://evil.example" }), 403);
    await checked(call("POST", "/commit", {}, { Origin: "null" }), 403);
    for (const body of [null, {}, { format: "xml", conflict: "abort", content: "hi" }, input([]), input(Array.from({ length: 101 }, () => row())), { format: "csv", conflict: "abort", content: "address,address\na,b" }, { format: "json", conflict: "abort", content: "null" }, { format: "json", conflict: "abort", content: "a".repeat(900001) }]) await checked(call("POST", "/preview", body), 400);
    await checked(call("POST", "/preview", { format: "json", conflict: "abort", content: "a".repeat(1100000) }), 413);
    for (const extra of [{ address: "settings" }, { address: "../x" }, { domain: false }, { target: "javascript:alert(1)" }, { target: "https:example.com" }, { target: "https://user:password@example.com" }, { target: "http://" + env.DEFAULT_DOMAIN }, { paused: "false" }, { max_visits: 0 }, { redirect_count: -1 }, { deleted_at: "yesterday" }, { starts_at: "2026-02-30T00:00:00Z" }, { tags: ["x", "X"] }, { user_id: other }, { password_required: true }, { banned: true }]) {
      const result = await preview(input([row(extra)])); assert.equal(result.valid, false, JSON.stringify(extra)); assert.equal(result.preview_token, null);
    }
    const blockedDomain = Number(db.prepare("INSERT INTO domains(uuid,address,user_id,banned) VALUES(?,?,?,1)").run(randomUUID(), "blocked-transfer.invalid", other).lastInsertRowid);
    assert.equal((await preview(input([row({ target: "https://blocked-transfer.invalid/path" })]))).valid, false);
    db.prepare("DELETE FROM domains WHERE id=?").run(blockedDomain);
    const description = '=HYPERLINK("bad.example","x"), quoted\nHébreu עברית';
    const source = row({ description, paused: true, starts_at: "2020-01-01T00:00:00Z", ends_at: "2090-01-01T00:00:00Z", max_visits: 5, redirect_count: 5, expires_at: "2090-02-01T00:00:00Z", tags: ["Tag, quoted"], collections: ["Reading"] });
    const before = counts(), batch = await prepared(input([source]));
    assert.deepEqual(counts(), before, "Dry run must not write links, labels, audit or receipts");
    assert(!JSON.stringify(batch.preview_token).includes(description));
    await checked(call("POST", "/commit", { ...batch, content: batch.content.replace("Reading", "Changed") }), 409);
    await checked(call("POST", "/commit", { ...batch, preview_token: batch.preview_token + "x" }), 403);
    assert.deepEqual(counts(), before);
    const result = await commit(batch);
    assert.equal(result.created.length, 1); assert.equal(result.skipped, 0);
    let stored = db.prepare("SELECT * FROM links WHERE uuid=?").get(result.created[0].id);
    assert.equal(stored.user_id, owner); assert.equal(stored.paused, 1); assert.equal(stored.redirect_count, 5);
    assert.equal((await request("GET", "/" + source.address)).status, 410);
    assert.equal((await commit(batch, undefined, 200)).created[0].id, stored.uuid);
    await restart();
    assert.equal((await commit(batch, undefined, 200)).replayed, true);
    const jsonResponse = await call("GET", "/export?state=all&q=" + source.address);
    assert.match(jsonResponse.headers.get("content-type"), /application\/json/); assert.equal(jsonResponse.headers.get("cache-control"), "no-store");
    assert.match(jsonResponse.headers.get("content-disposition"), /attachment/);
    const exported = await jsonResponse.json();
    assert.equal(exported.links.length, 1); assert.equal(exported.links[0].description, description); assert.deepEqual(exported.links[0].tags, source.tags);
    for (const field of ["password", "user_id", "apikey", "token_hash"]) assert(!(field in exported.links[0]));
    const csvResponse = await call("GET", "/export?format=csv&q=" + source.address);
    assert.match(csvResponse.headers.get("content-type"), /text\/csv/);
    const csv = await csvResponse.text(), csvRows = parse(csv, { columns: true });
    assert.equal(csvRows[0].description, "'" + description, "Spreadsheet formula escaped");
    const csvBatch = await prepared({ format: "csv", conflict: "rename", content: csv });
    const csvImported = await commit(csvBatch);
    const csvStored = db.prepare("SELECT * FROM links WHERE uuid=?").get(csvImported.created[0].id);
    assert.equal(csvStored.description, description); assert.equal(csvStored.redirect_count, 5); assert.equal(csvStored.paused, 1);
    assert.notEqual(csvStored.address, source.address);
    const conflict = await preview(input([source])); assert.equal(conflict.valid, false);
    const skip = await commit(await prepared(input([source, source], "skip"))); assert.equal(skip.skipped, 2); assert.equal(skip.created.length, 0);
    const duplicate = row(); assert.equal((await preview(input([duplicate, duplicate]))).valid, false);
    const duplicatedRename = await commit(await prepared(input([duplicate, duplicate], "rename"))); assert.equal(duplicatedRename.created.length, 2);
    const late = row(), lateBatch = await prepared(input([late]));
    await commit(await prepared(input([late])));
    const lateBefore = counts(); await checked(call("POST", "/commit", lateBatch), 409); assert.deepEqual(counts(), lateBefore);
    const rollbackRows = [row(), row({ address: "transfer-rollback-second" })], rollback = await prepared(input(rollbackRows));
    db.exec("CREATE TRIGGER transfer_fail BEFORE INSERT ON links WHEN NEW.address='transfer-rollback-second' BEGIN SELECT RAISE(ABORT, 'fixture'); END");
    const atomicBefore = counts(); await checked(call("POST", "/commit", rollback), 500); assert.deepEqual(counts(), atomicBefore, "Rollback after first insert must include all associated tables");
    db.exec("DROP TRIGGER transfer_fail");
    const retry = await commit(rollback); assert.equal(retry.created.length, 2);
    const simultaneous = await prepared(input([row()]));
    const responses = await Promise.all([call("POST", "/commit", simultaneous), call("POST", "/commit", simultaneous)]);
    assert.deepEqual(responses.map(r => r.status).sort(), [200, 201]);
    assert.equal((await responses[0].json()).created[0].id, (await responses[1].json()).created[0].id);
    const protectedRow = row({ password_required: true, password: "test-only-protected-link" });
    const protectedResult = await commit(await prepared(input([protectedRow])));
    const protectedStored = db.prepare("SELECT * FROM links WHERE uuid=?").get(protectedResult.created[0].id);
    assert.notEqual(protectedStored.password, protectedRow.password); assert.match(protectedStored.password, /^\$2/);
    assert.equal((await request("GET", "/" + protectedRow.address)).status, 200, "Password prompt instead of redirect");
    const protectedExport = await checked(call("GET", "/export?q=" + protectedRow.address));
    assert(!JSON.stringify(protectedExport).includes(protectedStored.password)); assert(!JSON.stringify(protectedExport).includes(protectedRow.password));
    assert.equal((await preview(input(protectedExport.links, "rename"))).valid, false);
    const trashRow = row({ deleted_at: "2025-01-01T00:00:00Z" }), trashBatch = await prepared(input([trashRow]));
    await commit(trashBatch); assert.equal((await request("GET", "/" + trashRow.address)).status, 410);
    await commit(trashBatch, undefined, 200);
    await checked(request("DELETE", "/api/links/" + stored.uuid, undefined, session));
    await checked(call("POST", "/commit", batch), 409, "Retry cannot resurrect subsequently deleted link");
    const trashExport = await checked(call("GET", "/export?state=trash&q=" + source.address)); assert.equal(trashExport.links.length, 1);
    for (const q of ["?state=bad", "?format=html", "?q[x]=x"]) await checked(call("GET", "/export" + q), 400);
    assert.equal((await checked(call("GET", "/export?q=%25"))).links.length, 0);
    db.prepare("UPDATE links SET user_id=? WHERE uuid=?").run(other, protectedStored.uuid);
    assert.equal((await checked(call("GET", "/export?q=" + protectedRow.address))).links.length, 0, "Admin exports only own links");
    const token = async (scopes, domain_scope = "all") => (await checked(request("POST", "/api/tokens", { name: "Transfer test", scopes, domain_scope }, session), 201)).token;
    const reader = { "X-API-Key": await token(["links:read"]) }, creator = { "X-API-Key": await token(["links:create"]) };
    await checked(call("GET", "/template", undefined, reader), 403);
    assert.equal((await call("GET", "/template", undefined, creator)).status, 200, "Create-only key may get a generic import template");
    await checked(call("POST", "/preview", input([row()]), reader), 403); await checked(call("GET", "/export", undefined, creator), 403);
    assert.equal((await request("GET", "/settings/transfer", undefined, session, reader)).status, 403);
    assert.equal((await preview(input([row({ tags: ["Tag, quoted"] })]), creator)).valid, false);
    const bound = await prepared(input([row()]), creator); await checked(call("POST", "/commit", bound), 409);
    await commit(bound, creator);
    const domainUuid = randomUUID();
    db.prepare("INSERT INTO domains(uuid,address,user_id) VALUES(?,?,?)").run(domainUuid, "transfer.example", owner);
    const limited = { "X-API-Key": await token(["links:create", "links:read", "links:update"], "default") };
    assert.equal((await preview(input([row({ domain: "transfer.example" })]), limited)).valid, false);
    assert.equal((await preview(input([row({ domain: "unowned.example" })]))).valid, false);
    assert.equal((await preview(input([row({ tags: ["New forbidden label"] })]), limited)).valid, false);
    await commit(await prepared(input([row({ tags: ["Tag, quoted"] })]), limited), limited);
    const domainToken = { "X-API-Key": await token(["links:create", "links:read"], domainUuid) };
    const domainRow = row({ domain: "transfer.example" }); await commit(await prepared(input([domainRow]), domainToken), domainToken);
    assert.equal((await checked(call("GET", "/export", undefined, domainToken))).links.length, 1);
    assert.equal((await checked(call("GET", "/export?q=" + domainRow.address, undefined, limited))).links.length, 0);
    const expired = await prepared(input([row()]));
    const payload = JSON.parse(Buffer.from(expired.preview_token.split(".")[0], "base64url")); payload.expires = Date.now() - 1;
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    expired.preview_token = encoded + "." + createHmac("sha256", env.JWT_SECRET).update("kutt-transfer-v1\0" + JSON.stringify(encoded)).digest("hex");
    await checked(call("POST", "/commit", expired), 409);
    const revokedToken = await token(["links:create"]), revokedHeader = { "X-API-Key": revokedToken };
    const revokedBatch = await prepared(input([row()]), revokedHeader);
    db.prepare("UPDATE api_tokens SET revoked_at=? WHERE prefix=?").run(Date.now(), revokedToken.slice(0, 13));
    await checked(call("POST", "/commit", revokedBatch, revokedHeader), 401);
    const oldBatch = await prepared(input([row()])); await commit(oldBatch);
    const oldId = JSON.parse(Buffer.from(oldBatch.preview_token.split(".")[0], "base64url")).id;
    db.prepare("UPDATE link_imports SET created_at=? WHERE id=?").run(Date.now() - 86400001, oldId);
    await checked(call("POST", "/commit", oldBatch), 409);
    const cap = await prepared(input([row()]));
    const receipts = db.prepare("SELECT count(*) n FROM link_imports WHERE user_id=? AND created_at>=?").get(owner, Date.now() - 86400000).n;
    const fixtureReceiptIds = Array.from({ length: 100 - receipts }, () => randomUUID());
    db.transaction(() => { for (const id of fixtureReceiptIds) db.prepare("INSERT INTO link_imports(id,user_id,input_hash,created_at,result) VALUES(?,?,?,?,?)").run(id, owner, "0".repeat(64), Date.now(), '{}'); })();
    const cappedBefore = counts(); await checked(call("POST", "/commit", cap), 429); assert.deepEqual(counts(), cappedBefore);
    db.transaction(() => { for (const id of fixtureReceiptIds) db.prepare("DELETE FROM link_imports WHERE id=?").run(id); })();
    await commit(cap); assert.equal(db.prepare("SELECT id FROM link_imports WHERE id=?").get(oldId), undefined, "Expired receipts cleaned on successful import");
    const manyIds = [];
    db.transaction(() => {
      for (let n = 0; n < 1001; n++) manyIds.push(db.prepare("INSERT INTO links(address,target,user_id) VALUES(?,?,?)").run("export-limit-" + n, "https://192.0.2.1/", owner).lastInsertRowid);
    })();
    await checked(call("GET", "/export?q=export-limit-"), 413);
    db.transaction(() => { for (const id of manyIds) db.prepare("DELETE FROM links WHERE id=?").run(id); })();
    const down = spawnSync(process.execPath, [path.join(root, "node_modules/knex/bin/cli.js"), "--knexfile", path.join(root, "knexfile.js"), "migrate:down", "20260914010000_link_imports.js"], { cwd: directory, env, timeout: 60000, encoding: "utf8" });
    assert.notEqual(down.status, 0, "Nonempty receipts cannot be silently discarded");
    assert.equal(db.pragma("quick_check", { simple: true }), "ok"); assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: CSV/JSON transfer, formula-safe roundtrip, signed dry run, protected links, lifecycle/trash, conflict policies, atomic rollback, concurrent/restart replay, CSRF/owner/token/domain limits and guarded downgrade");
  } finally { db.close(); }
};
