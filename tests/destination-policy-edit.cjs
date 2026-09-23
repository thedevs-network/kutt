const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const Database = require("better-sqlite3");

module.exports = async function ({ request, session, database, account, restart, env, root, directory }) {
  const db = new Database(database), prefix = "policy-edit-" + randomUUID();
  const denied = "https://198.51.100.2/original", changed = "https://203.0.113.2/changed", allowed = "https://192.0.2.1/repaired";
  const checked = async (promise, status = 200) => {
    const response = await promise;
    assert.equal(response.status, status, await response.clone().text());
    return response;
  };
  const json = async (promise, status = 200) => (await checked(promise, status)).json();
  const html = { Accept: "text/html" };
  const current = id => db.prepare("SELECT * FROM links WHERE uuid=?").get(id);
  try {
    const admin = db.prepare("SELECT * FROM users WHERE email=?").get(account.email);
    const users = [];
    for (const name of ["owner", "editor"]) {
      const email = prefix + "-" + name + "@example.invalid";
      const id = Number(db.prepare("INSERT INTO users(email,password,verified,banned) VALUES(?,?,1,0)").run(email, admin.password).lastInsertRowid);
      users.push({ id, email, token: (await json(request("POST", "/api/auth/login", { email, password: account.password }))).token });
    }
    const [owner, editor] = users;
    const create = async (token, suffix) => json(request("POST", "/api/links", { target: denied, customurl: prefix.slice(0, 45) + suffix }, token), 201);
    const personal = await create(owner.token, "personal"), managed = await create(owner.token, "admin"), foreign = await create(editor.token, "foreign");
    const space = await json(request("POST", "/api/workspaces", { name: prefix }, owner.token), 201);
    const base = "/api/workspaces/" + space.id, page = "/settings/workspaces/" + space.id;
    const invitation = await json(request("POST", base + "/members", { email: editor.email, role: "editor" }, owner.token), 201);
    await checked(request("POST", "/api/workspaces/invitations/" + invitation.id + "/accept", {}, editor.token));
    const shared = await json(request("POST", base + "/links", { target: denied, address: prefix.slice(0, 45) + "shared" }, owner.token), 201);
    env.DESTINATION_ALLOWED_HOSTS = '["192.0.2.1"]'; await restart();

    for (const [link, token, route] of [[personal, owner.token, "/api/links/"], [managed, session, "/api/links/admin/"]]) {
      for (const headers of [{}, html]) {
        const input = { target: denied, address: link.address, description: "Unchanged denied target", password: "", expire_in: "" };
        const response = await checked(request("PATCH", route + link.id, input, token, headers));
        if (headers.Accept) assert((await response.text()).includes("Link has been updated"));
        assert.equal(current(link.id).target, denied); assert.equal(current(link.id).description, input.description);
        const blocked = await checked(request("GET", "/" + link.address), 410); assert.equal(blocked.headers.get("location"), null);
        const before = current(link.id);
        const rejected = await checked(request("PATCH", route + link.id, { ...input, target: changed, description: "Must not save" }, token, headers), headers.Accept ? 200 : 400);
        assert((await rejected.text()).includes("destination policy")); assert.deepEqual(current(link.id), before);
        await checked(request("PATCH", route + link.id, { ...input, target: allowed, description: "Repaired" }, token, headers));
        assert.equal(current(link.id).target, allowed);
        db.prepare("UPDATE links SET target=? WHERE uuid=?").run(denied, link.id);
      }
    }
    await checked(request("PATCH", "/api/links/" + personal.id, { target: denied, password: "policy-edit-password" }, owner.token));
    assert(await require("bcryptjs").compare("policy-edit-password", current(personal.id).password));
    await checked(request("PATCH", "/api/links/" + personal.id, { target: denied, password: "" }, owner.token));
    assert.equal(current(personal.id).password, null);
    for (const id of [foreign.id, randomUUID()]) {
      await checked(request("PATCH", "/api/links/" + id, { target: denied, description: "No foreign bypass" }, owner.token), 500);
    }
    await checked(request("PATCH", "/api/links/admin/" + randomUUID(), { target: denied, description: "No missing bypass" }, session), 500);
    assert.equal(current(foreign.id).description, null);
    const scoped = await json(request("POST", "/api/tokens", { name: prefix, scopes: ["links:update"], domain_scope: "default" }, owner.token), 201);
    await checked(request("PATCH", "/api/links/" + personal.id, { target: denied, description: "Scoped unchanged" }, undefined, { "X-API-Key": scoped.token }));
    await checked(request("PATCH", "/api/links/" + foreign.id, { target: denied, description: "Scoped foreign" }, undefined, { "X-API-Key": scoped.token }), 404);

    const sharedCurrent = async () => (await json(request("GET", base, undefined, editor.token))).data.find(link => link.id === shared.id);
    for (const native of [false, true]) {
      const saved = await sharedCurrent();
      const input = { target: denied, address: saved.address, description: "Shared metadata", edit_revision: saved.edit_revision };
      const send = (body, status) => checked(native
        ? request("POST", page, { operation: "edit_link", link_id: shared.id, ...body }, editor.token, html)
        : request("PATCH", base + "/links/" + shared.id, body, editor.token), status);
      await send(input, native ? 303 : 200);
      assert.equal(current(shared.id).target, denied); assert.equal(current(shared.id).description, input.description);
      await checked(request("HEAD", "/" + saved.address), 410);
      const fresh = await sharedCurrent(), before = current(shared.id);
      await send({ ...input, edit_revision: fresh.edit_revision, target: changed }, 400);
      assert.deepEqual(current(shared.id), before);
      await send({ ...input, edit_revision: fresh.edit_revision, target: allowed }, native ? 303 : 200);
      assert.equal(current(shared.id).target, allowed);
      await send({ ...input, edit_revision: fresh.edit_revision }, 409);
      assert.equal(current(shared.id).target, allowed, "Stale denied snapshot cannot undo a repair");
      db.prepare("UPDATE links SET target=? WHERE uuid=?").run(denied, shared.id);
    }
    for (const id of [foreign.id, randomUUID()]) await checked(request("PATCH", base + "/links/" + id, { target: denied, description: "Not shared" }, editor.token), 404);
    const draft = await sharedCurrent();
    await checked(request("PATCH", base + "/members/" + invitation.id, { role: "viewer" }, owner.token), 204);
    await checked(request("PATCH", base + "/links/" + shared.id, { target: denied, description: "Revoked editor", edit_revision: draft.edit_revision }, editor.token), 403);
    db.prepare("UPDATE links SET user_id=? WHERE uuid=?").run(editor.id, personal.id);
    await checked(request("PATCH", "/api/links/" + personal.id, { target: denied, description: "Stale owner" }, owner.token), 500);
    db.prepare("UPDATE links SET user_id=? WHERE uuid=?").run(owner.id, personal.id);

    const races = spawnSync(process.execPath, ["-e", `require(${JSON.stringify(path.join(root, "tests/destination-policy-edit-races.cjs"))})(${JSON.stringify({ owner: owner.id, other: editor.id, admin: admin.id, id: personal.id, denied, allowed })}).catch(e=>{console.error(e);process.exitCode=1})`], { cwd: directory, env, encoding: "utf8", timeout: 30000 });
    assert.equal(races.status, 0, races.stderr); console.log(races.stdout.trim());
    console.log("PASS: policy edits submit unchanged denied targets through personal/admin/workspace forms and APIs; changes/repair, scoped/foreign/missing links, revoked membership and stale ownership/revisions");
  } finally { env.DESTINATION_ALLOWED_HOSTS = ""; await restart(); db.close(); }
};
