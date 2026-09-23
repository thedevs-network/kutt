const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { runInNewContext } = require("node:vm");
const Database = require("better-sqlite3");

function draftLocals(root) {
  const module = { exports: {} };
  runInNewContext(readFileSync(path.join(root, "server/handlers/locals.handler.js"), "utf8"), {
    module, require: () => ({})
  });
  const run = (body, isHTML = true) => {
    const req = { body: { ...body }, isHTML }, res = { locals: {} };
    let called = false;
    module.exports.createLink(req, res, () => { called = true; });
    assert(called);
    return { req, locals: res.locals };
  };
  const input = { starts_at: "2080-02-29T12:34:56", ends_at: "2080-03-01T01:02:03", expire_in: "2 days",
    fetched_domain: { id: 42 }, password: "do-not-echo", target: "https://192.0.2.1/" };
  const { req, locals } = run(input);
  assert.equal(locals.starts_at_input, input.starts_at, "Creation must retain the exact submitted UTC start draft");
  assert.equal(locals.ends_at_input, input.ends_at, "Creation must retain the exact submitted UTC end draft");
  assert.equal(locals.show_advanced, true, "A submitted schedule must remain visible after validation fails");
  assert.equal(req.body.fetched_domain, undefined);
  assert.equal(req.linkExpiryInput, "2 days");
  assert.equal(locals.password, undefined);
  assert.equal(locals.target, undefined, "Do not broaden this into arbitrary request-to-locals reflection");
  for (const value of [undefined, null, [], {}, true, 123]) {
    const result = run({ starts_at: value, ends_at: value }).locals;
    assert.equal(result.starts_at_input, "");
    assert.equal(result.ends_at_input, "");
  }
  assert.equal(run({ starts_at: "", ends_at: "" }).locals.show_advanced, false);
  assert.equal(run({ starts_at: "", ends_at: "", show_advanced: "on" }).locals.show_advanced, true);
  assert.equal(run({ starts_at: "invalid date" }).locals.starts_at_input, "invalid date");
  assert.equal(run(input, false).locals.starts_at_input, undefined, "JSON creation does not need HTML draft locals");
}

function lifecycleFields(root) {
  class CustomError extends Error {
    constructor(message, statusCode) { super(message); this.statusCode = statusCode; }
  }
  const module = { exports: {} };
  runInNewContext(readFileSync(path.join(root, "server/link-lifecycle.js"), "utf8"), {
    module, require: name => name === "./utils" ? { CustomError } : { t: key => key }
  });
  for (const [body, field] of [
    [{ starts_at: "not-a-date" }, "starts_at"], [{ ends_at: "2081-02-29T12:00:00" }, "ends_at"],
    [{ starts_at: "2080-01-01T00:00:01", ends_at: "2080-01-01T00:00:01" }, "ends_at"]
  ]) {
    assert.throws(() => module.exports.parse(body, {}, true), error => {
      assert.equal(error.statusCode, 400);
      assert.equal(error.field, field, "Schedule errors must identify their field without changing their status");
      return true;
    });
  }
  assert.throws(() => module.exports.parse({ max_visits: 0 }), error => error.statusCode === 400 && error.field === undefined);
}

module.exports = async ({ request, session, database, account, root, url }) => {
  draftLocals(root);
  lifecycleFields(root);
  const db = new Database(database);
  const target = "https://192.0.2.1/schedule-creation";
  const start = "2080-02-29T12:34:56", end = "2080-03-01T01:02:03";
  const input = extra => ({ target, customurl: "schedule-" + randomUUID(), ...extra });
  const row = address => db.prepare("SELECT * FROM links WHERE address=? AND domain_id IS NULL").get(address);
  const checked = async (promise, status) => {
    const response = await promise;
    assert.equal(response.status, status, await response.clone().text());
    return response;
  };
  const form = async (body, headers = {}, token = session) => {
    const response = await fetch(url + "/api/links", {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html", Origin: url,
        ...(token && { Cookie: "token=" + token }), ...headers },
      body: new URLSearchParams(body)
    });
    const page = await response.text();
    assert.equal(response.status, 200, page);
    return { response, page };
  };
  const value = (page, name) => {
    const tag = page.match(new RegExp(`<input\\b[^>]*\\bname="${name}"[^>]*>`));
    assert(tag, `Missing creation input ${name}`);
    return tag[0].match(/\bvalue="([^"]*)"/)?.[1] || "";
  };
  const retained = (page, body) => {
    assert.equal(value(page, "starts_at"), body.starts_at);
    assert.equal(value(page, "ends_at"), body.ends_at);
    const advanced = page.match(/<section\b[^>]*id="advanced-options"[^>]*>/);
    assert(advanced && !/\bhidden\b/.test(advanced[0]), "Schedule draft must not disappear into collapsed advanced options");
  };
  try {
    const owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
    const initial = await checked(request("GET", "/", undefined, session, { Accept: "text/html" }), 200);
    assert.equal(value(await initial.text(), "starts_at"), "");
    for (const extra of [
      { starts_at: "", ends_at: "" },
      { starts_at: "2020-01-01T01:02:03", ends_at: "" },
      { starts_at: "", ends_at: end },
      { starts_at: start, ends_at: end },
      { starts_at: "", ends_at: "2020-01-01T01:02:03" }
    ]) {
      const body = input(extra);
      const { response } = await form(body);
      assert.equal(response.headers.get("HX-Trigger"), "reloadMainTable");
      const saved = row(body.customurl);
      assert(saved);
      assert.equal(saved.user_id, owner);
      assert.equal(saved.starts_at, extra.starts_at ? Date.parse(extra.starts_at + "Z") : null);
      assert.equal(saved.ends_at, extra.ends_at ? Date.parse(extra.ends_at + "Z") : null);
      assert.equal(saved.expire_in, null);
      const unavailable = saved.starts_at > Date.now() || saved.ends_at !== null && saved.ends_at <= Date.now();
      for (const method of ["GET", "HEAD"]) {
        await checked(request(method, "/" + saved.address), unavailable ? 410 : 302);
      }
    }

    for (const [extra, message, field] of [
      [{ starts_at: "2081-02-29T12:34:56" }, "starts_at is not a valid date", "starts_at"],
      [{ ends_at: "2080-02-30T12:34:56" }, "ends_at is not a valid date", "ends_at"],
      [{ starts_at: "not-a-date" }, "starts_at must be an ISO 8601 timestamp", "starts_at"],
      [{ starts_at: "2080-01-01T12:60:00" }, "starts_at is not a valid date", "starts_at"],
      [{ ends_at: start }, "End must be after start", "ends_at"],
      [{ ends_at: "2080-02-29T12:34:55" }, "End must be after start", "ends_at"],
      [{ target: "not a url" }, "URL is not valid"],
      [{ customurl: "bad alias" }, "Custom URL is not valid"]
    ]) {
      const body = input({ starts_at: start, ends_at: end, ...extra });
      const { response, page } = await form(body, { "HX-Request": "true" });
      assert(page.includes(message), message);
      if (field) assert(page.includes(`data-error-field="${field}"`), `Associate the schedule error with ${field}`);
      retained(page, body);
      assert.equal(row(body.customurl), undefined, "Invalid forms must not insert a link");
      assert.equal(response.headers.get("HX-Trigger"), null);
    }
    const original = input();
    await checked(request("POST", "/api/links", original, session), 201);
    const conflict = { ...original, starts_at: start, ends_at: end };
    const { page: conflictPage } = await form(conflict);
    retained(conflictPage, conflict);
    assert(conflictPage.includes("Custom URL is already in use"));
    assert.equal(row(original.customurl).starts_at, null);

    const hostile = input({ starts_at: '\"><script>alert(1)</script>', ends_at: end });
    const { page: hostilePage } = await form(hostile);
    assert(!hostilePage.includes(hostile.starts_at), "Submitted drafts must remain HTML-escaped");
    assert(hostilePage.includes("&lt;script&gt;"));
    assert.equal(row(hostile.customurl), undefined);
    for (const headers of [{ Origin: "https://attacker.invalid" }, { Origin: "null" }, { "Sec-Fetch-Site": "cross-site" }]) {
      const body = input({ starts_at: start, ends_at: end });
      const { page } = await form(body, headers);
      assert(page.includes("Invalid request origin"));
      assert.equal(row(body.customurl), undefined);
    }

    for (const api of ["/api/links", "/api/v2/links"]) {
      await checked(request("POST", api, input({ starts_at: start + "Z", ends_at: end + "Z" })), 401);
      for (const invalid of [
        { starts_at: start }, { ends_at: "" }, { starts_at: [] }, { ends_at: {} }, { starts_at: true },
        { starts_at: "2081-02-29T12:34:56Z" }, { ends_at: "2080-01-01T12:34:60Z" },
        { starts_at: end + "Z", ends_at: start + "Z" }, { starts_at: start + "Z", ends_at: start + "Z" }
      ]) {
        const body = input(invalid);
        const rejected = await checked(request("POST", api, body, session), 400);
        assert.deepEqual(Object.keys(await rejected.json()), ["error"], "Internal field metadata must not change the JSON error shape");
        assert.equal(row(body.customurl), undefined);
      }
      const scheduled = input({ starts_at: start + "Z", ends_at: end + "Z" });
      const headers = { "Idempotency-Key": randomUUID() };
      const created = await (await checked(request("POST", api, scheduled, session, headers), 201)).json();
      assert.equal(created.starts_at, start + ".000Z");
      assert.equal(created.ends_at, end + ".000Z");
      const replay = await checked(request("POST", api, scheduled, session, headers), 201);
      assert.equal(replay.headers.get("Idempotency-Replayed"), "true");
      assert.equal((await replay.json()).id, created.id);
      await checked(request("POST", api, { ...scheduled, ends_at: "2081-01-01T00:00:00Z" }, session, headers), 409);
      const offset = input({ starts_at: "2080-02-29T13:34:56+01:00", ends_at: null });
      const offsetLink = await (await checked(request("POST", api, offset, session), 201)).json();
      assert.equal(offsetLink.starts_at, start + ".000Z");
      assert.equal(offsetLink.ends_at, null);

      // Legacy relative expiry remains independent; a blank schedule cannot clear it.
      const before = Date.now();
      const legacy = input({ expire_in: "2 days", starts_at: null, ends_at: "2090-01-01T00:00:00Z" });
      await checked(request("POST", api, legacy, session), 201);
      const saved = row(legacy.customurl);
      const expiry = Date.parse(saved.expire_in.replace(" ", "T") + "Z");
      assert(expiry >= before + 172800000 - 1000 && expiry <= Date.now() + 172800000);
      assert.equal(saved.ends_at, Date.parse(legacy.ends_at));
      db.prepare("UPDATE links SET expire_in='2020-01-01 00:00:00' WHERE id=?").run(saved.id);
      await checked(request("GET", "/" + saved.address), 410);
      const legacyEnded = input({ expire_in: "2 days", ends_at: "2020-01-01T00:00:00Z" });
      await checked(request("POST", api, legacyEnded, session), 201);
      await checked(request("GET", "/" + legacyEnded.customurl), 410);
      await checked(request("POST", api, input({ expire_in: "not-a-duration" }), session), 400);
    }
    const legacyHTML = input({ starts_at: "", ends_at: "", expire_in: "2 days" });
    await form(legacyHTML);
    assert(row(legacyHTML.customurl).expire_in);
    assert.equal(row(legacyHTML.customurl).starts_at, null);
    assert.equal(row(legacyHTML.customurl).ends_at, null);

    const readToken = await (await checked(request("POST", "/api/tokens", { name: "Schedule read-only", scopes: ["links:read"] }, session), 201)).json();
    const writeToken = await (await checked(request("POST", "/api/tokens", { name: "Schedule create", scopes: ["links:create"], domain_scope: "default" }, session), 201)).json();
    const authorized = input({ starts_at: start + "Z", ends_at: end + "Z" });
    await checked(request("POST", "/api/links", authorized, undefined, { "X-API-Key": readToken.token }), 403);
    await checked(request("POST", "/api/links", authorized, undefined, { "X-API-Key": writeToken.token }), 201);
    const ownedDomain = "schedule-" + randomUUID() + ".example.invalid";
    const domainId = db.prepare("INSERT INTO domains (address, user_id, uuid) VALUES (?, ?, ?)").run(ownedDomain, owner, randomUUID()).lastInsertRowid;
    try {
      const denied = input({ starts_at: start + "Z", ends_at: end + "Z", domain: ownedDomain });
      await checked(request("POST", "/api/links", denied, undefined, { "X-API-Key": writeToken.token }), 403);
      assert.equal(row(denied.customurl), undefined);
    } finally { db.prepare("DELETE FROM domains WHERE id=?").run(domainId); }

    const simultaneous = input({ starts_at: start + "Z", ends_at: end + "Z" });
    const results = await Promise.all(Array.from({ length: 2 }, () => request("POST", "/api/links", simultaneous, session)));
    assert.deepEqual(results.map(response => response.status).sort(), [201, 400]);
    assert.equal(db.prepare("SELECT count(*) AS n FROM links WHERE address=?").get(simultaneous.customurl).n, 1);
    const saved = row(simultaneous.customurl);
    assert.equal(saved.starts_at, Date.parse(start + "Z"));
    assert.equal(saved.ends_at, Date.parse(end + "Z"));
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: creation UTC seconds/blanks, native/HTMX draft/errors, escaped values, API timezone/ranges, legacy expiry, idempotency, auth/CSRF/token scope and concurrent alias creation");
  } finally { db.close(); }
};
