const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");
const jwt = require("jsonwebtoken");
const campaign = require("../static/scripts/campaign-url");

module.exports = async ({ request, session, database, account, env, restart }) => {
  const db = new Database(database);
  const checked = async (promise, status = 200) => {
    const response = await promise;
    assert.equal(response.status, status, await response.clone().text());
    return status === 204 || status >= 400 ? null : response.json();
  };
  const target = "https://192.0.2.1/path?keep=a&keep=b&utm_source=old&utm_source=duplicate#section";
  const params = { utm_source: "newsletter & partners", utm_medium: "email", utm_campaign: "été + sale", utm_term: "a=b", utm_content: "<script>" };
  const expected = campaign.apply(target, params);
  const getTarget = id => db.prepare("SELECT target FROM links WHERE uuid=?").get(id).target;
  try {
    assert.deepEqual(new URL(expected).searchParams.getAll("keep"), ["a", "b"]);
    assert.equal(new URL(expected).hash, "#section");
    assert.deepEqual(new URL(expected).searchParams.getAll("utm_source"), [params.utm_source]);
    assert.deepEqual(campaign.read(expected), params);
    assert.equal(campaign.apply("example.com/", { utm_medium: "email" }), "https://example.com/?utm_medium=email");
    for (const values of [{ unknown: "x" }, [], { utm_source: 123 }, { utm_source: {} }, { utm_source: ["x"] }, { utm_source: "x\ny" }, { utm_source: "x".repeat(256) }]) assert.throws(() => campaign.apply(target, values));
    assert.throws(() => campaign.apply("https://192.0.2.1/" + "x".repeat(2000), { utm_source: "é".repeat(255) }));
    for (const bad of ["javascript:alert(1)", "ftp://192.0.2.1/", "https://user:pass@192.0.2.1/", "", null, []]) assert.throws(() => campaign.apply(bad, params));
    for (const api of ["/api/links", "/api/v2/links"]) {
      const input = { target, ...params, customurl: "campaign-" + randomUUID() };
      await checked(request("POST", api, input), 401);
      const idempotency = { "Idempotency-Key": randomUUID() };
      const link = await checked(request("POST", api, input, session, idempotency), 201);
      assert.equal(link.target, expected); assert.equal(getTarget(link.id), expected);
      assert.equal((await checked(request("POST", api, input, session, idempotency), 201)).id, link.id);
      await checked(request("POST", api, { ...input, utm_source: "different" }, session, idempotency), 409);
      assert.equal((await request("GET", "/" + link.address)).headers.get("location"), expected);
      await checked(request("PATCH", api + "/" + link.id, { description: "Preserve URL" }, session));
      assert.equal(getTarget(link.id), expected);
      await checked(request("PATCH", api + "/" + link.id, { utm_source: "no target" }, session), 400);
      const removed = campaign.apply(expected, { utm_source: null, utm_medium: "" });
      await checked(request("PATCH", api + "/" + link.id, { target: expected, utm_source: null, utm_medium: "" }, session));
      assert.equal(getTarget(link.id), removed);
      await checked(request("PATCH", api + "/admin/" + link.id, { target, ...params }, session));
      assert.equal(getTarget(link.id), expected);
      for (const payload of [{ target, utm_content: {} }, { target, utm_source: "a".repeat(256) }, { target, utm_term: "\n" }, { target: "javascript:alert(1)", utm_source: "x" }]) {
        await checked(request("PATCH", api + "/" + link.id, payload, session), 400);
        assert.equal(getTarget(link.id), expected);
      }
      await checked(request("PUT", api + "/" + link.id + "/forwarding", { query_keys: ["utm_source", "extra"], path_prefixes: [], revision: 0 }, session));
      assert.equal((await request("GET", "/" + link.address + "?utm_source=attacker&extra=allowed")).headers.get("location"), expected.replace("#section", "&extra=allowed#section"));
      const ruleTarget = "https://192.0.2.1/rule?utm_source=rule";
      await checked(request("PUT", api + "/" + link.id + "/routing", { rules: [{ name: "rule", target: ruleTarget, conditions: { query: [{ key: "rule", op: "present" }] } }], revision: 0 }, session));
      assert.equal((await request("GET", "/" + link.address + "?rule=1&utm_source=attacker")).headers.get("location"), ruleTarget);
      await checked(request("PATCH", api + "/" + link.id, { password: "campaign-password" }, session));
      assert.equal((await checked(request("POST", api + "/" + link.id + "/protected", { password: "campaign-password" }))).target, expected);
      assert.equal((await request("GET", "/" + link.address, undefined, undefined, { Authorization: "Basic " + Buffer.from("x:campaign-password").toString("base64") })).headers.get("location"), expected);
      await checked(request("PATCH", api + "/" + link.id, { password: null }, session));
      for (const format of ["json", "csv"]) {
        const response = await request("GET", "/api/transfer/export?format=" + format + "&q=" + link.address, undefined, session);
        assert.equal(response.status, 200);
        const content = await response.text(), input = { format, content, conflict: "rename" };
        const preview = await checked(request("POST", "/api/transfer/preview", input, session));
        assert.equal(preview.valid, true, JSON.stringify(preview));
        const imported = await checked(request("POST", "/api/transfer/commit", { ...input, preview_token: preview.preview_token }, session), 201);
        assert.equal(getTarget(imported.created[0].id), expected);
      }
      await checked(request("DELETE", api + "/" + link.id, undefined, session));
      await checked(request("POST", api + "/" + link.id + "/restore", {}, session));
      assert.equal(getTarget(link.id), expected);
      const audit = db.prepare("SELECT h.fields FROM link_history h JOIN links l ON l.id=h.link_id WHERE l.uuid=? AND h.action='updated'").all(link.id);
      assert(audit.some(row => JSON.parse(row.fields).includes("target")));
    }
    const owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
    const otherEmail = "campaign-" + randomUUID() + "@example.invalid";
    const password = db.prepare("SELECT password FROM users WHERE id=?").get(owner).password;
    const other = Number(db.prepare("INSERT INTO users(email,password,role,verified,banned) VALUES(?,?,'USER',1,0)").run(otherEmail, password).lastInsertRowid);
    const otherSession = jwt.sign({ iss: "ApiAuth", sub: other }, env.JWT_SECRET, { expiresIn: 300 });
    await checked(request("GET", "/api/links", undefined, otherSession));
    const link = await checked(request("POST", "/api/links", { target, ...params }, session), 201);
    const edit = { target, utm_source: "forbidden" };
    const denied = await request("PATCH", "/api/links/" + link.id, edit, otherSession);
    assert.equal(denied.status, 500, "Existing legacy edit denial status");
    assert.equal((await denied.json()).error, "Link was not found.");
    assert.equal(getTarget(link.id), expected);
    await checked(request("PATCH", "/api/links/admin/" + link.id, edit, otherSession), 401);
    await checked(request("PATCH", "/api/links/" + link.id, edit, session, { Origin: "https://attacker.invalid" }), 403);
    for (const headers of [{ Origin: "null" }, { "Sec-Fetch-Site": "cross-site" }]) {
      for (const api of ["/api/links", "/api/v2/links"]) {
        await checked(request("POST", api, { target }, session, headers), 403);
        await checked(request("PATCH", api + "/" + link.id, edit, session, headers), 403);
        await checked(request("PATCH", api + "/admin/" + link.id, edit, session, headers), 403);
        await checked(request("DELETE", api + "/" + link.id, undefined, session, headers), 403);
        await checked(request("POST", api + "/admin/ban/" + link.id, {}, session, headers), 403);
      }
    }
    assert.equal(getTarget(link.id), expected);
    await checked(request("PATCH", "/api/links/" + link.id, { description: "Same-origin edit" }, session, { Origin: "https://" + env.DEFAULT_DOMAIN }));
    const write = await checked(request("POST", "/api/tokens", { name: "Campaign explicit API", scopes: ["links:update"] }, session), 201);
    await checked(request("PATCH", "/api/links/" + link.id, { description: "Explicit API client" }, session, { Origin: "https://api-client.invalid", "X-API-Key": write.token }));
    await checked(request("PATCH", "/api/links/" + link.id, edit, session, { Origin: "https://api-client.invalid", "X-API-Key": "invalid" }), 401);
    const read = await checked(request("POST", "/api/tokens", { name: "Campaign read denial", scopes: ["links:read"] }, session), 201);
    await checked(request("PATCH", "/api/links/" + link.id, edit, session, { "X-API-Key": read.token }), 403);
    const space = await checked(request("POST", "/api/workspaces", { name: "Campaign " + randomUUID() }, session), 201);
    const endpoint = "/api/workspaces/" + space.id;
    const shared = await checked(request("POST", endpoint + "/links", { target, ...params }, session), 201);
    assert.equal(getTarget(shared.id), expected);
    const invite = await checked(request("POST", endpoint + "/members", { email: otherEmail, role: "viewer" }, session), 201);
    await checked(request("POST", "/api/workspaces/invitations/" + invite.id + "/accept", {}, otherSession));
    await checked(request("PATCH", endpoint + "/links/" + shared.id, edit, otherSession), 403);
    await checked(request("PATCH", endpoint + "/members/" + invite.id, { role: "editor" }, session), 204);
    await checked(request("PATCH", endpoint + "/links/" + shared.id, { target: expected, utm_content: "" }, otherSession));
    assert.equal(getTarget(shared.id), campaign.apply(expected, { utm_content: "" }));
    assert.equal(db.prepare("SELECT user_id FROM links WHERE uuid=?").get(shared.id).user_id, owner);
    await checked(request("DELETE", endpoint, { confirm: space.id }, session), 204);
    await restart(); assert.equal(getTarget(link.id), expected);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok"); assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: campaign URL encoding/limits, API aliases, idempotency, edits/clears, public/protected/Basic/routed/forwarded redirects, history/trash/restart/transfer, owner/admin/token/CSRF and workspace roles");
  } finally { db.close(); }
};
