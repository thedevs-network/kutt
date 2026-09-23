// Administrative migration only. Supply a verified issuer/subject/user_id map on stdin.
const fs = require("node:fs");
const knex = require("../server/knex");
const env = require("../server/env");
const { identityKey } = require("../server/oidc-security");

async function main() {
  const input = fs.readFileSync(0, "utf8");
  if (Buffer.byteLength(input) > 1024 * 1024) throw new Error("Input exceeds limit");
  const rows = JSON.parse(input);
  if (!Array.isArray(rows) || !rows.length || rows.length > 1000) throw new Error("Expected 1-1000 mappings");
  await knex.transaction(async db => {
    const roles = require("../server/oidc-roles");
    await roles.lock(db);
    for (const row of rows) {
      if (row.issuer !== env.OIDC_ISSUER || !Number.isSafeInteger(row.user_id) ||
          typeof row.subject !== "string" || !row.subject || row.subject.length > 255) throw new Error("Invalid mapping");
      const user = await db("users").where({ id: row.user_id, banned: false, verified: true }).first();
      if (!user) throw new Error("Existing verified active account required");
      if (Number(user.id) === Number(await roles.protectedId(db))) throw new Error("Protected local account cannot be bound");
      const id = identityKey(row.issuer, row.subject);
      const existing = await db("oidc_identities").where({ id }).first();
      if (existing && existing.user_id !== user.id) throw new Error("Identity belongs to another account");
      if (existing) continue;
      if (await db("oidc_identities").where({ user_id: user.id, issuer: row.issuer }).first()) throw new Error("Account already bound to another subject");
      await db("oidc_identities").insert({ id, issuer: row.issuer, subject: row.subject, user_id: user.id, created_at: Date.now() });
      // Pre-migration cookies have no issuer/subject context; require a fresh login.
      if (roles.policy.enabled) await roles.reset(db, user.id);
      else await db("users").where({ id: user.id }).increment("auth_version", 1).update(require("../server/account-tokens"));
    }
  });
  console.log(JSON.stringify({ result: "bound", mappings: rows.length }));
}

main().catch(() => { console.error("Identity binding failed; no mappings were changed. Verify the input and existing ownership."); process.exitCode = 1; })
  .finally(() => knex.destroy());
