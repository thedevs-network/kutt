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
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-history-ui-"));
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const context = await browser.newContext();
    const account = { email: "browser@example.invalid", password: randomBytes(32).toString("hex") };
    const headers = { Accept: "application/json" };
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", { data: account, headers });
    assert.equal(bootstrap.status(), 201, "Refuse initialized instances");
    const login = await context.request.post(origin + "/api/auth/login", { data: account, headers });
    assert.equal(login.status(), 200);
    await context.addCookies([{ name: "token", value: (await login.json()).token, url: origin }]);
    page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") { errors.push(message.text()); console.log(message.text()); } });
    page.on("dialog", dialog => dialog.accept());
    for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
      await page.setViewportSize({ width, height });
      const address = `browser-trash-${name}`;
      const response = await context.request.post(origin + "/api/links", {
        headers, data: { target: "https://192.0.2.1/" + "long-path-".repeat(18), customurl: address }
      });
      assert.equal(response.status(), 201);
      const link = await response.json();
      await page.goto(origin);
      const row = page.locator(`#tr-${link.id}`);
      await row.locator("button.delete").click();
      await page.getByRole("button", { name: "Move to trash", exact: true }).click();
      await page.getByText(`Your link`, { exact: false }).waitFor();
      await page.getByRole("link", { name: "Open trash" }).click();
      const article = page.locator(`#trash-${link.id}`);
      await article.waitFor();
      assert.equal((await context.request.get(origin + "/" + address, { maxRedirects: 0 })).status(), 410);
      await page.screenshot({ path: path.join(evidence, `trash-${name}.png`), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + " trash overflow");
      const bounds = await article.getByRole("button", { name: "Restore" }).boundingBox();
      assert(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width, "Restore must remain visible");
      await article.getByRole("link", { name: "History", exact: true }).click();
      await page.getByRole("heading", { name: "Link history", exact: true }).waitFor();
      await page.getByRole("heading", { name: "trashed", exact: true }).waitFor();
      await page.screenshot({ path: path.join(evidence, `history-${name}.png`), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + " history overflow");
      await page.getByRole("link", { name: "Trash", exact: true }).click();
      await article.getByRole("button", { name: "Restore", exact: true }).click();
      await article.getByRole("status").waitFor();
      assert((await article.textContent()).includes("Restored. Active"));
      assert.equal((await context.request.get(origin + "/" + address, { maxRedirects: 0 })).status(), 302);
      await page.reload();
      assert.equal(await article.count(), 0);
      await page.goto(origin);
      await row.waitFor();
      await row.locator("button.edit").click();
      await page.getByRole("link", { name: "History", exact: true }).click();
      await page.getByRole("heading", { name: "restored", exact: true }).waitFor();
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: desktop/mobile delete, trash, history, restore, reload, retained redirects and no browser errors; ${evidence}`);
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(evidence, "history-failure.png"), fullPage: true });
      console.log(await page.locator("body").innerText());
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
