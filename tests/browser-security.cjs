const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Use a fresh loopback-only instance");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-security-ui-"));
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const context = await browser.newContext();
    await assert.doesNotReject(async () => {
      for (let attempt = 0; attempt < 100; attempt++) {
        try { if ((await context.request.get(origin + "/api/health")).status() === 200) return; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error("Disposable instance did not become ready");
    });
    const account = { email: "browser-security@example.invalid", password: randomBytes(32).toString("hex") };
    const headers = { Accept: "application/json" };
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", { data: account, headers });
    assert.equal(bootstrap.status(), 201, "Refuse initialized instances");
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("dialog", dialog => dialog.accept());
    for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
      await page.setViewportSize({ width, height });
      const login = await context.request.post(origin + "/api/auth/login", { data: account, headers });
      assert.equal(login.status(), 200);
      const token = (await login.json()).token;
      await context.addCookies([{ name: "token", value: token, url: origin }]);
      await page.goto(origin + "/settings");
      await page.getByRole("link", { name: "Account security", exact: true }).click();
      await page.getByRole("heading", { name: "Account security", exact: true }).waitFor();
      await page.getByRole("heading", { name: "Authentication diagnostics", exact: true }).waitFor();
      await page.getByText("OIDC_DISABLED", { exact: true }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + " overflow");
      const button = page.getByRole("button", { name: "Sign out all sessions", exact: true });
      const bounds = await button.boundingBox();
      assert(bounds && bounds.width > 40 && bounds.x >= 0 && bounds.x + bounds.width <= width);
      await page.screenshot({ path: path.join(evidence, `security-${name}.png`), fullPage: true });
      const changed = page.waitForResponse(response => response.url().endsWith("/api/auth/revoke-sessions"));
      await button.click();
      assert.equal((await changed).status(), 200);
      await page.waitForURL(origin + "/login");
      const stale = await context.request.get(origin + "/api/auth/security", { headers: { ...headers, Cookie: "token=" + token } });
      assert.equal(stale.status(), 401, "Previously copied cookie must be invalidated");
      await page.screenshot({ path: path.join(evidence, `signed-out-${name}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: desktop/mobile account security, diagnostics, session revocation and re-login; ${evidence}`);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "security-failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
