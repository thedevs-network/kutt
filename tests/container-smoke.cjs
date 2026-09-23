// Run against an isolated checkout/container, never a deployed database.
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { existsSync, mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { setTimeout: delay } = require("node:timers/promises");

async function main() {
  assert([undefined, "management-domain-grants", "destination-policy", "csp", "qr", "qr-branding", "i18n", "metrics", "theme", "geography", "dotted-aliases", "moderation", "list-sorting", "security-boundaries", "workspaces", "workspace-edit", "routing", "analytics", "privacy", "webhooks", "forwarding", "link-health", "shortcuts", "security-regressions", "admin-user-filter", "admin-edit", "accessibility", "dialogs", "library-ux", "validation", "transfer", "login-copy", "contrast", "copy", "responses", "login-navigation", "unavailable", "header", "campaign", "expiry-edit", "schedule-creation"].includes(process.env.KUTT_TEST_ONLY), "Unknown focused test selection");
  const root = path.resolve(__dirname, "..");
  assert(!existsSync(path.join(root, ".env")), "Run in a clean checkout without a .env file");
  const directory = mkdtempSync(path.join(tmpdir(), "kutt-smoke-"));
  let server;
  let exit;
  let output = "";
  try {
    const listener = net.createServer();
    await new Promise((resolve, reject) => {
      listener.once("error", reject);
      listener.listen(0, "127.0.0.1", resolve);
    });
    const port = listener.address().port;
    await new Promise(resolve => listener.close(resolve));
    // Do not inherit DB, mail, OIDC, or *_FILE settings from the caller.
    const env = {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      PORT: String(port),
      DEFAULT_DOMAIN: `127.0.0.1:${port}`,
      DB_CLIENT: "better-sqlite3",
      DB_FILENAME: path.join(directory, "test.sqlite"),
      JWT_SECRET: randomBytes(48).toString("hex"),
      REDIS_ENABLED: "false",
      MAIL_ENABLED: "false",
      OIDC_ENABLED: "false",
      DISALLOW_ANONYMOUS_LINKS: "true",
      DISALLOW_REGISTRATION: "true",
      DISALLOW_LOGIN_FORM: "false",
      ENABLE_RATE_LIMIT: "false",
      TRUST_PROXY: "false",
      // Offline test DNS failures must not serialize libuv's four resolver workers.
      UV_THREADPOOL_SIZE: "16",
      NODE_APP_INSTANCE: "1"
    };
    // An empty cwd prevents dotenv from loading the checkout's real .env.
    // Knex receives the explicit configuration path to find migrations.
    const migrate = spawnSync(process.execPath, [
      path.join(root, "node_modules/knex/bin/cli.js"),
      "--knexfile", path.join(root, "knexfile.js"), "migrate:latest"
    ], { cwd: directory, env, encoding: "utf8", timeout: 60000 });
    assert.equal(migrate.status, 0, `Migrations failed: ${migrate.stderr}`);
    require("./history-migration.cjs")({ root, directory, env });

    // Exercise native binding cleanup in a separate process too. A module can
    // load and answer queries yet abort while its Node environment tears down.
    const native = spawnSync(process.execPath, ["-e", `
      const Database = require(${JSON.stringify(path.join(root, "node_modules/better-sqlite3"))});
      const db = new Database(process.env.DB_FILENAME);
      if (db.pragma('quick_check', { simple: true }) !== 'ok') process.exit(1);
      db.close();
    `], { cwd: directory, env, encoding: "utf8", timeout: 10000 });
    assert.equal(native.status, 0, `SQLite cleanup failed: ${native.stderr}`);
    require("./configuration.cjs")({ root, directory, env });
    const visitIndex = spawnSync(process.execPath, ["-e", `(async()=>{const db=require(${JSON.stringify(path.join(root, "server/knex"))});try{await require(${JSON.stringify(path.join(root, "tests/visit-hour-index.cjs"))})(db)}finally{await db.destroy()}})().catch(e=>{console.error(e);process.exitCode=1})`], { cwd: directory, env, encoding: "utf8", timeout: 60000 });
    assert.equal(visitIndex.status, 0, visitIndex.stderr);
    console.log(visitIndex.stdout.trim());
    await require("./proxy-trust.cjs")();
    await require("./community-correctness.cjs")({ root, directory, env });
    require("./redis-fixture-cleanup.cjs")({ root });

    server = spawn(process.execPath, [path.join(root, "server/server.js")], {
      cwd: directory, env, stdio: ["ignore", "pipe", "pipe"]
    });
    exit = new Promise(resolve => {
      server.once("exit", (code, signal) => resolve({ code, signal }));
      server.once("error", error => resolve({ error }));
    });
    server.stdout.on("data", data => { output += data; });
    server.stderr.on("data", data => { output += data; });
    const url = `http://127.0.0.1:${port}`;
    async function request(method, pathname, body, token, extraHeaders = {}) {
      // Synchronous worker fixtures block this client's event loop across server
      // idle timeouts. Use fresh connections; never retry a possibly counted redirect.
      const headers = { "Content-Type": "application/json", Accept: "application/json", Connection: "close", ...extraHeaders };
      if (token) headers.Cookie = `token=${token}`;
      try {
        const response = await fetch(url + pathname, {
          method, headers, redirect: "manual", signal: AbortSignal.timeout(10000),
          body: body === undefined ? undefined : JSON.stringify(body)
        });
        // Status-only assertions must still drain ordinary responses: leaving a
        // large body unread can trigger nodejs/undici#5360 on connection close.
        if (response.headers.get("content-type")?.startsWith("text/event-stream")) return response;
        const bytes = await response.arrayBuffer();
        const buffered = new Response(response.body === null ? null : bytes, {
          status: response.status, statusText: response.statusText, headers: response.headers
        });
        Object.defineProperty(buffered, "url", { value: response.url });
        return buffered;
      } catch (error) {
        throw new Error(`${method} ${pathname}: ${error.message}`);
      }
    }
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null || server.signalCode !== null) break;
      try {
        ready = (await request("GET", "/api/v2/health")).status === 200;
      } catch {}
      if (ready) break;
      await delay(100);
    }
    assert(ready, `Server did not start: ${output}`);

    const account = { email: "smoke@example.com", password: randomBytes(32).toString("hex") };
    let response = await request("POST", "/api/v2/auth/create-admin", account);
    assert.equal(response.status, 201, "Admin bootstrap failed");
    const bootstrapToken = (await response.json()).token;
    assert(bootstrapToken);
    assert.equal((await request("GET", "/api/v2/links", undefined, bootstrapToken)).status, 200, "Bootstrap must issue a usable session");
    response = await request("POST", "/api/v2/auth/create-admin", account);
    assert.equal(response.status, 400, "A second administrator bootstrap must fail");
    response = await request("POST", "/api/v2/auth/login", account);
    assert.equal(response.status, 200, "Password login failed");
    const { token } = await response.json();
    assert(token);
    const linkInput = { target: "https://example.com/", customurl: "smoke-check" };
    assert.equal((await request("POST", "/api/v2/links", linkInput)).status, 401);
    assert.equal((await request("GET", "/api/v2/links")).status, 401);
    response = await request("POST", "/api/v2/links", linkInput, token);
    assert.equal(response.status, 201, "Authenticated link creation failed");
    const link = await response.json();
    response = await request("GET", "/smoke-check");
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), linkInput.target);
    assert.equal((await request("GET", "/api/v2/links", undefined, token)).status, 200);
    response = await request("DELETE", `/api/v2/links/${link.id}`, undefined, token);
    assert([200, 204].includes(response.status), "Link deletion failed");
    response = await request("GET", "/smoke-check");
    assert.equal(response.status, 410);
    await require("./api-tokens.cjs")({ request, session: token, database: env.DB_FILENAME, account });
    const restart = async () => {
      server.kill("SIGTERM");
      if (!await Promise.race([exit, delay(5000).then(() => null)])) {
        server.kill("SIGKILL");
        await exit;
      }
      server = spawn(process.execPath, [path.join(root, "server/server.js")], {
        cwd: directory, env, stdio: ["ignore", "pipe", "pipe"]
      });
      exit = new Promise(resolve => {
        server.once("exit", (code, signal) => resolve({ code, signal }));
        server.once("error", error => resolve({ error }));
      });
      server.stdout.on("data", data => { output += data; });
      server.stderr.on("data", data => { output += data; });
      for (let attempt = 0; attempt < 100; attempt++) {
        try { if ((await request("GET", "/api/v2/health")).status === 200) return; } catch {}
        await delay(100);
      }
      throw new Error(`Restart failed: ${output}`);
    };
    if (process.env.KUTT_TEST_ONLY) {
      await require("./" + process.env.KUTT_TEST_ONLY + ".cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env, url });
      return;
    }
    await require("./community-hostnames.cjs")({ request, session: token, database: env.DB_FILENAME, account, env });
    await require("./token-domains-idempotency.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart });
    await require("./link-lifecycle.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, idempotencySecret: env.JWT_SECRET });
    await require("./schedule-creation.cjs")({ request, session: token, database: env.DB_FILENAME, account, root, url });
    await require("./i18n.cjs")({ request, session: token, url });
    await require("./csp.cjs")({ root, request, session: token, restart, env });
    await require("./expiry-edit.cjs")({ request, session: token, database: env.DB_FILENAME, restart });
    await require("./link-history.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart });
    await require("./library.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./list-sorting.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart });
    await require("./moderation.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart });
    await require("./library-ux.cjs")({ request, session: token, database: env.DB_FILENAME, env });
    await require("./transfer.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./qr.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, env });
    await require("./qr-branding.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./admin-user-filter.cjs")({ request, session: token, database: env.DB_FILENAME, account, env });
    await require("./admin-edit.cjs")({ request, session: token, database: env.DB_FILENAME, account, env, restart });
    await require("./accessibility.cjs")({ request, session: token, database: env.DB_FILENAME });
    await require("./dialogs.cjs")({ request, session: token });
    await require("./validation.cjs")({ request, session: token, account });
    await require("./login-copy.cjs")({ request, session: token, root, directory, env });
    await require("./contrast.cjs")({ root });
    await require("./theme.cjs")({ root, request, session: token });
    await require("./metrics.cjs")({ env, restart, request, session: token, directory });
    await require("./copy.cjs")({ root });
    await require("./responses.cjs")({ root, request, session: token });
    await require("./login-navigation.cjs")({ root, request, account });
    await require("./unavailable.cjs")({ request, session: token, database: env.DB_FILENAME });
    await require("./header.cjs")({ root, request, session: token });
    await require("./campaign.cjs")({ request, session: token, database: env.DB_FILENAME, account, env, restart });
    await require("./workspaces.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./workspace-edit.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart });
    await require("./routing.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./analytics.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./geography.cjs")({ request, session: token, database: env.DB_FILENAME, account, root });
    await require("./privacy.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./webhooks.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./forwarding.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./dotted-aliases.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./destination-policy.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./link-health.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./shortcuts.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./security-regressions.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    await require("./security-boundaries.cjs")({ request, session: token, database: env.DB_FILENAME, account, restart, root, directory, env });
    const refusedDown = spawnSync(process.execPath, [
      path.join(root, "node_modules/knex/bin/cli.js"),
      "--knexfile", path.join(root, "knexfile.js"), "migrate:down", "20260914001000_link_history_trash.js"
    ], { cwd: directory, env, encoding: "utf8", timeout: 60000 });
    assert.notEqual(refusedDown.status, 0, "Schema rollback must refuse to discard trash/history");
    // Empty schema rollback is a separate disposable database; never erase
    // policies or audit records from the populated regression database to pass.
    for (const action of ["migrate:latest", "migrate:down", "migrate:latest"]) {
      const migration = spawnSync(process.execPath, [
        path.join(root, "node_modules/knex/bin/cli.js"),
        "--knexfile", path.join(root, "knexfile.js"), action
      ], { cwd: directory, env: { ...env, DB_FILENAME: path.join(directory, "empty-rollback.sqlite") }, encoding: "utf8", timeout: 60000 });
      assert.equal(migration.status, 0, `Token schema rollback/reapply failed: ${migration.stderr}`);
    }
    assert.equal((await request("GET", "/api/v2/links", undefined, token)).status, 200);
    assert.equal((await request("GET", "/api/v2/tokens", undefined, token)).status, 200);
    await require("./oidc-security.cjs")({ root, directory, env });
    await require("./oidc-roles.cjs")({ root, directory, env });
    for (const args of [[], ["--mapping-off"]]) {
      const writes = spawnSync(process.execPath, [path.join(root, "tests/oidc-role-writes.cjs"), ...args],
        { cwd: directory, env, encoding: "utf8", timeout: 60000 });
      assert.equal(writes.status, 0, writes.stdout + writes.stderr);
      console.log(writes.stdout.trim());
    }
    await require("./management-domain-grants.cjs")();
    await require("./oidc-security.cjs")({ root, directory, env, management: true });
    console.log("PASS: additive migration rollback and reapply preserve existing accounts and links");
    console.log("PASS: migrations, SQLite cleanup, bootstrap, login, access control, link CRUD and public redirect");
  } finally {
    if (server) {
      server.kill("SIGTERM");
      const result = await Promise.race([exit, delay(5000).then(() => null)]);
      if (!result) {
        server.kill("SIGKILL");
        await exit;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error.stack);
  process.exitCode = 1;
});
