// Point only at a fresh, isolated app instance. Never bootstrap a real service.
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Use an isolated loopback endpoint");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-lifecycle-ui-"));
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const account = { email: "browser@example.invalid", password: randomBytes(32).toString("hex") };
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", { data: account, headers: { Accept: "application/json" } });
    assert.equal(bootstrap.status(), 201, "Refuse to operate on an initialized app");
    const login = await context.request.post(origin + "/api/auth/login", { data: account, headers: { Accept: "application/json" } });
    assert.equal(login.status(), 200);
    const { token } = await login.json();
    await context.addCookies([{ name: "token", value: token, url: origin }]);
    const created = await context.request.post(origin + "/api/links", {
      data: { target: "https://192.0.2.1/browser", customurl: "browser-lifecycle" }, headers: { Accept: "application/json" }
    });
    assert.equal(created.status(), 201);
    const link = await created.json();
    const page = await context.newPage();
    await page.addInitScript(() => document.addEventListener("htmx:syntax:error", event => {
      console.log("HTMX syntax detail", JSON.stringify({ tag: event.target.tagName,
        trigger: event.target.getAttribute("hx-trigger"), token: event.detail.token }));
    }));
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") errors.push(message.text());
      if (message.text().startsWith("HTMX syntax detail")) console.log(message.text());
    });
    await page.goto(origin);
    const row = page.locator(`#tr-${link.id}`);
    await row.waitFor();
    await row.locator("button.edit").click();
    const form = page.locator(`#lifecycle-${link.id}`);
    await form.waitFor();
    await form.getByLabel("Paused", { exact: true }).check();
    await form.getByLabel("Start (UTC)").fill("2080-01-01T12:00");
    await form.getByLabel("End (UTC)").fill("2080-01-02T12:00");
    await form.getByLabel("Maximum redirects").fill("3");
    await form.getByRole("button", { name: "Save availability" }).click();
    await form.getByText("Lifecycle updated.", { exact: true }).waitFor();
    assert(await form.getByLabel("Paused", { exact: true }).isChecked());
    assert.equal((await context.request.get(origin + "/browser-lifecycle", { maxRedirects: 0 })).status(), 410);
    for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
      await page.setViewportSize({ width, height });
      await form.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidence, `lifecycle-${name}.png`) });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} page overflow`);
      for (const control of await form.locator("input, button").all()) {
        const rect = await control.boundingBox();
        if (!rect || rect.x < 0 || rect.x + rect.width > width) console.log(await control.evaluate(el => ({
          name: el.name, rect: el.getBoundingClientRect().toJSON(), ancestors: Array.from((function* () {
            for (let parent = el.parentElement; parent; parent = parent.parentElement) yield parent;
          })()).slice(0, 6).map(parent => ({ tag: parent.tagName, class: parent.className,
            width: parent.getBoundingClientRect().width, display: getComputedStyle(parent).display }))
        })));
        assert(rect && rect.width > 0 && rect.x >= 0 && rect.x + rect.width <= width, `${name} clipped control`);
      }
      await page.screenshot({ path: path.join(evidence, `lifecycle-${name}.png`) });
    }
    await page.reload();
    await row.locator("button.edit").click();
    await form.waitFor();
    assert(await form.getByLabel("Paused", { exact: true }).isChecked());
    assert.equal(await form.getByLabel("Maximum redirects").inputValue(), "3");
    await form.getByLabel("Paused", { exact: true }).uncheck();
    await form.getByLabel("Start (UTC)").fill("");
    await form.getByLabel("End (UTC)").fill("");
    await form.getByLabel("Maximum redirects").fill("1");
    await form.getByRole("button", { name: "Save availability" }).click();
    await form.getByText("Lifecycle updated.", { exact: true }).waitFor();
    assert.equal((await context.request.get(origin + "/browser-lifecycle", { maxRedirects: 0 })).status(), 302);
    assert.equal((await context.request.get(origin + "/browser-lifecycle", { maxRedirects: 0 })).status(), 410);
    assert.deepEqual(errors, []);
    console.log(`PASS: lifecycle create/edit/reload, desktop/mobile, usable controls and public redirect enforcement; screenshots: ${evidence}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
