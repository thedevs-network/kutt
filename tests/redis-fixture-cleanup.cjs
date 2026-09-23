const assert = require("node:assert/strict");
const { mkdtempSync, writeFileSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

module.exports = ({ root }) => {
  const dir = mkdtempSync(join(tmpdir(), "kutt-redis-cleanup-"));
  const id = "a".repeat(64);
  try {
    writeFileSync(join(dir, "docker"), `#!${process.execPath}
      const fs=require('node:fs'), a=process.argv.slice(2), mode=process.env.FIXTURE_MODE;
      fs.appendFileSync(process.env.FIXTURE_LOG,JSON.stringify(a)+'\\n');
      if(a[0]==='run' && a.includes('--cidfile')) {
        if(mode==='collision') process.exit(125);
        fs.writeFileSync(a[a.indexOf('--cidfile')+1],${JSON.stringify(id)});
        if(mode==='start-failure') process.exit(125);
      } else if(a[0]==='exec') {if(mode==='readiness') process.exit(1); process.stdout.write('PONG\\n');}
      else if(a[0]==='run' && mode==='candidate-failure') process.exit(42);
    `, { mode: 0o700 });
    for (const [mode, status] of [["collision", 125], ["start-failure", 125], ["readiness", 1], ["candidate-failure", 42], ["success", 0]]) {
      const log = join(dir, mode + ".jsonl");
      // Shell functions avoid executing fixtures from hardened noexec /tmp.
      const result = spawnSync("/bin/sh", ["-c", 'docker() { "$FIXTURE_NODE" "$FIXTURE_DOCKER" "$@"; }; sleep() { :; }; set -- test-only-image; . "$FIXTURE_SCRIPT"'], {
        env: { ...process.env, FIXTURE_NODE: process.execPath, FIXTURE_DOCKER: join(dir, "docker"), FIXTURE_SCRIPT: join(root, "tests/redis-smoke.sh"), FIXTURE_LOG: log, FIXTURE_MODE: mode }, encoding: "utf8", timeout: 10000
      });
      assert.equal(result.status, status, result.stderr);
      const commands = readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
      const removed = commands.filter(args => args[0] === "rm");
      assert.deepEqual(removed, mode === "collision" ? [] : [["rm", "-f", id]]);
      for (const args of commands.filter(args => args[0] === "exec")) assert.equal(args[1], id);
      for (const args of commands.filter(args => args[0] === "run" && args.includes("--rm"))) assert.equal(args[args.indexOf("--network") + 1], "container:" + id);
    }
    console.log("PASS: Redis fixture cleanup preserves name collisions, uses only its created ID, and retains failure status");
  } finally { rmSync(dir, { recursive: true, force: true }); }
};
