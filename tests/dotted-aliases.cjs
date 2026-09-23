const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");
const { symlinkSync, unlinkSync } = require("node:fs");
const Database = require("better-sqlite3");

module.exports = async ({ request, session, database, account, restart, root, directory, env }) => {
  const unit = spawnSync(process.execPath, [path.join(root, "tests/dotted-alias-unit.cjs")], { cwd: directory, env, encoding: "utf8", timeout: 10000 });
  assert.equal(unit.status, 0, unit.stdout + unit.stderr);
  process.stdout.write(unit.stdout);
  const impossibleAlphabet = spawnSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const utils = require(${JSON.stringify(path.join(root, "server/utils"))});
    assert.rejects(utils.generateId(null, null), error => error.statusCode === 503)
      .finally(() => require(${JSON.stringify(path.join(root, "server/knex"))}).destroy());
  `], { cwd: directory, env: { ...env, LINK_CUSTOM_ALPHABET: ".", LINK_LENGTH: "4" }, encoding: "utf8", timeout: 10000 });
  assert.equal(impossibleAlphabet.status, 0, impossibleAlphabet.stdout + impossibleAlphabet.stderr);
  const retries = spawnSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const nanoid = require.resolve(${JSON.stringify(path.join(root, "node_modules/nanoid"))});
    require(nanoid);
    const candidates = ['api', 'a..b', '.hidden', 'used.v1', 'safe.v1'], lookups = [];
    let attempts = 0;
    require.cache[nanoid].exports = { customAlphabet: () => () => { attempts++; return candidates.shift() || 'used.v1'; } };
    const utils = require(${JSON.stringify(path.join(root, "server/utils"))});
    require(${JSON.stringify(path.join(root, "server/link-history"))}).reserved = async address => {
      lookups.push(address); return address === 'used.v1';
    };
    (async () => {
      try {
        assert.equal(await utils.generateId(null, null), 'safe.v1');
        assert.deepEqual(lookups, ['used.v1', 'safe.v1']);
        await assert.rejects(utils.generateId(null, null), error => error.statusCode === 503);
        assert.equal(attempts, 105); assert.equal(lookups.length, 102);
      } finally { await require(${JSON.stringify(path.join(root, "server/knex"))}).destroy(); }
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `], { cwd: directory, env, encoding: "utf8", timeout: 10000 });
  assert.equal(retries.status, 0, retries.stdout + retries.stderr);
  const db = new Database(database);
  const checked = async (promise, status = 200) => {
    const response = await promise;
    assert.equal(response.status, status, await response.clone().text());
    return status === 204 ? null : response.json();
  };
  const prefix = "dots-" + randomUUID().slice(0, 8), target = "https://192.0.2.1/dotted";
  const create = (address, extra = {}, api = "/api") => checked(request("POST", api + "/links", { customurl: address, target, ...extra }, session), 201);
  const html = { Accept: "text/html" };
  const transfer = (format, content, conflict = "abort") => ({ format, content, conflict });
  const imported = async input => {
    const preview = await checked(request("POST", "/api/transfer/preview", input, session));
    assert.equal(preview.valid, true, JSON.stringify(preview));
    return checked(request("POST", "/api/transfer/commit", { ...input, preview_token: preview.preview_token }, session), 201);
  };
  try {
    symlinkSync(path.join(root, "static"), path.join(directory, "static"), "dir");
    const owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
    const invalid = [".hidden", "file.", "a..b", "a/../b", "a/./b", "a/.b", "a/b.", "/a.pdf", "a.pdf/", "a//b.pdf",
      "a%2eb", "a%252eb", "a%2fb", "a%5cb", "a\\b.pdf", "a?b.pdf", "a#b.pdf", "a\u0000b.pdf", "a.pdf\n",
      "\ta.pdf", "a.pdf\u007f", "a".repeat(61) + ".pdf", Array(9).fill("a.b").join("/"),
      "robots.txt", "FAVICON.ICO", "manifest.webmanifest", "MANIFEST.WEBMANIFEST/child", "API/file.pdf", "scripts/file.pdf"];
    for (const api of ["/api", "/api/v2"]) {
      const suffix = api === "/api" ? "one" : "two";
      const link = await create(prefix + "/" + suffix + ".pdf", {}, api);
      for (const method of ["GET", "HEAD"]) {
        const response = await request(method, "/" + link.address);
        assert.equal(response.status, 302); assert.equal(response.headers.get("location"), target);
      }
      const info = await checked(request("GET", "/" + link.address + "+"));
      assert.equal(info.target, target);
      let address = prefix + "/" + suffix + ".v2.pdf";
      await checked(request("PATCH", api + "/links/" + link.id, { address }, session));
      assert.equal((await request("GET", "/" + link.address)).status, 410);
      assert.equal((await request("GET", "/" + address)).headers.get("location"), target);
      address = prefix + "/" + suffix + ".admin.pdf";
      await checked(request("PATCH", api + "/links/admin/" + link.id, { address }, session));
      for (const bad of invalid) {
        for (const [method, route, body] of [
          ["POST", "/links", { customurl: bad, target }],
          ["PATCH", "/links/" + link.id, { address: bad }],
          ["PATCH", "/links/admin/" + link.id, { address: bad }]
        ]) await checked(request(method, api + route, body, session), 400);
      }
      assert.equal(db.prepare("SELECT address FROM links WHERE uuid=?").get(link.id).address, address);
      await checked(request("POST", api + "/links", { customurl: address, target }, session), 400);
    }
    const exact64 = await create("a".repeat(60) + ".pdf");
    assert.equal(exact64.address.length, 64);
    await create(Array(8).fill("a.b").join("/"));
    const upper = await create(prefix + ".PDF", { target: target + "/upper" });
    const lower = await create(prefix + ".pdf", { target: target + "/lower" });
    assert.notEqual(upper.id, lower.id);
    assert.equal((await request("GET", "/" + upper.address)).headers.get("location"), upper.target);
    assert.equal((await request("GET", "/" + lower.address)).headers.get("location"), lower.target);
    const protectedLink = await create(prefix + "/protected.pdf", { password: "disposable-dotted-password" });
    assert.equal((await request("GET", "/" + protectedLink.address, undefined, undefined, html)).status, 200);
    assert.equal((await checked(request("POST", "/api/links/" + protectedLink.id + "/protected", { password: "disposable-dotted-password" }))).target, target);
    for (const encoded of ["a%2fb.pdf", "a%5cb.pdf", "a%252eb.pdf"]) assert.equal((await request("GET", "/" + prefix + "/" + encoded)).status, 400);
    assert.equal((await request("GET", "/manifest.webmanifest")).status, 200);

    // Both native personal/admin forms accept the same grammar, without a client-only pattern.
    const nativeAddress = prefix + "/native.pdf";
    const native = await request("POST", "/api/links", { customurl: nativeAddress, target }, session, html);
    assert.equal(native.status, 200); assert((await native.text()).includes(nativeAddress));
    const nativeId = db.prepare("SELECT uuid FROM links WHERE address=?").get(nativeAddress).uuid;
    for (const [route, address] of [["/api/links/", prefix + "/native.v2.pdf"], ["/api/links/admin/", prefix + "/native.v3.pdf"]]) {
      const response = await request("PATCH", route + nativeId, { address }, session, html);
      assert.equal(response.status, 200); assert.match(await response.text(), /Link has been updated/);
      assert.equal(db.prepare("SELECT address FROM links WHERE uuid=?").get(nativeId).address, address);
    }

    const customDomain = prefix + ".example.invalid";
    db.prepare("INSERT INTO domains(uuid,address,user_id,banned) VALUES(?,?,?,0)").run(randomUUID(), customDomain, owner);
    const custom = await create(lower.address, { domain: customDomain, target: target + "/custom" });
    const customRedirect = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: "127.0.0.1", port: env.PORT, path: "/" + custom.address, headers: { Host: customDomain } }, res => { res.resume(); resolve(res); });
      req.on("error", reject); req.end();
    });
    assert.equal(customRedirect.statusCode, 302); assert.equal(customRedirect.headers.location, custom.target);
    const token = await checked(request("POST", "/api/tokens", { name: "Dotted default scope", scopes: ["links:create", "links:update"], domain_scope: "default" }, session), 201);
    await checked(request("POST", "/api/links", { customurl: prefix + ".token.pdf", target }, undefined, { "X-API-Key": token.token }), 201);
    await checked(request("PATCH", "/api/links/" + custom.id, { address: prefix + ".takeover.pdf" }, session, { "X-API-Key": token.token }), 404);

    const space = await checked(request("POST", "/api/workspaces", { name: prefix }, session), 201);
    const sharedAPI = "/api/workspaces/" + space.id;
    const shared = await checked(request("POST", sharedAPI + "/links", { address: prefix + "/shared.pdf", target }, session), 201);
    await checked(request("PATCH", sharedAPI + "/links/" + shared.id, { address: prefix + "/shared.v2.pdf" }, session));
    for (const address of invalid) {
      await checked(request("POST", sharedAPI + "/links", { address, target }, session), 400);
      await checked(request("PATCH", sharedAPI + "/links/" + shared.id, { address }, session), 400);
      const input = transfer("json", JSON.stringify({ schema_version: 1, links: [{ address, target }] }));
      const preview = await checked(request("POST", "/api/transfer/preview", input, session));
      assert.equal(preview.valid, false, address); assert.equal(preview.preview_token, null);
    }
    const nativeSpace = "/settings/workspaces/" + space.id;
    const sharedNative = prefix + "/native.shared.pdf";
    assert.equal((await request("POST", nativeSpace, { operation: "create_link", address: sharedNative, target }, session, html)).status, 303);
    const nativeSharedId = db.prepare("SELECT uuid FROM links WHERE address=?").get(sharedNative).uuid;
    const page = await (await request("GET", nativeSpace, undefined, session, html)).text();
    const revision = page.match(new RegExp('name="link_id" value="' + nativeSharedId + '"[^]*?name="edit_revision" value="([a-f0-9]+)"'))?.[1];
    assert(revision);
    assert.equal((await request("POST", nativeSpace, { operation: "edit_link", link_id: nativeSharedId, edit_revision: revision, address: prefix + "/native.shared.v2.pdf", target }, session, html)).status, 303);
    assert.equal(db.prepare("SELECT address FROM links WHERE uuid=?").get(nativeSharedId).address, prefix + "/native.shared.v2.pdf");

    for (const format of ["json", "csv"]) {
      const address = prefix + "/import." + format;
      const content = format === "json" ? JSON.stringify({ schema_version: 1, links: [{ address, target }] }) : "address,target\n" + address + "," + target + "\n";
      const result = await imported(transfer(format, content));
      assert.equal(result.created[0].address, address);
      const renamed = await imported(transfer(format, content, "rename"));
      assert.notEqual(renamed.created[0].address, address);
      assert.equal((await request("GET", "/" + renamed.created[0].address)).headers.get("location"), target);
      const exported = await request("GET", "/api/transfer/export?format=" + format + "&q=" + encodeURIComponent(address), undefined, session);
      assert.equal(exported.status, 200); assert((await exported.text()).includes(address));
    }
    const longRename = await imported(transfer("json", JSON.stringify({ schema_version: 1, links: [{ address: exact64.address, target }] }), "rename"));
    assert.equal(longRename.created[0].address.length, 64);

    // Exact dotted children and retired claims still take precedence over forwarding.
    const parent = await create(prefix + "/manual.v1");
    const child = await create(parent.address + "/guide.pdf", { target: target + "/child" });
    await checked(request("PUT", "/api/links/" + parent.id + "/forwarding", { revision: 0, path_prefixes: ["guide.pdf", "files"], query_keys: [] }, session));
    assert.equal((await request("GET", "/" + child.address)).headers.get("location"), child.target);
    for (const suffix of ["files/.hidden", "files/a..b", "files/file.", "files/~file"]) {
      assert.equal((await request("GET", "/" + parent.address + "/" + suffix)).headers.get("location"), target + "/" + suffix);
    }
    await checked(request("PATCH", "/api/links/" + child.id, { address: prefix + "/retired.v2.pdf" }, session));
    assert.equal((await request("GET", "/" + child.address)).status, 410);
    await checked(request("POST", "/api/links", { customurl: child.address, target }, session), 409);
    await checked(request("DELETE", "/api/links/" + lower.id, undefined, session));
    assert.equal((await request("GET", "/" + lower.address)).status, 410);
    await checked(request("POST", "/api/links/" + lower.id + "/restore", {}, session));
    await restart();
    assert.equal((await request("GET", "/" + lower.address)).headers.get("location"), lower.target);
    assert.equal((await request("GET", "/" + child.address)).status, 410);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    console.log("PASS: dotted aliases across API/native/admin/workspace/import paths, case/domain identity, scope, reserved/traversal controls, protected/HEAD/info redirects, claims/restart and unchanged forwarding");
  } finally {
    db.close();
    unlinkSync(path.join(directory, "static"));
  }
};
