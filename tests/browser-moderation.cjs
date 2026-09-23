const assert = require("node:assert/strict");
const { locale, t } = require("./browser-locale.cjs");
const { randomBytes } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert(evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ locale, extraHTTPHeaders: { "Accept-Language": locale } });
    const call = async (method, route, data, status = 200, token) => {
      const res = await context.request.fetch(origin + route, { method, data, maxRedirects: 0,
        headers: { Accept: "application/json", ...(token ? { Cookie: "token=" + token } : {}) } });
      assert.equal(res.status(), status, route + ": " + await res.text());
      return status === 204 ? null : res.json();
    };
    const admin = await call("POST", "/api/auth/create-admin", { email: "moderation-browser@example.invalid", password: randomBytes(32).toString("hex") }, 201);
    await context.addCookies([{ name: "token", value: admin.token, url: origin }]);
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });
    const settle = async () => { await page.waitForLoadState("networkidle"); await page.waitForFunction(() => !document.querySelector(".htmx-request,.htmx-swapping,.htmx-settling")); };
    const shot = async name => {
      const pageTitle = await page.title();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + " fits");
      assert([t("moderation.title"), t("moderation.remove")].some(title => (pageTitle || "").includes(title)));
      await page.screenshot({ path: path.join(evidence, name + ".png"), fullPage: true, animations: "disabled" });
    };
    for (const width of [1440, 390, 320]) {
      const email = "moderation-" + width + "@example.invalid", password = randomBytes(24).toString("hex");
      await call("POST", "/api/users/admin", { email, password, verified: true }, 201);
      const user = (await call("POST", "/api/auth/login", { email, password })).token;
      const link = await call("POST", "/api/links", { customurl: "moderation-ui-" + width, target: "https://192.0.2.1/" + width }, 201, user);
      // Login updates the context cookie; restore the actual administrator.
      await context.addCookies([{ name: "token", value: admin.token, url: origin }]);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + "/admin"); await settle();
      await page.getByRole("tab", { name: t("ui.users"), exact: true }).click(); await settle();
      await page.getByRole("button", { name: t("ui.ban_user_value", { value1: email }), exact: true }).click();
      const dialog = page.locator("#admin-table-dialog");
      await dialog.getByLabel(t("ui.user_links"), { exact: true }).check();
      const question = dialog.locator(".content > p").first();
      assert.equal((await question.textContent()).trim(), t("dialog.ban_user", { value: email }));
      assert(await question.evaluate(node => {
        const box = node.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(node);
        return [...range.getClientRects()].every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1);
      }), "The full localized confirmation fits its dialog");
      await page.screenshot({ path: path.join(evidence, "ban-copy-" + width + ".png"), fullPage: true });
      const banResponse = page.waitForResponse(r => /\/api\/users\/admin\/ban\//.test(r.url()) && r.request().method() === "POST");
      await dialog.getByRole("button", { name: t("ui.ban"), exact: true }).click();
      assert.equal((await banResponse).status(), 200); await settle();
      await dialog.getByRole("button", { name: t("ui.close"), exact: true }).click();
      await page.goto(origin + "/admin/moderation"); await settle();
      assert.equal((await context.request.get(origin + "/css/moderation.css")).status(), 200);
      const row = page.locator(".moderation-list li").filter({ hasText: email });
      await row.getByRole("link", { name: t("moderation.remove"), exact: true }).click(); await settle();
      await shot("confirm-" + width);
      await page.getByRole("button", { name: t("moderation.remove"), exact: true }).focus();
      const unbanResponse = page.waitForResponse(r => r.url().includes("/admin/moderation/user/") && r.request().method() === "POST");
      await page.keyboard.press("Enter");
      const submitted = await unbanResponse;
      assert.equal(submitted.status(), 303, "Native confirmation must redirect after a committed unban");
      assert.equal(submitted.request().headers().origin, origin);
      await page.waitForURL(url => url.pathname === "/admin/moderation"); await settle();
      assert.equal(new URL(page.url()).pathname, "/admin/moderation");
      assert.equal(await page.locator(".moderation-list li").filter({ hasText: email }).count(), 0);
      await page.getByLabel(t("moderation.entries"), { exact: true }).selectOption("link");
      await page.getByRole("button", { name: t("ui.filter"), exact: true }).click(); await settle();
      await shot("links-" + width);
      const bannedLink = page.locator(".moderation-list li").filter({ hasText: link.address });
      await bannedLink.getByRole("link", { name: t("moderation.remove"), exact: true }).click(); await settle();
      await page.getByRole("button", { name: t("moderation.remove"), exact: true }).click(); await settle();
      assert.equal(await page.locator(".moderation-list li").filter({ hasText: link.address }).count(), 0);
      const redirect = await context.request.get(origin + "/" + link.address, { maxRedirects: 0 });
      assert.equal(redirect.status(), 302); assert.equal(redirect.headers().location, "https://192.0.2.1/" + width);
    }
    assert.deepEqual(errors, []);
    console.log("PASS: 1440/390/320px moderation, real HTMX ban checklist, explicit independent recovery, keyboard confirmation, audit, stylesheet and public redirects");
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
