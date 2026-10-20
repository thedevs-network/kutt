const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { test } = require("node:test");

function run(script, value) {
  const env = {
    ...process.env,
    JWT_SECRET: "test-secret",
    DB_CLIENT: "better-sqlite3",
    DB_FILENAME: ":memory:",
    REDIS_ENABLED: "false"
  };
  delete env.TARGET_URL_MAX_LENGTH;
  delete env.TARGET_URL_MAX_LENGTH_FILE;
  if (value !== undefined) env.TARGET_URL_MAX_LENGTH = value;

  return spawnSync(process.execPath, ["-e", script], {
    cwd: path.join(__dirname, ".."),
    env,
    encoding: "utf8",
    timeout: 10000
  });
}

test("URL length defaults to 2040 and accepts a positive integer override", () => {
  for (const [value, expected] of [[undefined, 2040], ["4096", 4096]]) {
    const result = run("console.log(require('./server/env').TARGET_URL_MAX_LENGTH)", value);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), String(expected));
  }
});

test("non-numeric URL length settings fail at startup", () => {
  for (const value of ["invalid", ""]) {
    const result = run("require('./server/env')", value);
    assert.notEqual(result.status, 0, `Accepted invalid setting: ${value}`);
    assert.match(result.stdout + result.stderr, /TARGET_URL_MAX_LENGTH/);
  }
});

for (const value of [undefined, "4096", "128"]) {
  test(`create and edit enforce the URL length boundary (${value || "default"})`, () => {
    const result = run(`
      const assert = require("node:assert/strict");
      const { validationResult } = require("express-validator");
      const validators = require("./server/handlers/validators.handler");
      const { TARGET_URL_MAX_LENGTH } = require("./server/env");
      const prefix = "https://example.com/";

      (async () => {
        for (const operation of ["createLink", "editLink"]) {
          for (const length of [TARGET_URL_MAX_LENGTH - 1, TARGET_URL_MAX_LENGTH, TARGET_URL_MAX_LENGTH + 1]) {
            const target = prefix + "a".repeat(length - prefix.length);
            const req = {
              body: { target },
              params: { id: "00000000-0000-4000-8000-000000000000" },
              query: {}
            };
            for (const chain of validators[operation]) await chain.run(req);
            const errors = validationResult(req).array();
            if (length <= TARGET_URL_MAX_LENGTH) {
              assert.deepEqual(errors, [], operation + " should accept length " + length);
            } else {
              assert.ok(errors.some(error =>
                error.param === "target" &&
                error.msg === "Maximum URL length is " + TARGET_URL_MAX_LENGTH + "."
              ), operation + " should reject length " + length);
            }
          }
        }
        await require("./server/knex").destroy();
      })().catch(error => { console.error(error); process.exitCode = 1; });
    `, value);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
}
