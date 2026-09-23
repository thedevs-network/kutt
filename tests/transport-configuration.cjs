const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync } = require("node:fs");
const path = require("node:path");

module.exports = ({ root, directory, env }) => {
  const cert = readFileSync("/tmp/tls/client.crt", "utf8");
  const key = readFileSync("/tmp/tls/client.key", "utf8");
  const ca = readFileSync("/tmp/tls/ca.crt", "utf8");
  const otherCA = readFileSync("/tmp/tls/unknown-ca.crt", "utf8");
  const wrongKey = readFileSync("/tmp/tls/server.key", "utf8");
  const tls = require("../server/transport-tls");
  const base = { DB_CLIENT: "pg", DB_HOST: "localhost", DB_SSL: true, DB_SSL_CA: ca,
    DB_SSL_CERT: cert, DB_SSL_KEY: key, DB_PORT: 5432, DB_NAME: "disposable", DB_USER: "kutt",
    DB_POOL_MIN: 0, DB_POOL_MAX: 4, REDIS_ENABLED: false, REDIS_SSL: false };
  const pg = tls.options(base, "DB");
  assert.equal(pg.rejectUnauthorized, true); assert.equal(pg.minVersion, "TLSv1.2");
  assert.equal(pg.servername, "localhost"); assert.equal(pg.ca, ca);
  assert.equal(tls.options({ ...base, DB_CLIENT: "mysql2" }, "DB").verifyIdentity, true);
  assert.equal(tls.options({ ...base, DB_SSL_CA: undefined }, "DB").ca, undefined, "No custom CA retains the platform trust store");
  assert.equal(tls.options({ ...base, DB_SSL_CA: ca + otherCA }, "DB").ca, ca + otherCA);
  for (const extra of [{ DB_SSL: false }, { DB_HOST: "127.0.0.1" }, { DB_HOST: "::1" }, { DB_HOST: "/tmp/socket" },
    { DB_HOST: "host:5432" }, { DB_CLIENT: "mysql" }, { DB_CLIENT: "pg-native" }, { DB_CLIENT: "better-sqlite3" },
    { DB_SSL_CA: "PRIVATE-MARKER-invalid" }, { DB_SSL_CA: ca + "PRIVATE-MARKER-tail" },
    { DB_SSL_CERT: "PRIVATE-MARKER-invalid" }, { DB_SSL_KEY: "PRIVATE-MARKER-invalid" },
    { DB_SSL_CERT: "" }, { DB_SSL_KEY: "" }, { DB_SSL_KEY: wrongKey }]) {
    assert.throws(() => tls.options({ ...base, ...extra }, "DB"), error => !error.message.includes("PRIVATE-MARKER") && !error.message.includes("-----BEGIN"));
  }
  const sqlConfig = require("../server/database-config");
  assert.deepEqual(sqlConfig(base).pool, { min: 0, max: 4 });
  assert.deepEqual(sqlConfig({ ...base, DB_SSL: false, DB_CLIENT: "better-sqlite3" }).pool, { min: 1, max: 1 });
  const redis = { REDIS_ENABLED: true, REDIS_SSL: true, REDIS_HOST: "localhost", REDIS_PORT: 6379,
    REDIS_DB: 2, REDIS_SSL_CA: ca, REDIS_SSL_CERT: cert, REDIS_SSL_KEY: key, REDIS_PASSWORD: "disposable" };
  const redisOptions = require("../server/redis-options");
  const first = redisOptions(redis), second = redisOptions(redis);
  assert.notEqual(first, second); assert.notEqual(first.tls, second.tls, "Bull and cache get fresh options, not shared mutable sockets/config");
  assert.equal(first.tls.rejectUnauthorized, true); assert.equal(first.password, "disposable"); assert.equal(first.db, 2);
  assert.equal(redisOptions({ ...redis, REDIS_HOST: "127.0.0.1" }).tls.servername, undefined);
  assert.equal(redisOptions({ ...redis, REDIS_HOST: "::1" }).tls.servername, undefined);
  assert.throws(() => redisOptions({ ...redis, REDIS_ENABLED: false }));
  assert.throws(() => redisOptions({ ...redis, REDIS_SSL: false }));

  const blank = path.join(directory, "empty-tls"), malformed = path.join(directory, "bad-tls");
  writeFileSync(blank, "\n"); writeFileSync(malformed, "PRIVATE-MARKER-invalid");
  const clean = { PATH: env.PATH, NODE_ENV: "production", JWT_SECRET: env.JWT_SECRET, DB_CLIENT: "pg", DB_SSL: "true", DB_HOST: "localhost" };
  const load = extra => spawnSync(process.execPath, ["-e", `const e=require(${JSON.stringify(path.join(root, "server/env"))});const a=require(${JSON.stringify(path.join(root, "knexfile"))});const b=require(${JSON.stringify(path.join(root, "server/database-config"))})(e);require("node:assert/strict").deepEqual(a.connection,b.connection);`], {
    cwd: directory, env: { ...clean, ...extra }, encoding: "utf8", timeout: 10000
  });
  assert.equal(load({}).status, 0);
  assert.equal(load({ DB_SSL_CA: "ignored-inline-invalid", DB_SSL_CA_FILE: "/tmp/tls/ca.crt" }).status, 0);
  for (const extra of [{ DB_SSL_CA: "" }, { DB_SSL_CA_FILE: blank }, { DB_SSL_CA_FILE: malformed },
    { DB_SSL_CA_FILE: path.join(directory, "PRIVATE-MARKER-missing") }, { DB_SSL_CERT_FILE: "/tmp/tls/client.crt" },
    { DB_SSL_CERT_FILE: "/tmp/tls/client.crt", DB_SSL_KEY_FILE: "/tmp/tls/server.key" }]) {
    const result = load(extra);
    assert.notEqual(result.status, 0);
    assert(!result.stderr.includes("PRIVATE-MARKER") && !result.stderr.includes("-----BEGIN"), "Startup errors must not disclose paths or material");
  }
  console.log("PASS: shared transport configuration, verified identities, client pairs, CA bundles, file precedence, sanitized failures and SQLite pool compatibility");
};
