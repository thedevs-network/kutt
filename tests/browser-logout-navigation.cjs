const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(origin && new URL(origin).hostname === "127.0.0.1" && evidence);
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(), page = await context.newPage();
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Disposable fixture did not become ready");
    const account = { email: "logout-ui@example.invalid", password: randomBytes(32).toString("hex") };
    const headers = { Accept: "application/json" };
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", { data: account, headers });
    assert.equal(bootstrap.status(), 201, "Refuse initialized instances");
    const errors = [], traces = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.setDefaultTimeout(15000);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const flow of ["logout", "revoked-page", "revoked-htmx"]) {
        const login = await context.request.post(origin + "/api/auth/login", { data: account, headers });
        assert.equal(login.status(), 200);
        const token = (await login.json()).token;
        await context.addCookies([{ name: "token", value: token, url: origin }]);
        await page.goto(origin + "/");
        await page.locator("#main-table-wrapper tbody").waitFor();
        await page.waitForLoadState("networkidle");
        if (flow === "logout") {
          await page.getByRole("link", { name: "Log out", exact: true }).click();
        } else {
          const revoked = await context.request.post(origin + "/api/auth/revoke-sessions", { data: {}, headers });
          assert.equal(revoked.status(), 204);
          // Simulate another open document retaining the now-revoked cookie.
          await context.addCookies([{ name: "token", value: token, url: origin }]);
          if (flow === "revoked-page") await page.goto(origin + "/settings/integrations");
          else await page.getByLabel("Search links", { exact: true }).pressSequentially("expired");
        }
        // Wait for the final login form, not networkidle on the delayed logout page.
        await page.getByLabel("Email address:", { exact: true }).waitFor();
        await page.waitForLoadState("networkidle");
        assert.equal((await context.request.get(origin + "/api/links", { headers })).status(), 401);
        assert.deepEqual(errors, [], `${flow}/${width}: no duplicate scripts or browser errors`);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.screenshot({ path: path.join(evidence, `${flow}-${width}.png`), fullPage: true });
        // Recover through the rendered form and prove the management page is usable.
        await page.getByLabel("Email address:", { exact: true }).fill(account.email);
        await page.getByLabel("Password:", { exact: true }).fill(account.password);
        await page.getByRole("button", { name: "Log in", exact: true }).click();
        await page.locator("#main-table-wrapper tbody").waitFor();
        await page.waitForLoadState("networkidle");
        assert.equal(await page.locator("#main-table-wrapper table").count(), 1);
        assert.deepEqual(errors, []);
        traces.push({ flow, width, deniedAfterLogout: true, recovered: true, browserErrors: 0 });
      }
    }
    writeFileSync(path.join(evidence, "results.json"), JSON.stringify(traces, null, 2));
    console.log("PASS: logout and revoked page/HTMX session recovery, desktop/mobile/compact, final login rendering and no duplicate scripts");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
