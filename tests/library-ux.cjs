const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHmac } = require("node:crypto");
const Database = require("better-sqlite3");

module.exports = async ({ request, session, database, env }) => {
  const db = new Database(database), prefix = "library-state-" + randomUUID();
  const headers = { Accept: "text/html" };
  const response = await request("GET", "/api/health");
  const origin = new URL(response.url).origin;
  const owner = db.prepare("SELECT id FROM users WHERE role='ADMIN' ORDER BY id LIMIT 1").get();
  const ids = {}, now = Date.now();
  let workspaceId;
  try {
    for (const state of ["Active", "Paused", "Scheduled", "Expired", "Visit limit reached", "In trash"]) {
      const row = await request("POST", "/api/links", { target: "https://example.invalid/", customurl: prefix + "-" + Object.keys(ids).length }, session);
      assert.equal(row.status, 201); ids[state] = (await row.json()).id;
    }
    db.prepare("UPDATE links SET paused=1 WHERE uuid=?").run(ids.Paused);
    db.prepare("UPDATE links SET starts_at=? WHERE uuid=?").run(now + 3600000, ids.Scheduled);
    db.prepare("UPDATE links SET ends_at=? WHERE uuid=?").run(now - 60000, ids.Expired);
    db.prepare("UPDATE links SET max_visits=1,redirect_count=1 WHERE uuid=?").run(ids["Visit limit reached"]);
    db.prepare("UPDATE links SET deleted_at=? WHERE uuid=?").run(now, ids["In trash"]);
    const list = async state => (await (await request("GET", "/api/library?" + new URLSearchParams({ q: prefix, state }), undefined, session)).json());
    assert.equal((await list("active")).total, 5, "Legacy active still means every non-trashed row");
    assert.equal((await list("paused")).total, 1);
    const unpaused = await list("unpaused"); assert.equal(unpaused.total, 4);
    for (const state of ["Scheduled", "Expired", "Visit limit reached"]) assert(unpaused.data.some(row => row.id === ids[state]));
    assert.equal((await list("trash")).total, 1);
    const filter = await request("POST", "/api/library/filters", { name: prefix, filters: { q: prefix, state: "active" } }, session);
    assert.equal(filter.status, 201); const saved = await filter.json();
    assert.equal((await (await request("GET", "/api/library?saved=" + saved.id, undefined, session)).json()).total, 5);
    const page = await request("GET", "/settings/library?saved=" + saved.id, undefined, session, headers);
    const html = await page.text();
    assert.equal(page.status, 200, "Library page must render");
    for (const label of ["Not in trash", "Paused", "Not paused", "In trash"]) assert(html.includes(">" + label + "</option>"), label + ": " + html.match(/<select name="state"[\s\S]*?<\/select>/)?.[0]);
    for (const state of ["Paused", "Scheduled", "Expired", "Visit limit reached"]) assert(html.includes(state));
    const workspaceResponse = await request("POST", "/api/workspaces", { name: prefix }, session);
    assert.equal(workspaceResponse.status, 201);
    const workspace = await workspaceResponse.json();
    workspaceId = workspace.id;
    assert.equal((await request("POST", "/api/workspaces/" + workspace.id + "/shares", { link_id: ids.Paused }, session)).status, 204);
    const workspaceHTML = await (await request("GET", "/settings/workspaces/" + workspace.id + "?state=active", undefined, session, headers)).text();
    assert(workspaceHTML.includes('value="active" selected>Not in trash</option>'));
    assert(workspaceHTML.includes('value="trash" >In trash</option>'));
    assert(workspaceHTML.includes("Paused"));
    assert.equal((await (await request("GET", "/api/workspaces/" + workspace.id + "?state=active", undefined, session)).json()).total, 1);

    const post = body => request("POST", "/settings/library", { operation: "bulk", action: "pause", ids: ids.Active,
      return_to: "/settings/library?state=active&q=" + prefix, ...body }, session, { ...headers, Origin: origin });
    const result = await post({}); assert.equal(result.status, 303);
    const cookie = result.headers.getSetCookie().find(value => value.startsWith("kutt_library_notice="));
    assert(cookie.includes("HttpOnly") && cookie.includes("SameSite=Strict") && cookie.includes("Path=/settings/library"));
    assert(!result.headers.get("location").includes("notice"), "No receipts in URLs/history");
    const noticeCookie = cookie.split(";")[0];
    const withCookie = async (value = noticeCookie, token = session) => request("GET", result.headers.get("location"), undefined, undefined,
      { ...headers, Cookie: "token=" + token + "; " + value });
    const rendered = await withCookie();
    assert((await rendered.text()).includes('role="status" tabindex="-1">Pause applied to 1 selected link.'));
    assert(rendered.headers.getSetCookie().some(value => value.startsWith("kutt_library_notice=;") && value.includes("Expires=")), "Receipt clears after display");
    assert(!(await (await request("GET", result.headers.get("location"), undefined, session, headers)).text()).includes("Pause applied to"));
    assert(!(await (await withCookie(noticeCookie.slice(0, -1) + (noticeCookie.endsWith("0") ? "1" : "0"))).text()).includes("Pause applied to"));

    const signedCookie = payload => {
      const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
      return "kutt_library_notice=" + data + "." + createHmac("sha256", env.JWT_SECRET).update("library-notice-v1\0" + data).digest("hex");
    };
    const receipt = { user: owner.id, action: "pause", affected: 1, expires: Date.now() + 30000 };
    for (const override of [{ user: -1 }, { expires: now - 1 }, { action: "constructor" }, { affected: 101 }]) {
      assert(!(await (await withCookie(signedCookie({ ...receipt, ...override }))).text()).includes("Pause applied to"));
    }
    const failed = await post({ ids: randomUUID() }); assert.equal(failed.status, 404);
    assert(!(await failed.text()).includes("Pause applied to"));
    assert(!failed.headers.getSetCookie().some(value => /^kutt_library_notice=[^;]/.test(value)));
    const password = randomBytes(32).toString("hex"), email = prefix + "@example.invalid";
    assert.equal((await request("POST", "/api/users/admin", { email, password, verified: true }, session)).status, 201);
    const other = (await (await request("POST", "/api/auth/login", { email, password })).json()).token;
    assert(other);
    assert(!(await (await withCookie(noticeCookie, other)).text()).includes("Pause applied to"));
    console.log("PASS: lifecycle labels preserve active/paused/unpaused/trash and saved filters; committed counts, PRG, bounded user-bound receipts, tamper/expiry/failure privacy");
  } finally {
    try {
      if (workspaceId) assert.equal((await request("DELETE", "/api/workspaces/" + workspaceId, { confirm: workspaceId }, session)).status, 204);
    } finally { db.close(); }
  }
};
