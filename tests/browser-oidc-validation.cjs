const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const origin = process.env.KUTT_TEST_URL, provider = process.env.KUTT_TEST_PROVIDER_URL;
  const evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(process.env.KUTT_BROWSER_DISPOSABLE === "1" && evidence);
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert.equal(new URL(provider).hostname, "127.0.0.1");
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready);
    assert.equal((await context.request.post(origin + "/api/auth/create-admin", {
      headers: { Accept: "application/json" }, data: { email: "oidc-validation@example.invalid", password: randomBytes(32).toString("hex") }
    })).status(), 201, "Refuse initialized fixtures");
    const page = await context.newPage(), errors = [], consoleErrors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && !/Failed to load resource: the server responded with a status of (503|401)/.test(message.text())) consoleErrors.push(message.text());
    });
    const check = async (text, filename) => {
      await page.getByRole("main").waitFor();
      const error = page.getByRole("alert");
      assert.equal((await error.innerText()).trim(), text);
      await page.waitForFunction(() => document.querySelector("p.error[role=alert]") === document.activeElement);
      assert.equal(await page.locator('input[type="password"]').count(), 0);
      assert(!(await context.cookies(origin)).some(cookie => cookie.name === "token" && cookie.value));
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: path.join(evidence, filename), fullPage: true });
      await page.keyboard.press("Shift+Tab");
      assert(await page.getByRole("link", { name: "Sign in with Test Provider" }).evaluate(node => node === document.activeElement));
    };
    await page.goto(origin + "/login");
    await page.getByRole("link", { name: "Sign in with Test Provider" }).click();
    await check("OIDC provider unavailable. Try signing in again shortly.", "oidc-outage-mobile.png");
    assert.equal((await context.request.post(provider + "/fixture-ready")).status(), 204);
    // Production discovery has a ten-second failed-provider backoff; preserve it.
    await new Promise(resolve => setTimeout(resolve, 10200));
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.getByRole("link", { name: "Sign in with Test Provider" }).click();
      await check("OIDC authentication failed.", "oidc-cancel-" + width + ".png");
    }
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    console.log("PASS: SSO-only outage alert/focus at 390px, discovery retry without restart, valid-state cancellation at 390/1440px, keyboard retry, no password fallback or authenticated cookie");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
