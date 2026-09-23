// Synthetic accounts and a fresh disposable DB only. No external DNS or mail.
const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const { existsSync, mkdtempSync, rmSync } = require("node:fs");
const path = require("node:path"), http = require("node:http"), net = require("node:net");
const { setTimeout: delay } = require("node:timers/promises");
const root = path.resolve(__dirname, "..");
assert(!existsSync(path.join(root, ".env")));
const external = process.env.KUTT_DATABASE_DISPOSABLE === "1";
const database = external ? Object.fromEntries(["DB_CLIENT", "DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"].map(key => [key, process.env[key]])) : {};
if (external) {
  assert.equal(database.DB_HOST, "127.0.0.1");
  assert.equal(database.DB_NAME, "kutt_search_regression");
  assert(["mysql2", "pg"].includes(database.DB_CLIENT));
}
function unit() {
  const { parse } = require("../server/management-origin");
  const env = { DEFAULT_DOMAIN: "short.example.invalid", isDev: true };
  assert.equal(parse("", env), null);
  assert.equal(parse("HTTPS://Manage.Example.Invalid:443/", env).origin, "https://manage.example.invalid");
  assert.equal(parse("https://münchen.example.invalid", env).host, "xn--mnchen-3ya.example.invalid");
  assert.equal(parse("http://localhost:4000", env).origin, "http://localhost:4000");
  for (const value of ["https://short.example.invalid:444", "https://www.short.example.invalid", "http://manage.example.invalid", "https://user@manage.invalid", "https://manage.invalid/path", "https://manage.invalid/?x", "https://manage.invalid/#", "https://manage.invalid\\x", "https://manage.invalid.", " https://manage.invalid", "https://manage%2einvalid", "https:manage.invalid", "https://bad..invalid", "https://-bad.invalid", "https://manage.invalid/../", "https://manage.invalid\n"]) assert.throws(() => parse(value, env), undefined, value);
  assert.throws(() => parse("http://localhost:4000", { ...env, isDev: false }));
  assert.throws(() => parse("https://manage.example.invalid:", env));
}

async function main() {
  await require("./domain-access-read.cjs")();
  unit();
  const directory = mkdtempSync(path.join(require("node:os").tmpdir(), "kutt-grants-"));
  let db, server, exited, output = "";
  const stop = async () => {
    if (!server) return;
    server.kill("SIGTERM"); await Promise.race([exited, delay(5000)]);
    if (server.exitCode === null && server.signalCode === null) { server.kill("SIGKILL"); await exited; }
    server = null;
  };
  try {
    const listener = net.createServer();
    await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
    const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
    const short = `127.0.0.1:${port}`, host = `localhost:${port}`, origin = "http://" + host;
    const env = { PATH: process.env.PATH, NODE_ENV: "development", PORT: String(port), DEFAULT_DOMAIN: short, MANAGEMENT_ORIGIN: origin,
      DB_CLIENT: "better-sqlite3", DB_FILENAME: path.join(directory, "fixture.sqlite"), ...database,
      JWT_SECRET: randomBytes(48).toString("hex"), REDIS_ENABLED: "false", MAIL_ENABLED: "false", OIDC_ENABLED: "false",
      DISALLOW_ANONYMOUS_LINKS: "false", DISALLOW_REGISTRATION: "true", DISALLOW_LOGIN_FORM: "false", ENABLE_RATE_LIMIT: "false", TRUST_PROXY: "false", NODE_APP_INSTANCE: "1" };
    for (const key of Object.keys(process.env)) if (key.endsWith("_FILE")) delete process.env[key];
    Object.assign(process.env, env);
    db = require("../server/knex");
    assert.equal(await db.schema.hasTable("users"), false, "Refuse an initialized database");
    await db.migrate.latest({ directory: path.join(root, "server/migrations") });
    const request = (method, endpoint, body, token, extra = {}, requestHost = host) => new Promise((resolve, reject) => {
      const req = http.request({ hostname: "127.0.0.1", port, method, path: endpoint,
        headers: { Host: requestHost, Accept: "application/json", ...(body !== undefined && { "Content-Type": "application/json" }),
          ...(token && { Cookie: "token=" + token }), ...extra } }, res => {
        const chunks = []; res.on("data", chunk => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString(),
          json() { return this.text ? JSON.parse(this.text) : null; } }));
      });
      req.setTimeout(15000, () => req.destroy(Error("Fixture HTTP timeout"))); req.on("error", reject);
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
    const checked = async (method, endpoint, body, token, expected = 200, extra, requestHost) => {
      const res = await request(method, endpoint, body, token, extra, requestHost);
      assert.equal(res.status, expected, method + " " + endpoint + " status=" + res.status + " " + (res.text.startsWith('{"error"') ? res.text : "") + (res.status >= 500 ? "\n" + output : ""));
      return res.json();
    };
    const start = async settings => {
      output = "";
      server = spawn(process.execPath, [path.join(root, "server/server.js")], { cwd: directory, env: { ...env, ...settings }, stdio: ["ignore", "pipe", "pipe"] });
      server.stdout.on("data", chunk => { output = (output + chunk).slice(-6000); });
      server.stderr.on("data", chunk => { output = (output + chunk).slice(-6000); });
      exited = new Promise(resolve => { server.once("exit", resolve); server.once("error", resolve); });
      for (let i = 0; i < 100; i++) {
        try { if ((await request("GET", "/api/health")).status === 200) return; } catch {}
        if (server.exitCode != null) break;
        await delay(100);
      }
      throw Error("Fixture startup failed: " + output);
    };
    await start();
    const password = randomBytes(32).toString("hex");
    const adminToken = (await checked("POST", "/api/auth/create-admin", { email: "admin@example.invalid", password }, null, 201, { Origin: origin })).token;
    const admin = await db("users").where({ email: "admin@example.invalid" }).first();
    const users = require("../server/queries/user.queries"), utils = require("../server/utils"), access = require("../server/domain-access");
    const owner = await users.add({ email: "owner@example.invalid", password: "fixture-no-login", verified: true });
    const recipient = await users.add({ email: "recipient@example.invalid", password: "fixture-no-login", verified: true });
    const stranger = await users.add({ email: "stranger@example.invalid", password: "fixture-no-login", verified: true });
    const ownerToken = utils.signToken(owner), recipientToken = utils.signToken(recipient), strangerToken = utils.signToken(stranger);
    const domain = { uuid: randomUUID(), address: "shared.example.invalid", user_id: owner.id };
    await db("domains").insert(domain); Object.assign(domain, await db("domains").where({ uuid: domain.uuid }).first());
    const endpoint = "/api/domains/" + domain.uuid + "/grants", target = "https://192.0.2.1/grants";
    const create = (alias, token = recipientToken, expected = 201, extra) => checked("POST", "/api/links", { target, customurl: alias, domain: domain.address }, token, expected, extra);
    for (const route of ["/", "/settings", "/login", "/logout", "/create-admin", "/add-domain", "/login/oidc", "/reset-password/opaque", "/verify/opaque", "/settings/domain-sharing", "/api/links", "/API/v2/links", "/api/auth/login", "/%6cogin", "/settings%2fsecurity", "/%61pi/links", "/api%2fv2%2flinks", "/%256cogin"]) {
      for (const requestHost of [short, domain.address, "foreign.example.invalid"]) {
        const response = await request("GET", route, undefined, adminToken, { "X-Forwarded-Host": host, "X-Forwarded-Proto": "https" }, requestHost);
        assert((route.includes("%") ? [400, 404] : [404]).includes(response.status), route + " on " + requestHost + ": " + response.status);
        assert(!response.headers.location); assert(!response.headers["set-cookie"]);
      }
    }
    for (const asset of ["/libs/htmx.min.js", "/fonts/nunito-variable.woff2"]) {
      const response = await request("GET", asset, undefined, adminToken, {}, short);
      assert.equal(response.status, 200); assert(!response.headers["set-cookie"]);
    }
    for (const requestHost of [short, domain.address]) {
      const denied = await request("POST", "/api/auth/login", { email: admin.email, password }, null, { Origin: origin, "X-Forwarded-Host": host }, requestHost);
      assert.equal(denied.status, 404); assert(!denied.headers.location); assert(!denied.headers["set-cookie"]);
    }
    for (const requestHost of ["localhost.evil.invalid:" + port, host + ".", host + ",foreign.invalid", "user@" + host]) {
      assert.equal((await request("GET", "/settings", undefined, adminToken, {}, requestHost)).status, 404);
    }
    for (const authorities of [[host, "foreign.invalid"], ["foreign.invalid", host]]) {
      const duplicate = await new Promise((resolve, reject) => {
        const req = http.request({ hostname: "127.0.0.1", port, path: "/settings", headers: ["Host", authorities[0], "Host", authorities[1], "Cookie", "token=" + adminToken] }, res => {
          res.resume(); res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
        });
        req.on("error", reject); req.end();
      });
      assert.equal(duplicate.status, 404); assert(!duplicate.headers.location); assert(!duplicate.headers["set-cookie"]);
    }
    for (const badOrigin of ["null", "http://" + short, "https://" + host, "https://foreign.invalid"]) {
      await checked("POST", "/api/auth/login", { email: admin.email, password }, null, 403, { Origin: badOrigin });
      await checked("POST", endpoint, { email: recipient.email }, ownerToken, 403, { Origin: badOrigin });
    }
    const login = await request("POST", "/api/auth/login", { email: admin.email, password }, null, { Origin: origin, Accept: "text/html" });
    assert.equal(login.status, 303);
    const cookies = login.headers["set-cookie"].filter(cookie => cookie.startsWith("token="));
    assert(cookies.some(cookie => /HttpOnly/.test(cookie) && /SameSite=Lax/.test(cookie) && /Path=\//.test(cookie)));
    assert(cookies.every(cookie => !/Domain=/i.test(cookie)));
    assert.equal(utils.getSiteURL(), origin);
    assert.equal(require("../server/handlers/shortcuts.handler").endpoint(), origin + "/api/v2/links");
    for (const kind of ["verify", "reset", "change-email"]) {
      const mail = require("../server/mail/render").render(kind, { domain: host, origin, site_name: "Fixture", token: "synthetic" });
      assert(mail.html.includes(origin + "/") && mail.text.includes(origin + "/")); assert(!mail.html.includes("https://" + short));
    }
    // Even a post-startup DB collision cannot grant or serve the management host.
    const collision = { uuid: randomUUID(), address: "localhost", user_id: owner.id };
    await db("domains").insert(collision);
    collision.id = (await db("domains").where({ uuid: collision.uuid }).first()).id;
    await assert.rejects(require("../server/management-origin").validateDatabase(), /already a short domain/);
    await assert.rejects(access.grant({ user: owner }, collision.uuid, { email: recipient.email }), /management/i);
    await db("domain_grants").insert({ id: randomUUID(), domain_id: collision.id, user_id: recipient.id, created_at: Date.now() });
    assert.equal(await access.find(db, recipient.id, { id: collision.id }), undefined);
    await db.transaction(async transaction => {
      await access.lock(transaction);
      assert.equal(await access.find(transaction, recipient.id, { id: collision.id }), undefined);
    });
    await db("links").insert({ uuid: randomUUID(), address: "management-shadow", target, domain_id: collision.id, user_id: recipient.id });
    assert.equal((await request("GET", "/management-shadow", undefined, adminToken)).status, 404);
    await db("links").where({ domain_id: collision.id }).delete();
    await db("domain_grants").where({ domain_id: collision.id }).delete();
    await db("domains").where({ id: collision.id }).delete();
    await create("before-grant", recipientToken, 400);
    await create("guest-grant", null, 400);
    await checked("POST", endpoint, { email: recipient.email }, strangerToken, 404);
    const grant = await checked("POST", endpoint, { email: recipient.email }, ownerToken, 201, { Origin: origin });
    await checked("POST", endpoint, { email: stranger.email }, recipientToken, 404);
    await checked("GET", endpoint, undefined, recipientToken, 404);
    const available = await checked("GET", "/api/domains/available", undefined, recipientToken);
    assert.deepEqual(available.data, [{ id: domain.uuid, address: domain.address, owned: false }]);
    const shared = await create("shared/guide.pdf");
    assert.equal((await db("links").where({ uuid: shared.id }).first()).user_id, recipient.id);
    const protectedLink = await checked("POST", "/api/links", { target, customurl: "shared-protected", domain: domain.address, password: "synthetic-protection" }, recipientToken, 201);
    const forward = await create("shared-forward");
    await checked("PUT", "/api/links/" + forward.id + "/forwarding", { revision: 0, query_keys: ["page"], path_prefixes: ["docs"] }, recipientToken);
    const scoped = await checked("POST", "/api/tokens", { name: "Shared", scopes: ["links:read", "links:create", "links:update", "stats:read"], domain_scope: domain.uuid }, recipientToken, 201);
    const all = await checked("POST", "/api/tokens", { name: "All", scopes: ["links:read", "links:create", "links:update", "stats:read"], domain_scope: "all" }, recipientToken, 201);
    const grantToken = await checked("POST", "/api/tokens", { name: "Sharing", scopes: ["domains:share"], domain_scope: domain.uuid }, ownerToken, 201);
    await checked("GET", endpoint, undefined, null, 200, { "X-API-Key": grantToken.token });
    await checked("GET", endpoint, undefined, null, 403, { "X-API-Key": scoped.token });
    for (const route of ["/api/links/" + shared.id + "/stats", "/api/links/" + shared.id + "/qr", "/api/links/" + shared.id + "/history"]) {
      const response = await request("GET", route, undefined, ownerToken);
      assert.equal(response.status, route.endsWith("/stats") ? 500 : 404, route);
      assert(!response.text.includes(target));
    }
    assert(!(await checked("GET", "/api/links", undefined, ownerToken)).data.some(link => link.id === shared.id));
    const ownerLink = await create("owner-analytics", ownerToken);
    const sharedId = (await db("links").where({ uuid: shared.id }).first()).id;
    const ownerLinkId = (await db("links").where({ uuid: ownerLink.id }).first()).id;
    for (const [link_id, user_id, total] of [[sharedId, recipient.id, 7], [ownerLinkId, owner.id, 100], [ownerLinkId, recipient.id, 900]]) {
      await db("visits").insert({ link_id, user_id, created_at: "2024-01-01 00:00:00", total,
        br_safari: total, os_ios: total, countries: JSON.stringify({ fr: total }), referrers: JSON.stringify({ direct: total }) });
    }
    const analyticsPath = "/api/analytics?start=2024-01-01&end=2024-01-31&domain=" + domain.uuid;
    for (const [cookie, key, total] of [[ownerToken, null, 100], [recipientToken, null, 7], [null, scoped.token, 7], [null, all.token, 7]]) {
      const report = await checked("GET", analyticsPath, undefined, cookie, 200, key ? { "X-API-Key": key } : {});
      assert.equal(report.total, total, "Domain sharing must not aggregate another creator's links or visit rows");
      assert(report.available_filters.domains.some(row => row.id === domain.uuid));
    }
    await checked("GET", analyticsPath, undefined, strangerToken, 404);
    await checked("GET", analyticsPath + "&link=" + shared.id, undefined, ownerToken, 404);
    const workspace = await checked("POST", "/api/workspaces", { name: "Granted workspace" }, recipientToken, 201);
    const wsPath = "/api/workspaces/" + workspace.id;
    const invitation = await checked("POST", wsPath + "/members", { email: stranger.email, role: "editor" }, recipientToken, 201);
    await checked("POST", "/api/workspaces/invitations/" + invitation.id + "/accept", {}, strangerToken);
    const workspaceLink = await checked("POST", wsPath + "/links", { address: "workspace-shared", target, domain: domain.address }, strangerToken, 201);
    assert.equal((await db("links").where({ uuid: workspaceLink.id }).first()).user_id, recipient.id);
    const input = { format: "json", conflict: "abort", content: JSON.stringify({ schema_version: 1, links: [{ address: "import-shared", target, domain: domain.address }] }) };
    const preview = await checked("POST", "/api/transfer/preview", input, recipientToken); assert(preview.valid);
    const ordinary = await checked("POST", "/api/links", { target, customurl: "ordinary-health" }, recipientToken, 201);
    const ordinaryHealth = await checked("PUT", "/api/links/" + ordinary.id + "/health", { revision: 0, enabled: true, interval_hours: 24 }, recipientToken);
    assert(ordinaryHealth.enabled); assert.deepEqual(ordinaryHealth.results, []);
    const health = await checked("PUT", "/api/links/" + shared.id + "/health", { revision: 0, enabled: true, interval_hours: 24 }, recipientToken);
    assert(health.enabled);
    const replay = await create("replay-shared", recipientToken, 201, { "Idempotency-Key": "grants-idempotent-01" });
    const sharingPage = "/settings/domain-sharing/" + domain.uuid;
    const confirmation = sharingPage + "/revoke/" + grant.id;
    const html = { Accept: "text/html", Origin: origin };
    const unchanged = async () => ({
      grant: await db("domain_grants").where({ id: grant.id }).first(),
      token: await db("api_tokens").where({ id: scoped.id }).first(),
      health: await db("link_health").where({ link_id: sharedId }).first()
    });
    const beforeConfirmation = await unchanged();
    for (const locale of ["en", "fr", "es"]) {
      const response = await request("GET", confirmation, undefined, ownerToken, { ...html, "Accept-Language": locale });
      assert.equal(response.status, 200); assert.equal(response.headers["cache-control"], "private, no-store");
      assert.equal(response.headers["referrer-policy"], "same-origin");
      assert(response.text.includes(recipient.email) && response.text.includes(domain.address));
      const catalog = require("../locales/" + locale + ".json");
      const escape = require("handlebars").escapeExpression;
      for (const key of ["confirm_title", "confirm_tokens", "confirm_health", "confirm_redirects"]) {
        assert(response.text.includes(escape(catalog["domain_grants." + key])), locale + "/" + key);
      }
      assert(response.text.includes('name="confirm" value="' + grant.id + '"'));
      assert.equal((await request("GET", sharingPage, undefined, ownerToken, html)).status, 200, "Cancel is a read-only return to the list");
    }
    const oldForm = await request("POST", sharingPage, { operation: "revoke", grant_id: grant.id }, ownerToken, html);
    assert.equal(oldForm.status, 303); assert.equal(oldForm.headers.location, confirmation, "Already-open forms must also require confirmation");
    for (const token of [recipientToken, strangerToken]) {
      const response = await request("GET", confirmation, undefined, token, html);
      assert.equal(response.status, 404); assert(!response.text.includes(recipient.email));
      assert.equal((await request("POST", confirmation, { confirm: grant.id }, token, html)).status, 404);
    }
    assert.equal((await request("GET", confirmation, undefined, null, { ...html, "X-API-Key": grantToken.token })).status, 403);
    assert.equal((await request("GET", confirmation, undefined, ownerToken, html, short)).status, 404);
    for (const body of [{}, { confirm: randomUUID() }]) {
      assert.equal((await request("POST", confirmation, body, ownerToken, html)).status, 400);
    }
    for (const Origin of ["null", "http://" + short, "https://foreign.invalid"]) {
      assert.equal((await request("POST", confirmation, { confirm: grant.id }, ownerToken, { ...html, Origin })).status, 403);
    }
    // Simulate ownership changing after the owner opened the confirmation page.
    await db("domains").where({ id: domain.id }).update({ user_id: stranger.id });
    try {
      assert.equal((await request("POST", confirmation, { confirm: grant.id }, ownerToken, html)).status, 404);
    } finally { await db("domains").where({ id: domain.id }).update({ user_id: owner.id }); }
    assert.deepEqual(await unchanged(), beforeConfirmation, "Reads, cancel, old forms and denied confirmation must not mutate grants, tokens or health");
    const confirmed = await request("POST", confirmation, { confirm: grant.id }, ownerToken, html);
    assert.equal(confirmed.status, 303); assert.equal(confirmed.headers.location, sharingPage);
    for (const method of ["GET", "POST"]) {
      const stale = await request(method, confirmation, method === "POST" ? { confirm: grant.id } : undefined, ownerToken, html);
      assert.equal(stale.status, 404); assert(!stale.text.includes('name="confirm"'));
    }
    assert((await db("api_tokens").where({ id: scoped.id }).first()).revoked_at);
    assert.equal(Number((await db("link_health").where({ link_id: (await db("links").where({ uuid: shared.id }).first()).id }).first()).enabled), 0);
    await create("after-revoke", recipientToken, 400);
    await create("all-after-revoke", null, 400, { "X-API-Key": all.token });
    await create("scoped-after-revoke", null, 401, { "X-API-Key": scoped.token });
    await checked("GET", analyticsPath, undefined, null, 401, { "X-API-Key": scoped.token });
    for (const [cookie, headers] of [[recipientToken, {}], [null, { "X-API-Key": all.token }]]) {
      const retained = await checked("GET", analyticsPath, undefined, cookie, 200, headers);
      assert.equal(retained.total, 7); assert(retained.available_filters.domains.some(row => row.id === domain.uuid));
    }
    await assert.rejects(require("../server/analytics").access({ user: recipient, apiToken: scoped.id, apiTokenDomain: domain.id }), /no longer authorized/);
    await create("replay-shared", recipientToken, 400, { "Idempotency-Key": "grants-idempotent-01" });
    await checked("PATCH", "/api/links/" + shared.id, { description: "denied" }, recipientToken, 403);
    await checked("POST", "/api/transfer/commit", { ...input, preview_token: preview.preview_token }, recipientToken, 409);
    await checked("POST", wsPath + "/links", { address: "workspace-revoked", target, domain: domain.address }, strangerToken, 403);
    await checked("PUT", "/api/links/" + shared.id + "/routing", { revision: 0, rules: [] }, recipientToken, 410);
    for (const method of ["GET", "HEAD"]) {
      const response = await request(method, "/" + shared.address, undefined, undefined, {}, domain.address);
      assert.equal(response.status, 302); assert.equal(response.headers.location, target); assert(!response.headers["set-cookie"]);
    }
    for (const authority of [domain.address, "www." + domain.address]) {
      assert.equal((await request("GET", "/shared-protected", undefined, undefined, { Accept: "text/html" }, authority)).status, 200);
      await checked("POST", "/api/links/" + protectedLink.id + "/protected", { password: "synthetic-protection" }, null, 200, { Origin: "http://" + authority }, authority);
      for (const Origin of ["http://" + (authority === domain.address ? "www." : "") + domain.address, "http://foreign.example.invalid", origin]) {
        await checked("POST", "/api/links/" + protectedLink.id + "/protected", { password: "synthetic-protection" }, null, 403, { Origin }, authority);
      }
    }
    for (const Origin of ["null", origin, "http://foreign.example.invalid"]) {
      await checked("POST", "/api/links/" + protectedLink.id + "/protected", { password: "synthetic-protection" }, null, 403, { Origin }, domain.address);
    }
    for (const wrong of [host, short, "foreign.example.invalid"]) await checked("POST", "/api/links/" + protectedLink.id + "/protected", { password: "synthetic-protection" }, null, 404, {}, wrong);
    assert.equal((await request("GET", "/shared-forward/docs/a.pdf?page=2", undefined, undefined, {}, domain.address)).headers.location, target + "/docs/a.pdf?page=2");
    let nextGrant = await checked("POST", endpoint, { email: recipient.email }, adminToken, 201);
    assert.equal((await request("POST", confirmation, { confirm: grant.id }, ownerToken, html)).status, 404);
    assert(await db("domain_grants").where({ id: nextGrant.id }).first(), "An old confirmation cannot revoke a later grant to the same recipient");
    await create("scoped-regrant-denied", null, 401, { "X-API-Key": scoped.token });
    await create("regranted");
    assert.equal(Number((await db("link_health").where({ link_id: (await db("links").where({ uuid: shared.id }).first()).id }).first()).enabled), 0);
    await checked("DELETE", "/api/links/" + replay.id, undefined, recipientToken);
    await db("links").where({ uuid: replay.id }).update({ archived_domain: domain.address, domain_id: null });
    await db("api_tokens").where({ id: all.id }).update({ revoked_at: Date.now() });
    await assert.rejects(require("../server/link-history").restore(replay.id, recipient.id, recipient, undefined,
      { user: recipient, apiToken: all.id }), error => error.statusCode === 403 || /no longer authorized/.test(error.message));
    assert((await db("links").where({ uuid: replay.id }).first()).deleted_at, "A delayed revoked token cannot restore archived links");
    await checked("POST", "/api/links/" + replay.id + "/restore", {}, recipientToken);
    await checked("DELETE", "/api/links/" + replay.id, undefined, recipientToken);
    await checked("DELETE", endpoint + "/" + nextGrant.id, undefined, ownerToken, 204);
    await checked("POST", "/api/links/" + replay.id + "/restore", {}, recipientToken, 409);
    nextGrant = await access.grant({ user: owner }, domain.uuid, { email: recipient.email });
    const requestData = { user: recipient, body: { fetched_domain: domain }, get: () => undefined };
    const creation = require("../server/link-creation");
    let acquired, release;
    const ready = new Promise(resolve => { acquired = resolve; }), wait = new Promise(resolve => { release = resolve; });
    const writing = creation.run(requestData, async transaction => {
      acquired(); await wait;
      return require("../server/queries/link.queries").create({ address: "racing-write", target, domain_id: domain.id, user_id: recipient.id }, transaction);
    });
    await ready;
    let revoked = false;
    const revoking = access.revoke({ user: owner }, domain.uuid, nextGrant.id).then(() => { revoked = true; });
    await delay(100); assert.equal(revoked, false); release(); await writing; await revoking;
    await assert.rejects(creation.run(requestData, async () => { throw Error("must not execute"); }), /unavailable/);
    if (external) {
      const staleGrant = await access.grant({ user: owner }, domain.uuid, { email: recipient.email });
      await assert.rejects(db.transaction(async transaction => {
        assert(await transaction("domain_grants").where({ id: staleGrant.id }).first());
        await access.revoke({ user: owner }, domain.uuid, staleGrant.id);
        await require("../server/queries/link.queries").create({ address: "stale-snapshot", target, domain_id: domain.id, user_id: recipient.id }, transaction);
      }), /unavailable/);
    }
    for (const transition of ["ban", "release", "owner-ban"]) {
      await access.grant({ user: owner }, domain.uuid, { email: recipient.email });
      if (transition === "ban") {
        await require("../server/moderation").moderate("domain", String(domain.id), true, admin);
        await require("../server/moderation").moderate("domain", String(domain.id), false, admin);
      } else if (transition === "release") {
        await require("../server/queries/domain.queries").release(domain.id, owner.id);
        await require("../server/queries/domain.queries").claim({ address: domain.address, user: owner });
      } else {
        await require("../server/moderation").moderate("user", String(owner.id), true, admin);
        await require("../server/moderation").moderate("user", String(owner.id), false, admin);
        Object.assign(owner, await db("users").where({ id: owner.id }).first());
      }
      assert.equal(await access.find(db, recipient.id, { id: domain.id }), undefined, transition + " must not resurrect grants");
    }
    await stop();
    // Disabled configuration preserves legacy custom-domain API management.
    await start({ MANAGEMENT_ORIGIN: "" });
    assert.equal((await request("GET", "/api/links", undefined, recipientToken, {}, domain.address)).status, 200);
    assert.equal((await request("GET", "/login", undefined, null, { Accept: "text/html" }, short)).status, 200);
    assert.equal((await request("GET", "/" + shared.address, undefined, null, {}, domain.address)).status, 302);
    console.log("PASS: " + env.DB_CLIENT + " split-host spoof/CSRF/cookies/mail, default compatibility, explicit grants/ownership/scopes, workspace/import checks, revoke races/stale snapshots, protected/HEAD/forwarding redirects and ban/reclaim non-resurrection");
  } finally {
    await stop(); if (db) await db.destroy(); rmSync(directory, { recursive: true, force: true });
  }
}
module.exports = async () => {
  const result = require("node:child_process").spawnSync(process.execPath, [__filename], {
    env: { PATH: process.env.PATH }, encoding: "utf8", timeout: 120000
  });
  assert.equal(result.status, 0, result.stderr);
  console.log(result.stdout.trim());
};
if (require.main === module) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
