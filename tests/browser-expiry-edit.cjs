// Fresh, synthetic loopback fixture only. Never bootstrap a real installation.
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  const evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await context.request.get(origin + "/api/v2/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Fixture did not start");
    const account = { email: "expiry-browser@example.invalid", password: randomBytes(32).toString("hex") };
    const json = { Accept: "application/json" };
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", { data: account, headers: json });
    assert.equal(bootstrap.status(), 201, "Refuse an initialized app");
    await context.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    await page.addInitScript(() => document.addEventListener("htmx:syntax:error", event => {
      console.error(JSON.stringify({ event: "htmx:syntax:error", tag: event.target.tagName,
        trigger: event.target.getAttribute("hx-trigger"), token: event.detail.token }));
    }));
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => { if (["error", "warning"].includes(msg.type())) errors.push(msg.text()); });
    const current = async id => {
      const response = await context.request.get(origin + "/api/links", { headers: json });
      assert.equal(response.status(), 200);
      return (await response.json()).data.find(link => link.id === id);
    };
    const patch = async (endpoint, data) => {
      const response = await context.request.patch(origin + endpoint, { data, headers: json });
      assert.equal(response.status(), 200, await response.text());
    };
    const save = async (form, message, button) => {
      const previous = await form.elementHandle();
      await form.getByRole("button", { name: button, exact: true }).click();
      await previous.waitForElementState("hidden", { timeout: 10000 });
      await form.getByText(message, { exact: true }).waitFor({ timeout: 10000 });
    };
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const created = await context.request.post(origin + "/api/links", { headers: json,
        data: { target: "https://192.0.2.1/expiry-browser", customurl: "expiry-browser-" + width, expire_in: "2 days", paused: true, max_visits: 23 } });
      assert.equal(created.status(), 201);
      const link = await created.json();
      await page.goto(origin);
      await page.waitForLoadState("networkidle");
      await page.locator(`#tr-${link.id} button.edit`).click();
      const editor = page.locator(`#edit-form-${link.id}`), availability = page.locator(`#lifecycle-${link.id}`);
      await editor.waitFor();
      await editor.getByLabel("Description:", { exact: true }).fill("Draft retained " + width);
      await availability.getByLabel("Remove previous expiry").check();
      await availability.getByLabel("End (UTC)").fill("2080-01-01T00:00");
      await save(availability, "Lifecycle updated.", "Save availability");
      assert.equal(await editor.getByLabel("Description:", { exact: true }).inputValue(), "Draft retained " + width);
      assert.equal((await current(link.id)).expire_in, null);
      await save(editor, "Link has been updated.", "Update");
      let persisted = await current(link.id);
      assert.equal(persisted.expire_in, null); assert.equal(persisted.paused, true); assert.equal(persisted.max_visits, 23);
      assert.equal(persisted.ends_at, "2080-01-01T00:00:00.000Z");

      // The sibling form keeps an independent, unsaved End draft.
      await availability.getByLabel("End (UTC)").fill("2081-01-01T00:00");
      await editor.getByLabel("Expire in:", { exact: true }).fill("4 days");
      await save(editor, "Link has been updated.", "Update");
      assert.equal(await availability.getByLabel("End (UTC)").inputValue(), "2081-01-01T00:00");
      const expiry = (await current(link.id)).expire_in;
      assert(expiry);
      await save(availability, "Lifecycle updated.", "Save availability");
      assert.equal((await current(link.id)).expire_in, expiry);
      await editor.getByLabel("Description:", { exact: true }).fill("Another save " + width);
      await save(editor, "Link has been updated.", "Update");
      assert.equal((await current(link.id)).expire_in, expiry);

      await patch("/api/links/" + link.id + "/lifecycle", { expire_in: null });
      await editor.getByLabel("Expire in:", { exact: true }).fill("5 days");
      await save(editor, "Expiry changed elsewhere. Review the current expiry, then save again to replace it.", "Update");
      assert.equal(await editor.locator('[name="expire_in"]').inputValue(), "5 days");
      assert.equal((await current(link.id)).expire_in, null);
      await editor.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidence, `expiry-conflict-${width}.png`), fullPage: true, animations: "disabled" });
      await save(editor, "Link has been updated.", "Update");
      assert((await current(link.id)).expire_in);
      assert.equal((await context.request.get(origin + "/" + link.address, { maxRedirects: 0 })).status(), 410);

      await page.goto(origin + "/admin");
      await page.waitForLoadState("networkidle");
      await page.locator(`#tr-${link.id} button.edit`).click();
      await editor.waitFor();
      await patch("/api/links/" + link.id + "/lifecycle", { expire_in: null });
      await editor.getByLabel("Description:", { exact: true }).fill("Admin unrelated save " + width);
      await save(editor, "Link has been updated.", "Update");
      assert.equal((await current(link.id)).expire_in, null);
    }
    assert.deepEqual(errors, []);
    console.log("PASS: native expiry saves and conflict recovery at 1440/390/320px; personal/admin, independent drafts, no sliding expiry, paused redirects and console; " + evidence);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
