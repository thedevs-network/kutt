const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Execute the real list/manage/lock code against a deterministic lock scheduler.
// Reassign the domain after authorization reads but before the recipient query.
module.exports = async function () {
  const id = "00000000-0000-4000-8000-000000000001";
  const domain = { id: 1, uuid: id, address: "shared.example.invalid", user_id: 1, banned: false };
  const users = [1, 2].map(id => ({ id, role: "USER", verified: true, banned: false, auth_version: 0 }));
  const recipient = email => ({ id: email, email, created_at: 1 });
  let rows = [recipient("old-recipient@example.invalid")];
  let holder, unlock, attempted, mutation, interleave = true, access;
  const events = [];
  function connection(transaction = false) {
    const db = table => {
      const where = {};
      const query = {
        where(key, value) { Object.assign(where, typeof key === "string" ? { [key]: value } : key); return this; },
        forUpdate() { assert(db.isTransaction); return this; },
        join() { return this; },
        select() { return this; },
        async first() {
          events.push(table);
          const values = table === "domains" ? [domain] : table === "users" ? users : [];
          return values.filter(row => Object.entries(where).every(([key, value]) => row[key] === value)).map(row => ({ ...row }))[0];
        },
        async orderBy() {
          assert.equal(table, "domain_grants as g");
          assert.equal(where["g.domain_id"], domain.id);
          events.push("recipients");
          return rows.map(row => ({ ...row }));
        },
        async increment() {
          assert.equal(table, "domain_access_state");
          assert(db.isTransaction);
          attempted?.();
          while (holder) await unlock;
          holder = db;
          unlock = new Promise(resolve => { db.release = resolve; });
          events.push("guard");
        }
      };
      return query;
    };
    db.isTransaction = transaction;
    return db;
  }
  const knex = connection();
  knex.transaction = async callback => {
    const db = connection(true);
    try { return await callback(db); }
    finally { if (holder === db) { holder = null; db.release(); } }
  };
  const roles = { async allowsAdmin(db) {
    if (interleave) {
      interleave = false;
      const started = new Promise(resolve => { attempted = resolve; });
      mutation = knex.transaction(async writer => {
        await access.lock(writer);
        domain.user_id = 2;
        rows = [recipient("new-owner-private@example.invalid")];
        events.push("reassigned");
      });
      await started;
      attempted = null;
      // An unguarded reader allows the writer to finish before its next query.
      if (holder !== db) await mutation;
    }
    return false;
  } };
  class CustomError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
  const module = { exports: {} };
  vm.runInNewContext(readFileSync(path.join(__dirname, "../server/domain-access.js"), "utf8"), {
    module, require(name) {
      if (name === "./knex") return knex;
      if (name === "./i18n") return { t: key => key };
      if (name === "./utils") return { CustomError };
      if (name === "./oidc-roles") return roles;
      if (name === "node:crypto") return require(name);
      throw Error("Unexpected dependency: " + name);
    }
  });
  access = module.exports;
  const result = await access.list({ user: users[0] }, id);
  await mutation;
  assert.equal(result.data[0].email, "old-recipient@example.invalid", "A previous domain owner must not receive the new owner's recipients");
  assert(events.indexOf("guard") < events.indexOf("domains"), "Acquire the domain guard before any authorization read or row lock");
  assert(events.indexOf("recipients") < events.indexOf("reassigned"), "The recipient read and permission check must precede reassignment together");
  await assert.rejects(access.list({ user: users[0] }, id), error => error.statusCode === 404);
  assert.equal((await access.list({ user: users[1] }, id)).data[0].email, "new-owner-private@example.invalid");
  assert.equal(holder, null, "Successful and denied reads both release the guard");
  console.log("PASS: deterministic domain reassignment cannot mix grant-list authorization and recipient reads");
};
if (require.main === module) module.exports().catch(error => { console.error(error); process.exitCode = 1; });
