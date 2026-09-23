const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { readFileSync, writeFileSync, existsSync } = require("node:fs");
const path = require("node:path");

module.exports = function({ root, directory, env }) {
  const load = require("../server/env-files");
  const secretFile = path.join(directory, "fixture-secret");
  writeFileSync(secretFile, "  test-only-secret\n", { mode: 0o600 });
  const values = { JWT_SECRET: "unused-inline", JWT_SECRET_FILE: secretFile };
  load(["JWT_SECRET"], values);
  assert.equal(values.JWT_SECRET, "test-only-secret");
  const absent = path.join(directory, "missing-sensitive-path");
  assert.throws(() => load(["JWT_SECRET"], { JWT_SECRET_FILE: absent }), error =>
    error.message === "Unable to read configured JWT_SECRET_FILE." && !error.message.includes(absent));
  assert.throws(() => load(["JWT_SECRET"], { JWT_SECRET_FILE: "" }));

  const runEnv = extra => spawnSync(process.execPath, ["-e", `require(${JSON.stringify(path.join(root, "server/env.js"))});`],
    { cwd: directory, env: { ...env, ...extra }, encoding: "utf8", timeout: 10000 });
  assert.equal(runEnv({ JWT_SECRET_FILE: secretFile }).status, 0);
  assert.notEqual(runEnv({ JWT_SECRET_FILE: absent }).status, 0);
  for (const TRUST_PROXY of ["false", "true", "1", "0", "hops:2", "peers:127.0.0.1,::1/128"]) {
    assert.equal(runEnv({ TRUST_PROXY }).status, 0, TRUST_PROXY);
  }
  for (const TRUST_PROXY of ["", "2", "hops:1.5", "peers:localhost"]) {
    assert.notEqual(runEnv({ TRUST_PROXY }).status, 0, TRUST_PROXY);
  }
  for (const OIDC_ID_TOKEN_SIGNING_ALG of ["RS256", "PS256", "ES256", "EdDSA"]) {
    assert.equal(runEnv({ OIDC_ID_TOKEN_SIGNING_ALG }).status, 0);
  }
  for (const CSP_MODE of ["off", "report-only", "enforce"]) assert.equal(runEnv({ CSP_MODE }).status, 0);
  for (const CSP_MODE of ["", "true", "ENFORCE", "enforce ", "report-only; script-src *"]) assert.notEqual(runEnv({ CSP_MODE }).status, 0);
  for (const OIDC_ID_TOKEN_SIGNING_ALG of ["", "none", "HS256", "HS384", "HS512", "rs256", "RS256,ES256"]) {
    assert.notEqual(runEnv({ OIDC_ID_TOKEN_SIGNING_ALG }).status, 0);
  }
  writeFileSync(secretFile, "\n");
  assert.notEqual(runEnv({ JWT_SECRET_FILE: secretFile }).status, 0, "An empty secret file must not restore an inline/default production secret");

  const filenameFile = path.join(directory, "database-file");
  writeFileSync(filenameFile, env.DB_FILENAME + "\n");
  const clientFile = path.join(directory, "database-client");
  writeFileSync(clientFile, "better-sqlite3\n");
  const cli = extra => spawnSync(process.execPath, [path.join(root, "scripts/destination-health.cjs")], {
    cwd: directory, env: { PATH: env.PATH, ...extra }, encoding: "utf8", timeout: 10000
  });
  let result = cli({ DB_FILENAME: absent, DB_FILENAME_FILE: filenameFile, DB_CLIENT_FILE: clientFile });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(Object.keys(JSON.parse(result.stdout)).sort(), ["attention", "enabled", "overdue", "worker_age_seconds"]);
  assert(!existsSync(absent));
  for (const extra of [{ DB_FILENAME: absent }, { DB_FILENAME_FILE: absent },
    { DB_FILENAME: env.DB_FILENAME, DB_CLIENT: "pg" }, {}]) {
    result = cli(extra);
    assert.equal(result.status, 1);
    assert.equal(result.stderr.trim(), "Destination monitoring status unavailable");
    assert.equal(result.stdout, "");
    assert(!existsSync(absent));
  }
  const manifest = JSON.parse(readFileSync(path.join(root, "static/manifest.webmanifest")));
  assert.equal(typeof manifest.scope, "string");
  for (const icon of manifest.icons) {
    const data = readFileSync(path.join(root, "static", icon.src));
    assert.equal(data.subarray(1, 4).toString(), "PNG");
    assert.equal(icon.sizes, `${data.readUInt32BE(16)}x${data.readUInt32BE(20)}`);
  }
  console.log("PASS: secret-file precedence/fail-closed startup, read-only aggregate CLI, missing database protection and manifest assets");
};
