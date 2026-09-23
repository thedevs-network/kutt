// Explicit image-only check; do not run against the developer's host filesystem.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { gzipSync, gunzipSync } = require("node:zlib");
const { rootCertificates } = require("node:tls");
const { spawnSync } = require("node:child_process");

assert(fs.existsSync("/etc/alpine-release"), "Run this check inside the Alpine production image");
const installed = fs.readFileSync("/lib/apk/db/installed", "utf8");
for (const name of ["apk-tools", "libapk", "zlib"]) {
  assert(!installed.split("\n").includes(`P:${name}`), `${name} must not be installed`);
}
for (const directory of ["/lib", "/usr/lib", "/sbin", "/usr/sbin", "/bin", "/usr/bin"]) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    const name = entry.name;
    assert(!/^(?:apk|libapk\.so(?:\..*)?|libz\.so(?:\..*)?)$/.test(name), `Unexpected runtime file: ${path.join(directory, name)}`);
  }
}
assert(fs.statSync("/etc/ssl/certs/ca-certificates.crt").size > 0, "System CA bundle is required");
fs.accessSync("/usr/bin/ssl_client", fs.constants.X_OK);
const tlsClient = spawnSync("ldd", ["/usr/bin/ssl_client"], { encoding: "utf8" });
assert.equal(tlsClient.status, 0, `TLS helper dependencies are missing: ${tlsClient.stderr}`);
assert(rootCertificates.length > 0, "Node must retain its trusted CA roots");
const original = Buffer.from("Kutt runtime compression regression check");
assert.deepEqual(gunzipSync(gzipSync(original)), original);
const Database = require("better-sqlite3");
const database = new Database(":memory:");
assert.equal(database.pragma("quick_check", { simple: true }), "ok");
database.close();
console.log("PASS: image package removal, retained TLS dependencies, compression and SQLite");
