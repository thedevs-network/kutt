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
      NODE_APP_INSTANCE: "1"
    };
    // An empty cwd prevents dotenv from loading the checkout's real .env.
    // Knex receives the explicit configuration path to find migrations.
    const migrate = spawnSync(process.execPath, [
      path.join(root, "node_modules/knex/bin/cli.js"),
      "--knexfile", path.join(root, "knexfile.js"), "migrate:latest"
    ], { cwd: directory, env, encoding: "utf8", timeout: 60000 });
    assert.equal(migrate.status, 0, `Migrations failed: ${migrate.stderr}`);

    // Exercise native binding cleanup in a separate process too. A module can
    // load and answer queries yet abort while its Node environment tears down.
    const native = spawnSync(process.execPath, ["-e", `
      const Database = require(${JSON.stringify(path.join(root, "node_modules/better-sqlite3"))});
      const db = new Database(process.env.DB_FILENAME);
      if (db.pragma('quick_check', { simple: true }) !== 'ok') process.exit(1);
      db.close();
    `], { cwd: directory, env, encoding: "utf8", timeout: 10000 });
    assert.equal(native.status, 0, `SQLite cleanup failed: ${native.stderr}`);

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
    async function request(method, pathname, body, token) {
      const headers = { "Content-Type": "application/json", Accept: "application/json" };
      if (token) headers.Cookie = `token=${token}`;
      try {
        return await fetch(url + pathname, {
          method, headers, redirect: "manual", signal: AbortSignal.timeout(10000),
          body: body === undefined ? undefined : JSON.stringify(body)
        });
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
    assert((await response.json()).token);
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
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/404");
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
  console.error(error.message);
  process.exitCode = 1;
});
