const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

module.exports = async ({ root, request, session }) => {
  const hbs = require("hbs").create().handlebars;
  require("../server/i18n").register(hbs);
  for (const icon of ["cog", "shield", "check"]) hbs.registerPartial("icons/" + icon, "<svg></svg>");
  const render = hbs.compile(readFileSync(path.join(root, "server/views/partials/header.hbs"), "utf8"));
  for (const role of ["anonymous", "user", "admin"]) {
    const html = render({ site_name: '<script>alert("brand")</script>', user: role !== "anonymous", isAdmin: role === "admin", login_label: "Log in", login_title: "Log in" });
    assert(html.includes('class="site-header"')); assert(html.includes('aria-label="Account"'));
    assert(html.includes('<span class="site-name">&lt;script&gt;')); assert(!html.includes('<script>'));
    assert.equal(html.includes('href="/admin"'), role === "admin");
    assert.equal(html.includes('href="/settings"'), role !== "anonymous");
    assert.equal(html.includes('href="/logout"'), role !== "anonymous");
    assert.equal(html.includes('href="/login"'), role === "anonymous");
  }
  assert(!render({ site_name: "Kutt", login_disabled: true }).includes('href="/login"'));
  const response = await request("GET", "/settings/security", undefined, session, { Accept: "text/html" });
  assert.equal(response.status, 200); const html = await response.text();
  assert(html.includes('class="site-header"')); assert(html.includes('aria-label="Account"'));
  assert(html.includes('<header class="archive-heading"><h1>Account security</h1>'));
  console.log("PASS: scoped site header, escaped brand, anonymous/user/admin and login-disabled action visibility, named navigation and real authenticated page");
};
