const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origins = JSON.parse(process.env.KUTT_LOGIN_TEST_URLS);
  assert.deepEqual(Object.keys(origins).sort(), ["closed", "local", "registration", "sso"]);
  for (const origin of Object.values(origins)) assert.equal(new URL(origin).hostname, "127.0.0.1");
  const evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [mode, origin] of Object.entries(origins)) {
      const page = await browser.newPage(); const errors = [];
      const bootstrap = await page.request.post(origin + "/api/auth/create-admin", { data:
        { email: "login-copy@example.invalid", password: randomBytes(32).toString("hex") }, headers: { Accept: "application/json" } });
      assert.equal(bootstrap.status(), 201, "Refuse initialized fixtures");
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
        const response = await page.goto(origin + "/login");
        assert.equal(response.status(), 200);
        assert.equal(new URL(page.url()).pathname, "/login");
        assert.equal(await page.locator("main").count(), 1);
        const title = mode === "closed" ? "Login is closed" : mode === "registration" ? "Log in or sign up" : "Log in";
        assert((await page.title()).endsWith(" | " + title));
        const header = page.locator("header");
        if (mode === "closed") {
          assert.equal(await header.locator('a[href="/login"]').count(), 0);
          await page.getByRole("heading", { name: "Login is closed." }).waitFor();
        } else {
          const entry = header.getByRole("link", { name: mode === "registration" ? "Log in / Sign up" : "Log in", exact: true });
          await entry.focus(); assert(await entry.evaluate(el => el === document.activeElement));
          await entry.press("Enter"); await page.waitForLoadState("load");
          assert.equal(new URL(page.url()).pathname, "/login");
        }
        assert.equal(await page.getByRole("button", { name: "Sign up", exact: true }).count(), mode === "registration" ? 1 : 0);
        assert.equal(await page.locator('input[name="password"]').count(), ["local", "registration"].includes(mode) ? 1 : 0);
        assert.equal(await page.locator('a[href="/login/oidc"]').count(), mode === "sso" ? 1 : 0);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), mode + " overflow");
        await page.screenshot({ path: path.join(evidence, `${mode}-${width}.png`), fullPage: true });
      }
      assert.deepEqual(errors, [], mode + " browser errors");
      await page.close();
    }
    console.log("PASS: desktop/390/320 sign-in copy, title, keyboard header entry, registration/local/SSO/closed controls and no overflow or browser errors; " + evidence);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
