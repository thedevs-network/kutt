const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");

module.exports = async ({ request, session, database, account, env }) => {
  const db = new Database(database);
  const email = "12345.filter@example.invalid";
  let owner;
  try {
    const password = db.prepare("SELECT password FROM users WHERE email=?").get(account.email).password;
    owner = Number(db.prepare("INSERT INTO users(email,password,role,verified) VALUES(?,?,'USER',1)").run(email, password).lastInsertRowid);
    const alias = "filter-" + randomUUID();
    db.prepare("INSERT INTO links(uuid,address,target,user_id) VALUES(?,?,?,?)").run(randomUUID(), alias, "https://example.invalid/", owner);
    db.prepare("INSERT INTO domains(uuid,address,user_id) VALUES(?,?,?)").run(randomUUID(), "filter.example.invalid", owner);
    const ordinary = jwt.sign({ iss: "ApiAuth", sub: owner }, env.JWT_SECRET, { expiresIn: 60 });
    assert.equal((await request("GET", "/api/v2/links", undefined, ordinary)).status, 200, "Ordinary session is valid");
    let response = await request("POST", "/api/v2/tokens", { name: "Admin search denial", scopes: ["links:read"] }, session);
    assert.equal(response.status, 201);
    const scoped = await response.json();
    for (const kind of ["links", "domains"]) {
      const path = "/api/v2/" + kind + "/admin";
      for (const [filter, count] of [[email, 1], ["12345.filter@", 1], [" " + email + " ", 1],
        [String(owner), 1], ["000" + owner, 1], ["0", 0], ["9".repeat(80), 0],
        [owner + "nonsense", 0], ["not-present@example.invalid", 0]]) {
        response = await request("GET", path + "?user=" + encodeURIComponent(filter), undefined, session);
        assert.equal(response.status, 200, kind + ": " + filter);
        const result = await response.json();
        assert.equal(result.total, count, kind + " count parity: " + filter);
        assert.equal(result.data.length, count);
        if (count) assert.equal(result.data[0].email, email);
      }
      response = await request("GET", path + "?user=" + encodeURIComponent(email) + "&skip=1&limit=1", undefined, session);
      const page = await response.json();
      assert.equal(page.total, 1); assert.deepEqual(page.data, []);
      response = await request("GET", path + "?user[]=" + encodeURIComponent(email), undefined, session);
      assert.equal(response.status, 200); assert.equal((await response.json()).total, 0);
      assert.equal((await request("GET", path)).status, 401);
      assert.equal((await request("GET", path, undefined, ordinary)).status, 401, "Existing admin-only denial contract");
      assert.equal((await request("GET", path, undefined, session, { "X-API-Key": scoped.token })).status, 403);
      response = await request("GET", path + "?user=" + encodeURIComponent(email), undefined, session, { Accept: "text/html" });
      assert.equal(response.status, 200);
      assert((await response.text()).includes(kind === "links" ? alias : "filter.example.invalid"));
    }
    assert.equal((await request("DELETE", "/api/v2/tokens/" + scoped.id, undefined, session)).status, 204);
    console.log("PASS: admin link/domain numeric-email and ID filters, count/list/pagination parity, HTML and authorization boundaries");
  } finally {
    if (owner) {
      db.prepare("DELETE FROM links WHERE user_id=?").run(owner);
      db.prepare("DELETE FROM domains WHERE user_id=?").run(owner);
      db.prepare("DELETE FROM users WHERE id=?").run(owner);
    }
    db.close();
  }
};
