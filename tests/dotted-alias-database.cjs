const assert = require("node:assert/strict");
const { randomBytes, randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const { existsSync, mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const { setTimeout: delay } = require("node:timers/promises");

assert.equal(process.env.KUTT_DATABASE_DISPOSABLE, "1");
assert.equal(process.env.DB_HOST, "127.0.0.1");
assert(/^kutt_dotted_/.test(process.env.DB_NAME));
assert(["mysql2", "pg"].includes(process.env.DB_CLIENT));
assert(!existsSync(path.join(__dirname, "../.env")));

(async () => {
  const root = path.resolve(__dirname, ".."), directory = mkdtempSync(path.join(tmpdir(), "kutt-dotted-db-"));
  let db, server, exited;
  try {
    const listener = net.createServer();
    await new Promise((resolve, reject) => { listener.once("error", reject); listener.listen(0, "127.0.0.1", resolve); });
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    Object.assign(process.env, { DEFAULT_DOMAIN: "127.0.0.1:" + port, PORT: String(port), JWT_SECRET: randomBytes(48).toString("hex"),
      REDIS_ENABLED: "false", MAIL_ENABLED: "false", OIDC_ENABLED: "false", NODE_APP_INSTANCE: "1", ENABLE_RATE_LIMIT: "false",
      DISALLOW_ANONYMOUS_LINKS: "true", DISALLOW_REGISTRATION: "true", DISALLOW_LOGIN_FORM: "false", TRUST_PROXY: "false" });
    db = require("../server/knex");
    assert.equal(await db.schema.hasTable("users"), false, "Refuse an initialized database");
    await db.migrate.latest({ directory: path.join(root, "server/migrations") });
    server = spawn(process.execPath, [path.join(root, "server/server.js")], { cwd: directory, env: process.env, stdio: "ignore" });
    exited = new Promise(resolve => { server.once("exit", resolve); server.once("error", resolve); });
    const origin = "http://127.0.0.1:" + port, headers = { Accept: "application/json", "Content-Type": "application/json" };
    let token;
    const request = (method, endpoint, body, extra = {}) => fetch(origin + endpoint, { method,
      headers: { ...headers, ...(token ? { Cookie: "token=" + token } : {}), ...extra },
      body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(10000) });
    const checked = async (method, endpoint, body, status = 200, extra) => {
      const response = await request(method, endpoint, body, extra);
      assert.equal(response.status, status, method + " " + endpoint + ": " + await response.clone().text());
      return response.json();
    };
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await request("GET", "/api/health")).status === 200; } catch {}
      if (ready) break;
      await delay(100);
    }
    assert(ready, "Disposable server did not start");
    token = (await checked("POST", "/api/auth/create-admin", { email: "dotted-db@example.invalid", password: randomBytes(32).toString("hex") }, 201)).token;
    const user = await db("users").where({ email: "dotted-db@example.invalid" }).first();
    const target = "https://192.0.2.1/dotted", alias = "database/guide.v1.pdf";
    const create = (address, extra = {}) => checked("POST", "/api/links", { customurl: address, target, ...extra }, 201);
    const link = await create(alias);
    assert.equal((await request("GET", "/" + alias)).headers.get("location"), target);
    assert.equal((await request("HEAD", "/" + alias)).status, 302);
    assert.equal((await checked("GET", "/" + alias + "+")).target, target);
    for (const [endpoint, address] of [["/api/v2/links/", "database/guide.v2.pdf"], ["/api/links/admin/", "database/guide.admin.pdf"]]) {
      const before = await db("links").where({ uuid: link.id }).first();
      await checked("PATCH", endpoint + link.id, { address });
      assert.equal((await request("GET", "/" + before.address)).status, 410);
    }
    const invalid = [".hidden", "file.", "a..b", "a/../b", "a/./b", "a//b", "a%2eb", "a%2fb", "a%252eb", "a\\b", "a.pdf\n",
      "a".repeat(61) + ".pdf", Array(9).fill("a.b").join("/"), "API/file.pdf", "robots.txt", "manifest.webmanifest"];
    for (const address of invalid) {
      await checked("POST", "/api/v2/links", { customurl: address, target }, 400);
      await checked("PATCH", "/api/links/admin/" + link.id, { address }, 400);
    }
    assert.equal((await db("links").where({ uuid: link.id }).first()).address, "database/guide.admin.pdf");
    await create("a".repeat(60) + ".pdf"); await create(Array(8).fill("a.b").join("/"));
    // Compare with ordinary aliases rather than assuming a database collation.
    const statuses = [];
    for (const [upper, lower] of [["CaseControl", "casecontrol"], ["CaseControl.PDF", "casecontrol.pdf"]]) {
      await create(upper);
      const response = await request("POST", "/api/links", { customurl: lower, target });
      assert([201, 400].includes(response.status)); statuses.push(response.status);
    }
    assert.equal(statuses[0], statuses[1], "Dots must not change case-collision semantics");
    const domain = "dotted.example.invalid";
    await db("domains").insert({ address: domain, uuid: randomUUID(), user_id: user.id });
    await create("database/guide.admin.pdf", { domain, target: target + "/custom" });
    const customRedirect = await new Promise((resolve, reject) => {
      const req = http.get({ hostname: "127.0.0.1", port, path: "/database/guide.admin.pdf", headers: { Host: domain } }, response => {
        response.resume(); resolve(response);
      });
      req.setTimeout(10000, () => req.destroy(Error("Custom-domain fixture timed out")));
      req.on("error", reject);
    });
    assert.equal(customRedirect.statusCode, 302);
    assert.equal(customRedirect.headers.location, target + "/custom");
    const scoped = await checked("POST", "/api/tokens", { name: "Dotted gate", scopes: ["links:create"], domain_scope: "default" }, 201);
    await checked("POST", "/api/links", { customurl: "database/token.pdf", target }, 201, { "X-API-Key": scoped.token });
    await checked("POST", "/api/links", { customurl: "database/denied.pdf", target, domain }, 403, { "X-API-Key": scoped.token });
    const workspace = await checked("POST", "/api/workspaces", { name: "Dotted database" }, 201), base = "/api/workspaces/" + workspace.id;
    const shared = await checked("POST", base + "/links", { address: "database/shared.v1.pdf", target }, 201);
    await checked("PATCH", base + "/links/" + shared.id, { address: "database/shared.v2.pdf" });
    assert.equal((await db("links").where({ uuid: shared.id }).first()).address, "database/shared.v2.pdf");
    for (const format of ["json", "csv"]) {
      const address = "database/import." + format;
      const content = format === "json" ? JSON.stringify({ schema_version: 1, links: [{ address, target }] }) : "address,target\n" + address + "," + target + "\n";
      for (const conflict of ["abort", "rename"]) {
        const input = { format, content, conflict }, preview = await checked("POST", "/api/transfer/preview", input);
        assert(preview.valid, JSON.stringify(preview));
        const committed = await checked("POST", "/api/transfer/commit", { ...input, preview_token: preview.preview_token }, 201);
        const created = committed.created[0]; assert(require("../server/link-alias").valid(created.address));
        assert.equal((await request("GET", "/" + created.address)).headers.get("location"), target);
      }
    }
    const history = require("../server/link-history"), queries = require("../server/queries/link.queries");
    const { CustomError } = require("../server/utils");
    const assertClaimWinner = async (address, uuid) => {
      const links = await db("links").where({ address, domain_id: null });
      assert.equal(links.length, 1, address + ": losing link must roll back");
      assert.equal(links[0].uuid, uuid, address + ": winning link must remain unchanged");
      const claim = await db("link_alias_claims").where({ key: history.key(process.env.DEFAULT_DOMAIN, address) }).first();
      assert.equal(claim?.link_uuid, uuid, address + ": claim must belong to the winner");
      assert.equal(claim.retired_at, null, address + ": winning claim must remain active");
      const events = await db("link_history").where({ link_id: links[0].id });
      assert.deepEqual(events.map(row => row.action), ["created"], address + ": losing claim must not alter winner history");
      // Reasserting an existing owner's active claim is still valid (restore/retry).
      await db.transaction(transaction => history.claim(transaction, links[0]));
    };
    const races = [];
    for (const address of ["database/race-control", "database/race.pdf"]) {
      const race = await Promise.all([1, 2].map(() => request("POST", "/api/links", { customurl: address, target })));
      const winners = race.filter(response => response.status === 201);
      assert.equal(winners.length, 1, address + ": exactly one HTTP create must win");
      await assertClaimWinner(address, (await winners[0].json()).id);
      races.push({ address, statuses: race.map(response => response.status) });
    }
    await assert.rejects(db.transaction(async transaction => {
      await queries.create({ address: "database/rollback.pdf", target, user_id: user.id }, transaction);
      throw Error("rollback-fixture");
    }), /rollback-fixture/);
    assert.equal(await history.reserved("database/rollback.pdf", null), false);
    const snapshots = [];
    for (const address of ["database/snapshot-control", "database/snapshot.pdf"]) {
      let refusal, winner;
      try {
        await db.transaction(async transaction => {
          // Establish the MySQL repeatable-read snapshot before the winner commits.
          assert.equal(await transaction("link_alias_claims").where({ key: history.key(process.env.DEFAULT_DOMAIN, address) }).first(), undefined);
          winner = await db.transaction(transaction => queries.create({ address, target, user_id: user.id }, transaction));
          await queries.create({ address, target, user_id: user.id }, transaction);
        });
      } catch (error) { refusal = error; }
      assert(winner, address + ": independent winner must commit");
      await assertClaimWinner(address, winner.uuid);
      snapshots.push({ address, status: refusal?.statusCode ?? null, error: refusal?.name ?? "accepted", customError: refusal instanceof CustomError });
    }
    const parent = await create("database/manual.v1"), child = await create("database/manual.v1/guide.pdf", { target: target + "/child" });
    await checked("PUT", "/api/links/" + parent.id + "/forwarding", { revision: 0, path_prefixes: ["guide.pdf", "files"], query_keys: [] });
    assert.equal((await request("GET", "/" + child.address)).headers.get("location"), child.target);
    for (const suffix of [".hidden", "a..b", "file.", "~file"]) assert.equal((await request("GET", "/" + parent.address + "/files/" + suffix)).headers.get("location"), target + "/files/" + suffix);
    await checked("DELETE", "/api/links/" + child.id);
    assert.equal((await request("GET", "/" + child.address)).status, 410);
    await checked("POST", "/api/links/" + child.id + "/restore", {});
    assert.equal((await request("GET", "/" + child.address)).headers.get("location"), child.target);
    const diagnostics = JSON.stringify({ races, snapshots });
    for (const race of races) assert(race.statuses.every(status => [201, 400, 409].includes(status)),
      race.address + ": HTTP loser must return a conflict, never 500: " + diagnostics);
    for (const snapshot of snapshots) {
      assert.equal(snapshot.status, 409, snapshot.address + ": stale-snapshot loser must return 409: " + diagnostics);
      assert.equal(snapshot.customError, true, snapshot.address + ": conflict must use the public CustomError contract: " + diagnostics);
    }
    console.log("PASS: " + process.env.DB_CLIENT + " ordinary+dotted HTTP races and forced stale snapshots return conflicts, preserve winner/claim/history, roll back losers and allow owner retries");
    console.log("PASS: " + process.env.DB_CLIENT + " dotted HTTP create/edit/admin/workspace/import, bounds, case parity, domains/scopes, claim rollback, lifecycle and forwarding");
  } finally {
    if (server) {
      server.kill("SIGTERM");
      await Promise.race([exited, delay(5000)]);
      if (server.exitCode === null && server.signalCode === null) { server.kill("SIGKILL"); await exited; }
    }
    if (db) await db.destroy();
    rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
