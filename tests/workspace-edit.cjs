const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");

module.exports = async ({ request, session, database, account, restart }) => {
  const db = new Database(database);
  const checked = async (promise, status = 200) => {
    const r = await promise;
    assert.equal(r.status, status, await r.clone().text());
    return r;
  };
  const json = async (promise, status) => (await checked(promise, status)).json();
  const html = { Accept: "text/html" };
  const revision = page => {
    const token = page.match(/name="edit_revision" value="([a-f0-9]{64})"/);
    assert(token, "Missing signed edit revision");
    return token[1];
  };
  try {
    const owner = db.prepare("SELECT * FROM users WHERE email=?").get(account.email);
    const email = "workspace-edit-" + randomUUID() + "@example.invalid";
    db.prepare("INSERT INTO users(email,password,verified,banned) VALUES(?,?,1,0)").run(email, owner.password);
    const editor = (await json(request("POST", "/api/auth/login", { email, password: account.password }))).token;
    const space = await json(request("POST", "/api/v2/workspaces", { name: "Edit race " + randomUUID() }, session), 201);
    const base = "/api/v2/workspaces/" + space.id, pagePath = "/settings/workspaces/" + space.id;
    const invite = await json(request("POST", base + "/members", { email, role: "editor" }, session), 201);
    await checked(request("POST", "/api/v2/workspaces/invitations/" + invite.id + "/accept", {}, editor));
    const created = await json(request("POST", base + "/links", { target: "https://192.0.2.1/original", address: "ws-edit-" + randomUUID() }, session), 201);
    const endpoint = base + "/links/" + created.id;
    const current = () => db.prepare("SELECT * FROM links WHERE uuid=?").get(created.id);
    const page = async (who = editor, query = "") => (await checked(request("GET", pagePath + query, undefined, who, html))).text();
    const input = token => ({ operation: "edit_link", link_id: created.id, edit_revision: token, policy: "on",
      target: "https://192.0.2.1/original", address: current().address, description: "Retain <draft> & values",
      starts_at: "", ends_at: "", max_visits: "" });
    for (const who of [session, editor]) {
      const stale = revision(await page(who));
      await checked(request("PATCH", "/api/links/" + created.id + "/lifecycle",
        { paused: true, starts_at: "2080-01-01T00:00:00Z", ends_at: "2081-01-01T00:00:00Z", max_visits: 19 }, session));
      const before = current();
      const response = await checked(request("POST", pagePath, input(stale), who, html), 409);
      const text = await response.text();
      assert(text.includes("This link changed elsewhere."));
      assert.equal(text.split("This link changed elsewhere.").length - 1, 1, "Announce the conflict once");
      assert(text.includes('class="workspace-edit" id="workspace-edit-' + created.id + '" open'));
      assert(text.includes("Retain &lt;draft&gt; &amp; values"));
      assert(text.includes("Current saved values"));
      assert.deepEqual(current(), before, "Conflict must save none of the draft");
      const fresh = revision(text);
      assert.notEqual(fresh, stale);
      await checked(request("POST", pagePath, { ...input(fresh), paused: "on", max_visits: "19" }, who, html), 303);
      assert.equal(current().paused, 1); assert.equal(current().max_visits, 19);
      assert.equal(current().description, "Retain <draft> & values");
      await checked(request("PATCH", endpoint, { paused: false, starts_at: null, ends_at: null, max_visits: null }, editor));
    }

    // Invalid alias/target/lifecycle retain the non-secret draft and old revision.
    const old = revision(await page());
    for (const invalid of [{ address: "bad alias" }, { target: "javascript:alert(1)" }, { starts_at: "2082-01-01T00:00", ends_at: "2081-01-01T00:00" }, { max_visits: "0" }]) {
      const before = current();
      const submitted = { ...input(old), ...invalid, password: "NEVER-ECHO-THIS-PASSWORD", paused: "on" };
      const text = await (await checked(request("POST", pagePath, submitted, editor, html), 400)).text();
      assert(text.includes("Retain &lt;draft&gt; &amp; values"));
      assert(text.includes("Password was not retained."));
      assert(!text.includes("NEVER-ECHO-THIS-PASSWORD"));
      assert.equal(revision(text), old);
      assert.deepEqual(current(), before);
    }
    await checked(request("POST", pagePath, { ...input(old), edit_revision: "" }, editor, html), 409);
    await checked(request("POST", pagePath, { ...input(old), edit_revision: "x".repeat(64) }, editor, html), 409);

    // A validation error must not rebase a stale token silently.
    await checked(request("PATCH", endpoint, { description: "Independent editor", target: "https://192.0.2.1/new-target" }, session));
    const invalid = await (await checked(request("POST", pagePath, { ...input(old), max_visits: "0" }, editor, html), 400)).text();
    assert.equal(revision(invalid), old);
    await checked(request("POST", pagePath, input(old), editor, html), 409);
    // Recover the edited row even when a concurrent change removes it from a filter.
    const filtered = await (await checked(request("POST", pagePath + "?q=original", input(old), editor, html), 409)).text();
    assert(filtered.includes('name="link_id" value="' + created.id + '"'));
    assert(filtered.includes("https://192.0.2.1/new-target"));

    const getLink = async () => (await json(request("GET", base, undefined, editor))).data.find(l => l.id === created.id);
    let saved = await getLink();
    assert.match(saved.edit_revision, /^[a-f0-9]{64}$/);
    const apiBefore = current();
    await checked(request("PATCH", endpoint, { description: "No stale API save", edit_revision: old }, editor), 409);
    assert.deepEqual(current(), apiBefore);
    await checked(request("PATCH", endpoint, { description: "API reviewed", edit_revision: saved.edit_revision }, editor));
    saved = await getLink();
    const concurrent = await Promise.all(["A", "B"].map(description => request("PATCH", endpoint, { description, edit_revision: saved.edit_revision }, editor)));
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 409]);
    assert.equal((await request("GET", "/" + current().address)).status, 302);
    // Redirect counter changes alone must not invalidate editing.
    saved = await getLink();
    await request("GET", "/" + current().address);
    await checked(request("PATCH", endpoint, { description: "Visits do not conflict", edit_revision: saved.edit_revision }, editor));
    await restart();
    saved = await getLink();
    await checked(request("PATCH", endpoint, { description: "Restart", edit_revision: saved.edit_revision }, editor));
    const revoked = revision(await page());
    await checked(request("PATCH", base + "/members/" + invite.id, { role: "viewer" }, session), 204);
    const denied = await (await checked(request("POST", pagePath, input(revoked), editor, html), 403)).text();
    assert(!denied.includes('name="edit_revision"'));
    assert(!denied.includes("Retain &lt;draft&gt;"));
    await checked(request("DELETE", base + "/members/" + invite.id, undefined, session), 204);
    await checked(request("POST", pagePath, input(revoked), editor, html), 404);
    assert.equal(current().description, "Restart");
    await checked(request("DELETE", base, { confirm: space.id }, session), 204);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: shared edit revisions, atomic personal/workspace races, validation drafts/no passwords, filtered recovery, review/retry, legacy APIs, role revocation and restart");
  } finally { db.close(); }
};
