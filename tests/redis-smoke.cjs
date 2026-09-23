// Run only in a disposable, unnetworked Redis container's network namespace.
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { existsSync, mkdtempSync, rmSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const Redis = require("ioredis");
const Database = require("better-sqlite3");

async function main() {
  assert.equal(process.env.KUTT_REDIS_TEST, "isolated", "Explicit isolated Redis fixture required");
  const root = path.resolve(__dirname, "..");
  assert(!existsSync(path.join(root, ".env")), "No real configuration allowed");
  const directory = mkdtempSync(path.join(tmpdir(), "kutt-redis-"));
  const useTLS = process.env.KUTT_REDIS_TLS_TEST === "isolated";
  const material = useTLS ? { REDIS_SSL: true, REDIS_SSL_CA: readFileSync("/tmp/tls/ca.crt", "utf8"),
    REDIS_SSL_CERT: readFileSync("/tmp/tls/client.crt", "utf8"), REDIS_SSL_KEY: readFileSync("/tmp/tls/client.key", "utf8") } : { REDIS_SSL: false };
  const client = new Redis({ ...require("../server/redis-options")({ REDIS_HOST: "127.0.0.1", REDIS_PORT: 6379,
    REDIS_DB: 0, REDIS_ENABLED: true, ...material }), maxRetriesPerRequest: 1, retryStrategy: () => null });
  let server, exit, db, output = "";
  const env = { PATH: process.env.PATH, NODE_ENV: "production", PORT: "31991",
    DEFAULT_DOMAIN: "127.0.0.1:31991", DB_CLIENT: "better-sqlite3", DB_FILENAME: path.join(directory, "db.sqlite"),
    JWT_SECRET: randomBytes(48).toString("hex"), REDIS_ENABLED: "true", REDIS_HOST: "127.0.0.1", REDIS_PORT: "6379",
    REDIS_DB: "0", MAIL_ENABLED: "false", OIDC_ENABLED: "false", ENABLE_RATE_LIMIT: "true", TRUST_PROXY: "false",
    DISALLOW_ANONYMOUS_LINKS: "true", DISALLOW_REGISTRATION: "true", DISALLOW_LOGIN_FORM: "false", NODE_APP_INSTANCE: "1" };
  if (useTLS) Object.assign(env, { REDIS_SSL: "true", REDIS_SSL_CA_FILE: "/tmp/tls/ca.crt",
    REDIS_SSL_CERT_FILE: "/tmp/tls/client.crt", REDIS_SSL_KEY_FILE: "/tmp/tls/client.key" });
  const request = (method, pathname, body, token, extra = {}) => fetch("http://127.0.0.1:31991" + pathname, {
    method, redirect: "manual", signal: AbortSignal.timeout(10000),
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Cookie: `token=${token}` } : {}), ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  async function stop() {
    if (!server) return;
    // Bull forks sandbox workers. Terminate this fixture's entire dedicated
    // process group so orphan workers cannot hold test output pipes open.
    try { process.kill(-server.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
    if (!await Promise.race([exit, delay(5000).then(() => null)])) {
      try { process.kill(-server.pid, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; }
      await exit;
    }
    server = null;
  }
  async function start() {
    server = spawn(process.execPath, [path.join(root, "server/server.js")], { cwd: directory, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    exit = new Promise(resolve => { server.once("exit", (code, signal) => resolve({ code, signal })); server.once("error", error => resolve({ error })); });
    server.stdout.on("data", chunk => { output += chunk; }); server.stderr.on("data", chunk => { output += chunk; });
    for (let i = 0; i < 100; i++) {
      try { if ((await request("GET", "/api/health")).status === 200) return; } catch {}
      if (server.exitCode !== null) break;
      await delay(100);
    }
    throw new Error("Redis fixture startup failed: " + output);
  }
  try {
    assert.equal(await client.dbsize(), 0, "Refuse a Redis database with existing data; never flush it");
    const migration = spawnSync(process.execPath, [path.join(root, "node_modules/knex/bin/cli.js"), "--knexfile", path.join(root, "knexfile.js"), "migrate:latest"],
      { cwd: directory, env, encoding: "utf8", timeout: 60000 });
    assert.equal(migration.status, 0, migration.stderr);
    await start();
    const account = { email: "redis-test@example.com", password: randomBytes(32).toString("hex") };
    let response = await request("POST", "/api/auth/create-admin", account);
    assert.equal(response.status, 201);
    const { token } = await response.json();
    response = await request("POST", "/api/links", { target: "https://192.0.2.1/redis", customurl: "redis-visit" }, token);
    assert.equal(response.status, 201); const link = await response.json();
    db = new Database(env.DB_FILENAME, { readonly: true, fileMustExist: true });
    const count = () => db.prepare("SELECT visit_count FROM links WHERE uuid=?").get(link.id).visit_count;
    for (let i = 0; i < 3; i++) assert.equal((await request("GET", "/redis-visit", undefined, undefined, {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
      Referer: "https://referrer.example.org/private?notStored=yes"
    })).status, 302);
    for (let i = 0; i < 150 && count() < 3; i++) await delay(100);
    assert.equal(count(), 3, "Bull sandbox worker must consume real redirect jobs exactly once in this fixture");
    const stats = db.prepare("SELECT referrers,total FROM visits WHERE link_id=(SELECT id FROM links WHERE uuid=?)").all(link.id);
    assert.equal(stats.reduce((sum, row) => sum + row.total, 0), 3);
    assert(stats.every(row => !row.referrers.includes("private") && !row.referrers.includes("notStored")));
    assert.equal(await client.zcard("bull:visit:failed"), 0);

    const aliases = ["/api/auth/login", "/API/AUTH/LOGIN", "/api/v2/auth/login", "/Api/V2/Auth/LoGiN", "/api/auth/LOGIN/"];
    for (const alias of aliases) assert.equal((await request("POST", alias, { ...account, password: "wrong-password" })).status, 401);
    assert.equal((await request("POST", "/api/v2/auth/login", account)).status, 429);
    await stop(); await start();
    assert.equal((await request("POST", "/api/auth/login", account)).status, 429, "Redis login throttle survives app restart");

    response = await request("POST", "/api/links", { target: "https://192.0.2.1/protected", customurl: "redis-protected", password: "protected-secret" }, token);
    assert.equal(response.status, 201); const protectedLink = await response.json();
    for (let i = 0; i < 10; i++) assert.equal((await request("POST", (i % 2 ? "/API/V2" : "/api") + "/links/" + protectedLink.id + "/protected", { password: "wrong-secret" })).status, 401);
    await stop(); await start();
    assert.equal((await request("HEAD", "/redis-protected", undefined, undefined, { Authorization: "Basic " + Buffer.from("u:protected-secret").toString("base64") })).status, 429);
    assert.equal((await request("GET", "/redis-protected")).status, 200);
    response = await request("POST", "/api/auth/apikey", {}, token);
    assert.equal(response.status, 201);
    const { apikey } = await response.json();
    const cached = db.prepare("SELECT * FROM users WHERE email=?").get(account.email);
    await client.set("u:" + apikey, JSON.stringify(cached), "EX", 900);
    assert.equal((await request("POST", "/api/auth/revoke-sessions", {}, token)).status, 204);
    assert.equal((await request("GET", "/api/users", undefined, token)).status, 401);
    const current = db.prepare("SELECT * FROM users WHERE id=?").get(cached.id);
    assert.equal(current.auth_version, cached.auth_version + 1);
    for (const api of ["/api", "/api/v2"]) {
      assert.equal((await request("GET", api + "/users", undefined, undefined, { "X-API-Key": apikey })).status, 200);
      response = await request("POST", api + "/domains", { address: "redis-proof.example.invalid" }, undefined, { "X-API-Key": apikey });
      assert.equal(response.status, 409);
      const challenge = (await response.json()).verification;
      assert.equal(require("jsonwebtoken").decode(challenge.proof).av, current.auth_version, "Domain proof uses the fresh API principal after revocation");
    }
    assert.equal(JSON.parse(await client.get("u:" + apikey)).auth_version, cached.auth_version, "Exercise a genuinely stale cache entry");
    const writer = new Database(env.DB_FILENAME);
    try { writer.prepare("UPDATE users SET apikey=? WHERE id=?").run(randomBytes(24).toString("hex"), cached.id); } finally { writer.close(); }
    assert.equal((await request("GET", "/api/users", undefined, undefined, { "X-API-Key": apikey })).status, 401, "A cached old API key cannot authenticate after rotation");
    assert(!/UnhandledPromiseRejection|unhandled error event|MODULE_NOT_FOUND/.test(output));
    console.log("PASS: real Redis/Bull visit processing, referrer privacy, restart-persistent rate limits and fresh API authentication/domain proof after revocation and rotation");
  } finally {
    await stop(); if (db) db.close(); client.disconnect(); rmSync(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
