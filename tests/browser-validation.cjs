const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, mkdtempSync } = require("node:fs");
const path = require("node:path"), { tmpdir } = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const origin = process.env.KUTT_TEST_URL;
  assert(process.env.KUTT_BROWSER_DISPOSABLE === "1" && new URL(origin).hostname === "127.0.0.1");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-validation-"));
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const context = await browser.newContext();
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Disposable fixture must become ready before bootstrap");
    const account = { email: "validation@example.invalid", password: randomBytes(32).toString("hex") };
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", { data: account, headers: { Accept: "application/json" } });
    assert.equal(bootstrap.status(), 201, "Refuse initialized fixtures");
    await context.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    page = await context.newPage();
    const errors = [], consoleErrors = [];
    let injectedFault = false;
    const observe = page => {
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        const expected = injectedFault && /503 \(Service Unavailable\)|net::ERR_FAILED|^htmx:(responseError|sendError|afterRequest)$|Response Status Error Code 503/.test(message.text());
        if (message.type() === "error" && !expected) consoleErrors.push(message.text());
      });
    };
    observe(page);
    const invalid = async (field, message) => {
      await page.waitForFunction(({ selector }) => document.querySelector(selector)?.getAttribute("aria-invalid") === "true", { selector: field });
      await page.waitForFunction(selector => document.querySelector(selector) === document.activeElement, field);
      const state = await page.locator(field).evaluate(node => ({ focused: node === document.activeElement,
        messages: node.getAttribute("aria-describedby").split(" ").map(id => ({ text: document.getElementById(id)?.textContent, role: document.getElementById(id)?.getAttribute("role") })) }));
      assert(state.focused, "Focus the invalid field");
      assert(state.messages.some(error => error.text.includes(message) && error.role === "alert"));
      await page.waitForLoadState("networkidle");
    };
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin);
      await page.getByRole("textbox", { name: "Destination URL", exact: true }).fill("not a url");
      await page.getByRole("button", { name: "Shorten link", exact: true }).click();
      await invalid("#target", "URL is not valid");
      assert.equal(await page.locator("#target").inputValue(), "not a url");
      await page.screenshot({ path: path.join(evidence, `invalid-target-${width}.png`), fullPage: true });
      await page.locator("#target").fill("https://example.invalid/valid");
      assert.equal(await page.locator("#target").getAttribute("aria-invalid"), null);
      assert.equal(await page.locator("#shortener-form p.error:visible").count(), 0, "Stale field error is visually hidden too");
      await page.getByRole("checkbox", { name: "Show advanced options" }).check();
      await page.getByRole("textbox", { name: "Custom address", exact: true }).fill("api");
      await page.getByRole("button", { name: "Shorten link", exact: true }).click();
      await invalid("#customurl", "");
      await page.locator("#customurl").fill("validation-" + width);
      for (const [name, date] of [["starts_at", "2080-03-11"], ["ends_at", "2080-03-10"]]) {
        await page.locator(`#${name}-display`).click();
        await page.locator(`#${name}-picker [type=date]`).fill(date);
        await page.locator(`#${name}-picker [type=time]`).fill("12:34:56");
        await page.locator(`#${name}-picker [data-date-time-apply]`).click();
      }
      await page.getByRole("button", { name: "Shorten link", exact: true }).click();
      await invalid("#ends_at-display", "End must be after start");
      for (const name of ["starts_at", "ends_at"]) {
        await page.locator(`#${name}-display`).click();
        await page.locator(`#${name}-picker [data-date-time-clear]`).click();
      }
      await page.getByRole("button", { name: "Shorten link", exact: true }).click();
      await page.locator("#shorturl .link button").filter({ hasText: "validation-" + width }).waitFor();
      assert.equal(await page.locator("#shortener-form [aria-invalid=true]").count(), 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.goto(origin + "/settings");
    await page.evaluate(() => {
      window.validationEvents = [];
      for (const type of ["htmx:beforeRequest", "htmx:afterSwap", "htmx:afterRequest", "htmx:responseError"]) {
        document.addEventListener(type, event => window.validationEvents.push({ type, target: event.detail.elt?.id,
          status: event.detail.xhr?.status, reswap: event.detail.xhr?.getResponseHeader("HX-Reswap"),
          form: !!document.getElementById("add-domain"), errors: [...document.querySelectorAll("#add-domain p.error")].map(node => node.textContent) }));
      }
    });
    const loadFailure = route => route.fulfill({ status: 503, contentType: "text/html", body: "<h1>WAF unavailable</h1>" });
    await page.route("**/add-domain-form", loadFailure);
    injectedFault = true;
    await page.locator(".show-domain-form").click();
    await page.getByText("Could not load the domain form. Try again.", { exact: true }).waitFor();
    assert(await page.locator(".show-domain-form").isVisible());
    await page.waitForLoadState("networkidle");
    injectedFault = false;
    await page.unroute("**/add-domain-form", loadFailure);
    await page.locator(".show-domain-form").click();
    await page.locator("#address").fill("not a domain");
    await page.locator("#add-domain button[type=submit]").click();
    try { await invalid("#address", ""); }
    catch (error) { console.log("Domain validation events", await page.evaluate(() => window.validationEvents)); throw error; }
    await page.locator("#address").fill("validation.example.invalid");
    const reject = route => route.fulfill({ status: 503, contentType: "text/html", body: "<h1>WAF unavailable</h1>" });
    await page.route("**/api/domains", reject);
    injectedFault = true;
    await page.locator("#add-domain button[type=submit]").click();
    await page.locator("#add-domain [data-request-error]").waitFor();
    assert.equal(await page.locator("#address").inputValue(), "validation.example.invalid");
    assert(await page.locator("#add-domain [data-request-error]").evaluate(node => node === document.activeElement));
    assert.equal(await page.getByText("Domain is not valid.", { exact: true }).isVisible(), false);
    await page.waitForLoadState("networkidle");
    injectedFault = false;
    await page.screenshot({ path: path.join(evidence, "domain-waf-failure.png"), fullPage: true });
    await page.unroute("**/api/domains", reject);
    await page.locator("#add-domain button[type=submit]").click();
    const verify = page.locator("#add-domain").getByRole("button", { name: "Verify ownership", exact: true });
    await verify.waitFor();
    assert.equal(await page.locator("#address").inputValue(), "validation.example.invalid");
    await verify.click();
    await page.locator("#add-domain").waitFor({ state: "detached" });
    await page.getByText("validation.example.invalid", { exact: true }).first().waitFor();
    // A slow response from one form must not take focus from another draft.
    await page.locator("#currentpassword").fill("wrong-password");
    await page.locator("#newpassword").fill("synthetic-not-applied");
    let release, started;
    const gate = new Promise(resolve => { release = resolve; });
    const intercepted = new Promise(resolve => { started = resolve; });
    const delayed = async route => { started(); await gate; await route.continue(); };
    await page.route("**/api/auth/change-password", delayed);
    await page.locator("#change-password button[type=submit]").click();
    await intercepted;
    const other = page.locator('#tokens-wrapper input[name="name"]');
    await other.fill("keep this unrelated draft");
    release();
    await page.locator("#currentpassword[aria-invalid=true]").waitFor();
    await page.waitForLoadState("networkidle");
    assert(await other.evaluate(node => node === document.activeElement));
    assert.equal(await other.inputValue(), "keep this unrelated draft");
    assert.equal(await page.locator("#currentpassword").inputValue(), "wrong-password");
    await page.unroute("**/api/auth/change-password", delayed);

    // Existing descriptions survive error attachment and subsequent correction.
    await page.locator("#newpassword").evaluate(node => {
      const hint = document.createElement("p"); hint.id = "validation-existing-hint"; hint.textContent = "Existing hint";
      node.closest("section").prepend(hint); node.setAttribute("aria-describedby", hint.id);
    });
    await page.locator("#newpassword").fill("short");
    await page.locator("#change-password button[type=submit]").click();
    await invalid("#newpassword", "Password");
    assert((await page.locator("#newpassword").getAttribute("aria-describedby")).includes("validation-existing-hint"));
    await page.locator("#newpassword").fill("synthetic-not-applied");
    assert.equal(await page.locator("#newpassword").getAttribute("aria-describedby"), "validation-existing-hint");
    const offline = route => route.abort("failed");
    await page.route("**/api/auth/change-password", offline);
    injectedFault = true;
    await page.locator("#change-password button[type=submit]").click();
    await page.locator("#change-password [data-request-error]").waitFor();
    assert.equal(await page.locator("#newpassword").inputValue(), "synthetic-not-applied");
    await page.waitForLoadState("networkidle");
    injectedFault = false;
    await page.unroute("**/api/auth/change-password", offline);
    await page.goto(origin + "/settings/retention");
    await page.getByText("Settings loaded", { exact: true }).waitFor();
    await page.getByLabel("Delete expired analytics", { exact: true }).check();
    await page.getByLabel("Retention days", { exact: true }).fill("30");
    await page.getByRole("button", { name: "Preview changes", exact: true }).click();
    await page.getByText("Preview ready", { exact: true }).waitFor();
    await page.getByLabel("Permanently delete expired analytics", { exact: true }).check();
    await page.getByLabel("Retention days", { exact: true }).fill("31");
    assert(await page.locator("#retention-preview").isHidden());
    assert.equal(await page.locator("#retention-ack").isChecked(), false);
    assert.equal(await page.locator("#privacy-status").textContent(), "Draft changed. Preview again before applying.");
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await page.getByText("Settings loaded", { exact: true }).waitFor();
    assert(await page.locator("#retention-preview").isHidden());
    assert.equal((await (await context.request.get(origin + "/api/analytics/retention", { headers: { Accept: "application/json" } })).json()).days, 0);

    await page.goto(origin + "/admin");
    await page.waitForLoadState("networkidle");
    await page.getByRole("tab", { name: "Domains", exact: true }).click();
    await page.getByRole("button", { name: "Add domain", exact: true }).click();
    await page.locator("#add-domain-address").fill("not a domain");
    await page.locator("#add-domain-form button[type=submit]").click();
    await invalid("#add-domain-address", "Domain");
    assert.equal(await page.locator("#add-domain-address").inputValue(), "not a domain");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("dialog[open]").count(), 0);
    const list = await (await context.request.get(origin + "/api/links", { headers: { Accept: "application/json" } })).json();
    const edited = list.data.find(row => row.address === "validation-320");
    for (const route of ["/", "/admin"]) {
      await page.goto(origin + route);
      await page.locator("#tr-" + edited.id + " button.edit").click();
      const selector = "#edit-target-" + edited.id;
      await page.locator(selector).fill("not a url");
      const description = "keep independent description for " + route;
      await page.locator("#edit-description-" + edited.id).fill(description);
      await page.locator("#edit-submit-" + edited.id).click();
      await invalid(selector, "URL is not valid");
      assert.equal(await page.locator("#edit-description-" + edited.id).inputValue(), description);
      await page.locator(selector).fill(edited.target);
      assert.equal(await page.locator(selector).getAttribute("aria-invalid"), null);
      await page.locator("#edit-submit-" + edited.id).click();
      await page.locator("#edit-form-" + edited.id + " p.success").waitFor();
    }

    const protectedLink = await context.request.post(origin + "/api/links", { headers: { Accept: "application/json" },
      data: { customurl: "protected-validation", target: "https://example.invalid/protected-validation", password: "synthetic-password" } });
    assert.equal(protectedLink.status(), 201);
    const signedOut = await browser.newContext({ viewport: { width: 390, height: 844 } });
    page = await signedOut.newPage(); observe(page);
    await page.route("https://example.invalid/protected-validation", route => route.fulfill({ contentType: "text/plain", body: "Synthetic destination" }));
    await page.goto(origin + "/protected-validation");
    await page.locator("#protected-link-password").fill("wrong");
    await page.getByRole("button", { name: "Unlock & Go", exact: true }).click();
    await invalid("#protected-link-password", "");
    await page.locator("#protected-link-password").fill("synthetic-password");
    assert.equal(await page.locator("#report-form p.error:visible").count(), 0);
    await page.getByRole("button", { name: "Unlock & Go", exact: true }).click();
    await page.waitForURL("https://example.invalid/protected-validation");
    await page.goto(origin + "/login");
    assert.equal(await page.getByRole("main").count(), 1);
    await page.locator("#email").fill(account.email);
    await page.locator("#password").fill("wrong");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await invalid("#password", "Password length");
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.locator("#login-signup p.error[role=alert]").waitFor();
    await page.waitForFunction(() => document.querySelector("#login-signup p.error[role=alert]") === document.activeElement);
    assert.equal(await page.locator("#email").inputValue(), account.email);
    await page.locator("#password").fill(account.password);
    assert.equal(await page.locator("#login-signup p.error:visible").count(), 0);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForURL(origin + "/");
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    console.log("PASS: retained target/alias/expiry errors, field associations/focus and correction at 1440/390/320; inline domain WAF failure draft/retry, delayed cross-form focus, existing hints, offline draft, retention preview invalidation without deletion, admin/owner validation, protected password and local login correction");
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
