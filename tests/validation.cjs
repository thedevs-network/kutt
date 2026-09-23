const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { Script } = require("node:vm");

module.exports = async ({ request, session, account }) => {
  const html = { Accept: "text/html", "HX-Request": "true" };
  const home = await (await request("GET", "/", undefined, session, html)).text();
  assert(home.includes('/scripts/validation.js'));
  // The API harness has an empty cwd to avoid real .env files; rendered tests
  // exercise actual static serving from the application root.
  new Script(readFileSync("static/scripts/validation.js", "utf8"));
  assert(readFileSync("static/css/styles.css", "utf8").includes("p.error[hidden]"));
  const domainView = readFileSync("server/views/partials/settings/domain/index.hbs", "utf8");
  const uiEvents = readFileSync("static/scripts/ui-events.js", "utf8");
  assert(domainView.includes("data-ui-domain-load"));
  assert(uiEvents.includes('event.detail.successful && document.getElementById("add-domain")'));
  assert(domainView.includes('id="domain-load-error" class="error" role="alert" hidden'));
  const badLink = { target: "not a url" };
  assert.equal((await request("POST", "/api/links", badLink, session)).status, 400);
  const invalidLink = await request("POST", "/api/links", badLink, session, html);
  assert.equal(invalidLink.status, 200, "Preserve legacy HTMX validation status");
  assert((await invalidLink.text()).includes('data-error-field="target"'));

  const invalidDomain = await request("POST", "/api/domains", { address: "not a domain" }, session, html);
  assert.equal(invalidDomain.status, 200);
  assert.equal(invalidDomain.headers.get("HX-Reswap"), null, "Validation must not signal insertion success");
  const domainForm = await invalidDomain.text();
  assert(domainForm.includes('id="add-domain"') && domainForm.includes("Domain is not valid."));
  assert(domainForm.includes("data-ui-domain-save"));
  assert(uiEvents.includes('event.detail.successful && event.detail.xhr.getResponseHeader("HX-Reswap") === "none"'));
  assert.equal((await request("POST", "/api/domains", { address: "not a domain" }, session)).status, 400);
  assert.equal((await request("POST", "/api/domains", { address: "not a domain" })).status, 401);

  const loginPage = await (await request("GET", "/login", undefined, undefined, { Accept: "text/html" })).text();
  assert(loginPage.includes("<main>") && loginPage.includes("</main>"));
  const badLogin = { email: account.email, password: "wrong-password" };
  assert.equal((await request("POST", "/api/auth/login", badLogin)).status, 401);
  const rejectedLogin = await request("POST", "/api/auth/login", badLogin, undefined, html);
  assert.equal(rejectedLogin.status, 200);
  assert(!rejectedLogin.headers.getSetCookie().some(value => value.startsWith("token=")));
  const loginForm = await rejectedLogin.text();
  assert(loginForm.includes("Login credentials are wrong."));
  assert(!loginForm.includes('value="wrong-password"'), "Never echo credentials into HTML");
  const passwordForm = await request("POST", "/api/auth/change-password",
    { currentpassword: "wrong-password", newpassword: "long-but-not-applied" }, session, html);
  assert.equal(passwordForm.status, 200);
  const passwordHTML = await passwordForm.text();
  assert(passwordHTML.includes("Current password is not correct."));
  assert(!passwordHTML.includes('value="wrong-password"') && !passwordHTML.includes('value="long-but-not-applied"'));

  const response = await request("POST", "/api/links", { customurl: "validation-" + randomUUID(),
    target: "https://example.invalid/validation", password: "synthetic-password" }, session);
  assert.equal(response.status, 201);
  const link = await response.json();
  try {
    const denied = await request("POST", "/api/links/" + link.id + "/protected", { password: "wrong-password" }, undefined, html);
    assert.equal(denied.status, 200);
    const page = await denied.text();
    assert(page.includes('data-error-field="password"'));
    assert(!page.includes('value="wrong-password"'));
    assert.equal((await request("GET", "/api/users/admin")).status, 401);
  } finally { assert.equal((await request("DELETE", "/api/links/" + link.id, undefined, session)).status, 200); }
  console.log("PASS: validation script syntax, HTML field contracts, preserved JSON/HTMX status, domain insertion signal, auth boundaries, credential non-echo and protected validation");
};
