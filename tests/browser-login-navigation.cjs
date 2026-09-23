const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(origin && new URL(origin).hostname === "127.0.0.1" && new URL(origin).protocol === "https:" && evidence);
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true }), traces = [];
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break; await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready);
    await context.exposeBinding("loginTrace", (_, record) => traces.push(record));
    await context.addInitScript(() => {
      const documentId = crypto.randomUUID(); let instance, count = 0;
      Object.defineProperty(window, "htmx", { configurable: true, get: () => instance, set: value => {
        instance = value; window.loginTrace({ kind: "library", documentId, instance: ++count });
      }});
      document.addEventListener("htmx:swapError", () => window.loginTrace({ kind: "swapError", documentId }));
    });
    const page = await context.newPage(), errors = [], consoleErrors = [], requests = [];
    page.setDefaultTimeout(15000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("request", request => { if (new URL(request.url()).pathname === "/api/links" && request.method() === "GET") requests.push(request); });
    const password = randomBytes(32).toString("hex"), admin = { email: "navigation-admin@example.invalid", password }, user = { email: "navigation-user@example.invalid", password };
    const call = async (method, route, data, expected = 200) => {
      const result = await context.request.fetch(origin + route, { method, data, headers: { Accept: "application/json" }, maxRedirects: 0 });
      assert.equal(result.status(), expected, route); return result.json();
    };
    const settle = async () => {
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => document.querySelector("#main-table-wrapper tbody") && !document.querySelector(".htmx-request,.htmx-swapping,.htmx-settling"));
    };
    const refreshTable = async action => {
      const response = page.waitForResponse(response => new URL(response.url()).pathname === "/api/links" && response.request().method() === "GET");
      await action(); await (await response).finished(); await settle();
    };
    await page.goto(origin + "/create-admin"); await page.getByRole("button", { name: "Create admin account", exact: true }).waitFor();
    await page.getByLabel("Email address:", { exact: true }).fill(admin.email); await page.getByLabel("Password:", { exact: true }).fill(password);
    const bootstrap = page.waitForResponse(response => response.url() === origin + "/api/auth/create-admin");
    requests.length = 0; await page.getByRole("button", { name: "Create admin account", exact: true }).click();
    assert.equal((await bootstrap).status(), 204); await page.waitForURL(origin + "/"); await settle(); assert.equal(requests.length, 1);
    await call("POST", "/api/users/admin", { ...user, verified: true }, 201);
    const logout = async () => {
      await page.locator(".main-wrapper > header").getByRole("link", { name: "Log out", exact: true }).click();
      await page.getByLabel("Email address:", { exact: true }).waitFor();
      await page.waitForLoadState("networkidle");
      assert.equal((await context.request.get(origin + "/api/links", { headers: { Accept: "application/json" } })).status(), 401);
    };
    await logout();
    let logins = 0;
    for (const account of [admin, user]) {
      const role = account === admin ? "admin" : "user";
      let primary;
      for (const populated of [false, true]) {
        for (const width of [1440, 390, 320]) {
          await page.setViewportSize({ width, height: 900 });
          if (populated) await page.route(origin + "/api/links*", async route => { await new Promise(resolve => setTimeout(resolve, 250)); await route.continue(); });
          await page.goto(origin + "/login");
          await page.getByLabel("Email address:", { exact: true }).fill(account.email);
          await page.getByLabel("Password:", { exact: true }).fill(password);
          const response = page.waitForResponse(response => response.url() === origin + "/api/auth/login");
          requests.length = 0;
          await page.getByRole("button", { name: "Log in", exact: true }).focus(); await page.keyboard.press("Enter");
          const result = await response; assert.equal(result.status(), 204); assert.equal(result.headers()["hx-redirect"], "/");
          await page.waitForURL(origin + "/"); await settle();
          assert.equal(requests.length, 1, `${role}/${width}/${populated} initializes once`); logins++;
          assert.equal(await page.locator("#main-table-wrapper table").count(), 1);
          assert.equal(await page.locator('#main-table-wrapper tbody tr[id^="tr-"]').count(), populated ? 10 : 0);
          if (populated) {
            await refreshTable(() => page.getByRole("button", { name: "Next page", exact: true }).first().click());
            assert.equal(await page.locator('#main-table-wrapper tbody tr[id^="tr-"]').count(), 2);
            await refreshTable(() => page.getByLabel("Search links", { exact: true }).pressSequentially(primary.address, { delay: 10 }));
            const row = page.locator("#tr-" + primary.id); await row.waitFor();
            await row.getByRole("button", { name: "Edit " + primary.address, exact: true }).click(); await settle();
            const editor = page.locator("#edit-form-" + primary.id); await editor.waitFor();
            await editor.locator('[name="description"]').fill("Navigation " + width);
            await editor.getByRole("button", { name: "Update", exact: true }).click(); await settle();
            assert((await row.textContent()).includes("Navigation " + width));
            await page.screenshot({ path: path.join(evidence, role + "-" + width + ".png"), animations: "disabled", fullPage: true });
          }
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          if (!populated && width === 320) {
            for (let i = 0; i < 12; i++) {
              const link = await call("POST", "/api/links", { target: "https://example.org/" + role + "/" + i, customurl: "navigation-" + role + "-" + i }, 201);
              if (i === 0) primary = link;
            }
          }
          await page.unroute(origin + "/api/links*"); await logout();
        }
      }
    }
    assert.equal(logins, 12); assert(traces.every(trace => trace.kind === "library" && trace.instance === 1));
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    writeFileSync(path.join(evidence, "initialization.json"), JSON.stringify(traces, null, 2));
    console.log("PASS: native admin setup and 12 HTTPS keyboard sign-ins, admin/user empty/populated desktop/mobile/compact, delayed table, exactly one initialization/request, search/pagination/inline save, logout boundary and no script/swap errors");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
