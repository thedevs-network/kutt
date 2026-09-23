const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { mkdtempSync, rmSync, existsSync } = require("node:fs");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { randomBytes } = require("node:crypto");

const [engine, variant] = process.argv.slice(2);
assert.equal(process.env.KUTT_TLS_TEST, "isolated");
assert(["mysql2", "pg", "redis"].includes(engine));
assert(["server", "wrong", "expired", "plain"].includes(variant));
const root = path.resolve(__dirname, "..");
assert(!existsSync(path.join(root, ".env")));
const directory = mkdtempSync(path.join(tmpdir(), "kutt-tls-"));
const tlsDir = "/tmp/tls";
const prefix = engine === "redis" ? "REDIS" : "DB";
const env = { PATH: process.env.PATH, NODE_ENV: "production", JWT_SECRET: randomBytes(48).toString("hex"),
  DEFAULT_DOMAIN: "localhost", NODE_APP_INSTANCE: "1", MAIL_ENABLED: "false", OIDC_ENABLED: "false",
  DB_CLIENT: engine === "redis" ? "better-sqlite3" : engine, DB_FILENAME: path.join(directory, "db.sqlite"),
  DB_HOST: "localhost", DB_PORT: engine === "mysql2" ? "3306" : "5432", DB_NAME: "kutt_tls_regression",
  DB_USER: "kutt", DB_PASSWORD: "disposable-tls-only", REDIS_ENABLED: engine === "redis" ? "true" : "false",
  REDIS_HOST: "localhost", REDIS_PORT: "6379", REDIS_DB: "0",
  [prefix + "_SSL"]: "true", [prefix + "_SSL_CA_FILE"]: tlsDir + "/ca.crt",
  [prefix + "_SSL_CERT_FILE"]: tlsDir + "/client.crt", [prefix + "_SSL_KEY_FILE"]: tlsDir + "/client.key"
};
const modulePath = name => JSON.stringify(path.join(root, "server", name));
const connect = engine === "redis" ? `
  const Redis = require(${JSON.stringify(path.join(root, "node_modules/ioredis"))});
  const client = new Redis({ ...require(${modulePath("redis-options")})(env), lazyConnect:true, connectTimeout:3000, maxRetriesPerRequest:1, retryStrategy:()=>null });
  let transportError;
  client.on("error",error=>{ transportError ||= error; });
  try { await client.connect(); if (await client.ping() !== "PONG") throw new Error("BAD_PING"); console.log(JSON.stringify({ok:true,tls:!!client.connector.stream.encrypted})); }
  catch(error) { throw transportError || error; }
  finally { client.disconnect(); }
` : `
  const config = require(${modulePath("database-config")})(env);
  config.connection.${engine === "pg" ? "connectionTimeoutMillis" : "connectTimeout"}=3000;
  const db = require(${JSON.stringify(path.join(root, "node_modules/knex"))})(config);
  try { const data=await db.raw(${JSON.stringify(engine === "pg" ? "SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()" : "SHOW SESSION STATUS LIKE 'Ssl_cipher'")});
    const encrypted=${engine === "pg" ? "data.rows[0].ssl" : "!!data[0][0].Value"};
    console.log(JSON.stringify({ok:true,tls:encrypted}));
  } finally { await db.destroy(); }
`;
function run(extra = {}) {
  const values = { ...env, ...extra };
  for (const key of Object.keys(values)) if (values[key] === null) delete values[key];
  const result = spawnSync(process.execPath, ["-e", `(async()=>{const env=require(${modulePath("env")}); ${connect}})().catch(error=>{console.log(JSON.stringify({ok:false,code:error.code||"UNKNOWN",message:error.message}));process.exitCode=1;});`],
    { cwd: directory, env: values, encoding: "utf8", timeout: 10000 });
  assert.equal(result.signal, null, "TLS checks must fail promptly, not wait for a timeout");
  const line = result.stdout.trim().split("\n").at(-1);
  assert(line, "Connection probe must produce a result: " + result.stderr);
  return { ...JSON.parse(line), status: result.status };
}
function denied(result, pattern) {
  assert.equal(result.status, 1, "Invalid TLS must not connect");
  assert.equal(result.ok, false);
  assert.match(result.code + " " + result.message, pattern, "Failure must be the intended TLS boundary, not unrelated startup failure");
}
try {
  if (variant !== "server") {
    if (variant === "plain") {
      assert.deepEqual(run({ [prefix + "_SSL"]: "false", [prefix + "_SSL_CA_FILE"]: null,
        [prefix + "_SSL_CERT_FILE"]: null, [prefix + "_SSL_KEY_FILE"]: null }),
        { ok: true, tls: false, status: 0 }, "The plaintext fixture must be reachable before testing TLS-only denial");
    }
    const reasons = { wrong: /ALTNAME|Hostname\/IP does not match|not in the cert/i,
      expired: /CERT_HAS_EXPIRED|certificate has expired/i,
      plain: /does not support SSL|HANDSHAKE|wrong version number|ECONNRESET|socket.*closed|Connection is closed|ETIMEDOUT/i };
    denied(run(), reasons[variant]);
    console.log(`PASS: ${engine} rejects ${variant} TLS peer without plaintext fallback`);
  } else {
    require("./transport-configuration.cjs")({ root, directory, env });
    assert.deepEqual(run(), { ok: true, tls: true, status: 0 });
    denied(run({ [prefix + "_SSL_CA_FILE"]: tlsDir + "/unknown-ca.crt" }), /CERT|certificate|issuer|self.signed/i);
    denied(run({ [prefix + "_SSL_CERT_FILE"]: null, [prefix + "_SSL_KEY_FILE"]: null }), /CERT|certificate|ACCESS_DENIED|Connection is closed|ECONNRESET/i);
    if (engine === "redis") {
      assert.deepEqual(run({ REDIS_HOST: "127.0.0.1" }), { ok: true, tls: true, status: 0 }, "Redis verifies IP SAN without IP SNI");
      const smoke = spawnSync(process.execPath, [path.join(root, "tests/redis-smoke.cjs")], {
        cwd: directory, env: { PATH: env.PATH, KUTT_REDIS_TEST: "isolated", KUTT_REDIS_TLS_TEST: "isolated" }, encoding: "utf8", timeout: 120000
      });
      assert.equal(smoke.status, 0, smoke.stdout + smoke.stderr);
      process.stdout.write(smoke.stdout);
    } else {
      const migration = spawnSync(process.execPath, [path.join(root, "node_modules/knex/bin/cli.js"), "--knexfile", path.join(root, "knexfile.js"), "migrate:latest"], {
        cwd: directory, env, encoding: "utf8", timeout: 60000
      });
      assert.equal(migration.status, 0, migration.stderr);
      assert.deepEqual(run(), { ok: true, tls: true, status: 0 }, "Runtime and migrations use the same TLS policy");
    }
    console.log(`PASS: ${engine} verified TLS, required client certificates, CA denial and actual ${engine === "redis" ? "cache/queue/limiter" : "migrations/runtime"}`);
  }
} finally { rmSync(directory, { recursive: true, force: true }); }
