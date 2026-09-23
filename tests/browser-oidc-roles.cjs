const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, "127.0.0.1"); assert(evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true }); let page;
  const errors = [], external = []; let layouts = 0;
  try {
    for (const locale of ["en", "fr", "es"]) {
      const catalog = require("../locales/" + locale + ".json");
      const context = await browser.newContext({ locale: "en-US" });
      page = await context.newPage(); page.setDefaultTimeout(10000);
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      page.on("request", request => { if (new URL(request.url()).origin !== origin) external.push(request.url()); });
      await page.goto(origin + "/login");
      await page.locator("#site-language").selectOption(locale);
      const changed = page.waitForResponse(response => new URL(response.url()).pathname === "/language");
      await page.locator(".language-selector button").click();
      const change = await changed; assert.equal(change.status(), 303);
      assert.equal(await change.request().headerValue("origin"), origin);
      await page.waitForFunction(expected => document.documentElement.lang === expected, locale);
      await page.locator('#login-signup input[name="email"]').fill("recovery@example.invalid");
      await page.locator('#login-signup input[name="password"]').fill("DisposableRoleBrowserFixture!2026");
      const loggedIn = page.waitForResponse(response => new URL(response.url()).pathname === "/api/auth/login");
      await page.locator('#login-signup button[type="submit"]').click();
      assert.equal((await loggedIn).status(), 204); await page.waitForURL(origin + "/");
      const status = await context.request.get(origin + "/api/auth/security");
      assert.equal(status.status(), 200); const diagnostic = await status.json();
      assert.equal(diagnostic.role_mapping.enabled, true); assert.equal(diagnostic.role_mapping.protected_user_id, 1);
      assert.equal(diagnostic.role_mapping.max_age_seconds, 300);
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const mode of ["light", "dark"]) {
          await page.goto(origin + "/settings/security");
          await page.getByRole("radio", { name: catalog["theme." + mode], exact: true }).check();
          await page.waitForFunction(() => getComputedStyle(document.querySelector('.site-header a.nav')).color === getComputedStyle(document.body).color);
          await page.getByRole("heading", { name: catalog["oidc_roles.title"], exact: true }).waitFor();
          assert.equal(await page.locator("html").getAttribute("lang"), locale);
          for (const key of ["state", "enabled", "claim", "values", "lease", "recovery"]) {
            assert(await page.getByText(catalog["oidc_roles." + key], { exact: true }).isVisible(), locale + ": " + key);
          }
          assert.equal(await page.locator("main input, main select").count(), 0, "Mapping diagnostics are read-only");
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), locale + " " + width + " overflow");
          const bounds = await page.locator("main").boundingBox(); assert(bounds && bounds.x >= 0 && bounds.width <= width);
          await page.screenshot({ path: path.join(evidence, locale + "-" + width + "-" + mode + ".png"), fullPage: true }); layouts++;
        }
      }
      await context.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log(`PASS: ${layouts} EN/FR/ES OIDC role diagnostics layouts, native locale Origin, actual recovery login clicks, read-only mapping, light/dark 320/390/1440, zero external requests and JS errors`);
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
