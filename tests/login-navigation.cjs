const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

module.exports = async ({ request, account, root }) => {
  const source = readFileSync(path.join(root, "server/handlers/auth.handler.js"), "utf8");
  const handler = source.slice(source.indexOf("function completeBrowserLogin("), source.indexOf("async function createAdminUser("));
  const context = vm.createContext({ utils: { setToken: (res, token) => { res.token = token; } } });
  vm.runInContext(handler, context);
  for (const htmx of [true, false]) {
    const res = { set(name, value) { this.header = [name, value]; return this; }, status(code) { this.code = code; return this; },
      end() { this.ended = true; }, redirect(code, location) { this.code = code; this.location = location; } };
    context.completeBrowserLogin({ get: () => htmx ? "true" : undefined }, res, "synthetic-only");
    assert.equal(res.token, "synthetic-only"); assert.equal(res.code, htmx ? 204 : 303);
    if (htmx) { assert.deepEqual(res.header, ["HX-Redirect", "/"]); assert(res.ended); }
    else assert.equal(res.location, "/");
  }
  assert.equal((source.match(/return completeBrowserLogin\(req, res, token\)/g) || []).length, 2, "Initial admin setup and login use the same safe navigation");
  for (const endpoint of ["/api/auth/login", "/api/v2/auth/login"]) {
    for (const htmx of [true, false]) {
      const result = await request("POST", endpoint, account, undefined, { Accept: "text/html", ...(htmx ? { "HX-Request": "true" } : {}) });
      assert.equal(result.status, htmx ? 204 : 303);
      assert.equal(result.headers.get(htmx ? "HX-Redirect" : "Location"), "/");
      assert(result.headers.getSetCookie().some(cookie => /^token=/.test(cookie) && /HttpOnly/i.test(cookie)));
      assert(!(await result.text()).includes("hx-target=\"body\""));
    }
    const json = await request("POST", endpoint, account); assert.equal(json.status, 200); assert.equal(typeof (await json.json()).token, "string");
    assert.equal(json.headers.get("HX-Redirect"), null);
    const denied = await request("POST", endpoint, account, undefined, { Accept: "text/html", "HX-Request": "true", Origin: "https://foreign.example.invalid", "Sec-Fetch-Site": "cross-site" });
    assert.equal(denied.status, 403); assert.equal(denied.headers.get("HX-Redirect"), null); assert.equal(denied.headers.getSetCookie().length, 0);
  }
  const invalid = await request("POST", "/api/auth/login", { ...account, password: "wrong-password" }, undefined, { Accept: "text/html", "HX-Request": "true" });
  assert.equal(invalid.status, 200); assert.equal(invalid.headers.get("HX-Redirect"), null); assert.equal(invalid.headers.getSetCookie().length, 0);
  assert((await invalid.text()).includes("Login credentials are wrong."));
  for (const htmx of [true, false]) {
    const result = await request("GET", "/logout", undefined, undefined,
      { Accept: "text/html", ...(htmx ? { "HX-Request": "true" } : {}) });
    assert.equal(result.status, htmx ? 204 : 303);
    assert.equal(result.headers.get(htmx ? "HX-Redirect" : "Location"), "/");
    assert.equal(result.headers.get("Cache-Control"), "no-store");
    assert(result.headers.getSetCookie().some(cookie => /^token=;/.test(cookie) && /expires=/i.test(cookie)));
    assert(!(await result.text()).includes("hx-target=\"body\""));
  }
  console.log("PASS: successful browser login/setup uses document navigation, HTMX and native HTML contracts, JSON compatibility, invalid-credential recovery and cross-site denial");
};
