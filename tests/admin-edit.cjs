const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");

module.exports = async ({ request, session, database, account, env, restart }) => {
  const db = new Database(database), html = { Accept: "text/html" };
  const body = async response => {
    response = await response;
    assert.equal(response.status, 200, await response.clone().text());
    return response.text();
  };
  const field = (page, name) => page.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0].match(/value="([^"]*)"/)?.[1] || "";
  try {
    const own = db.prepare("SELECT id,password FROM users WHERE email=?").get(account.email);
    const email = "admin-edit-owner@example.invalid";
    const owner = Number(db.prepare("INSERT INTO users(email,password,role,verified) VALUES(?,?,'USER',1)").run(email, own.password).lastInsertRowid);
    const ordinary = jwt.sign({ iss: "ApiAuth", sub: owner }, env.JWT_SECRET, { expiresIn: 600 });
    const domain = Number(db.prepare("INSERT INTO domains(uuid,address,user_id) VALUES(?,?,?)").run(randomUUID(), "admin-edit.example.invalid", owner).lastInsertRowid);
    for (const [userId, expectedEmail, domainId] of [[own.id, account.email, null], [owner, email, domain], [null, null, null]]) {
      const id = randomUUID(), alias = "admin-edit-" + randomUUID();
      db.prepare("INSERT INTO links(uuid,address,target,user_id,domain_id,paused,max_visits) VALUES(?,?,?,?,?,1,23)")
        .run(id, alias, "https://192.0.2.1/admin-edit", userId, domainId);
      const endpoint = "/api/links/admin/" + id, render = "/admin/link/edit/" + id;
      const state = () => db.prepare("SELECT user_id,domain_id,paused,max_visits,description,expire_in,target FROM links WHERE uuid=?").get(id);
      const context = page => {
        assert(page.includes('hx-patch="/api/links/admin/{id}"'));
        assert(page.includes('hx-select="#edit-form-' + id + '"'));
        assert(!page.includes('hx-patch="/api/links/{id}"'));
        assert(!page.includes("Save availability"));
        assert(page.includes(expectedEmail || "Anonymous"));
        if (expectedEmail) assert(page.includes('aria-label="View links by this user"'));
        assert(page.includes(domainId ? "admin-edit.example.invalid/" : env.DEFAULT_DOMAIN + "/"));
        assert.equal(state().paused, 1); assert.equal(state().max_visits, 23);
        assert.equal(state().user_id, userId); assert.equal(state().domain_id, domainId);
      };
      let page = await body(request("GET", render, undefined, session, html));
      context(page);
      const payload = { target: state().target, address: alias, description: "Admin update", password: "", expire_in: "", expiry_snapshot: field(page, "expiry_snapshot") };
      page = await body(request("PATCH", endpoint, payload, session, html));
      assert(page.includes("Link has been updated.")); context(page);
      for (const [key, value, error] of [["target", "not a url", "URL is not valid"], ["address", "bad alias", "Custom URL is not valid"], ["expire_in", "nonsense", "Expire format is invalid"]]) {
        const before = state();
        page = await body(request("PATCH", endpoint, { ...payload, [key]: value, email: "forged@example.invalid", user_id: 9999, domain: "forged.invalid" }, session, html));
        assert(page.includes(error)); context(page);
        assert.equal(field(page, key), value);
        assert(!page.includes("forged@example.invalid")); assert(!page.includes("forged.invalid"));
        assert.deepEqual(state(), before);
        page = await body(request("PATCH", endpoint, { ...payload, description: "Corrected " + key }, session, html));
        assert(page.includes("Link has been updated.")); context(page);
      }
      page = await body(request("PATCH", endpoint, { description: state().description }, session, html));
      assert(page.includes("Should at least update one field")); context(page);
      const rejectedPassword = await body(request("PATCH", endpoint, { address: "bad alias", password: "never-echo-this-password" }, session, html));
      assert(!rejectedPassword.includes("never-echo-this-password")); context(rejectedPassword);
      assert.equal((await request("PATCH", endpoint, { description: "Forbidden" }, ordinary)).status, 401);
      assert.equal((await request("PATCH", endpoint, { description: "Anonymous" })).status, 401);
      const denied = await request("GET", render, undefined, ordinary, html);
      assert(!(await denied.text()).includes(expectedEmail || alias));
      const api = await request("PATCH", endpoint, { description: "API compatibility" }, session);
      assert.equal(api.status, 200); assert.equal(Object.hasOwn(await api.json(), "email"), false);
      context(await body(request("GET", render, undefined, session, html)));
    }
    // A new owner email must be read from the authorized join, not cached output.
    const other = db.prepare("SELECT uuid FROM links WHERE user_id=? LIMIT 1").get(owner);
    db.prepare("UPDATE users SET email=? WHERE id=?").run("changed-owner@example.invalid", owner);
    const current = await body(request("PATCH", "/api/links/admin/" + other.uuid, { description: "Fresh owner" }, session, html));
    assert(current.includes("changed-owner@example.invalid")); assert(!current.includes(email));
    const missing = await body(request("PATCH", "/api/links/admin/" + randomUUID(), { description: "Absent" }, session, html));
    assert(missing.includes("No link was found")); assert(!missing.includes("edit-form-"));
    await restart();
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: admin owner/domain context, validation drafts, no-change/retry, anonymous/custom-domain links, authorization, API privacy and restart");
  } finally { db.close(); }
};
