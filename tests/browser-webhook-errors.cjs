const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Use a fresh loopback fixture");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-webhook-ui-"));
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", {
      data: { email: "webhook-ui@example.invalid", password: randomBytes(32).toString("hex") }, headers: { Accept: "application/json" }
    });
    assert.equal(bootstrap.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    const page = await context.newPage(), errors = [], consoleErrors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error" && !/Failed to load resource:.*(?:400|403|409|503) /.test(message.text())) consoleErrors.push(message.text());
    });
    const open = async () => {
      await page.goto(origin + "/settings/integrations");
      assert.match(await page.title(), /Integrations/);
      await page.getByRole("heading", { name: "Integrations", exact: true }).waitFor();
      await page.locator("#integration-status").getByText("Integrations loaded.", { exact: true }).waitFor();
      const create = page.getByRole("button", { name: "New webhook", exact: true });
      await create.focus(); await create.press("Enter");
      assert(await page.getByLabel("Name", { exact: true }).evaluate(el => el === document.activeElement));
    };
    const error = page.locator("#hook-form-error");
    const save = page.getByRole("button", { name: "Save webhook", exact: true });
    const name = page.getByLabel("Name", { exact: true });
    const receiver = page.getByLabel("Receiver URL", { exact: true });
    for (const [mode, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844], ["compact", 320, 720]]) {
      await page.setViewportSize({ width, height }); await open();
      await name.fill("Webhook " + mode); await receiver.fill("https://127.0.0.1/private");
      const response = page.waitForResponse(row => row.url().endsWith("/api/v2/webhooks") && row.request().method() === "POST");
      await save.focus(); await save.press("Enter");
      assert.equal((await response).status(), 400, "Server must still reject private receivers");
      await error.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.activeElement.id === "hook-form-error");
      const box = await error.boundingBox(); assert(box.y >= 0 && box.y + box.height <= height, "Error is visible at Save");
      assert.equal(await name.inputValue(), "Webhook " + mode);
      assert.equal(await receiver.inputValue(), "https://127.0.0.1/private");
      assert.equal(await page.locator("#integration-status").textContent(), "", "One error announcement");
      assert(await save.isEnabled());
      assert.equal((await (await context.request.get(origin + "/api/v2/webhooks")).json()).data.length, 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(evidence, `webhook-error-${mode}.png`) });
      await receiver.fill("https://example.org/webhook"); assert(await error.isHidden());
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      assert(await page.locator("#hook-editor").isHidden());
      assert(await page.locator("#hook-new").evaluate(el => el === document.activeElement));
      assert(await error.isHidden());
    }
    await open(); await name.fill("Retained webhook"); await receiver.fill("https://example.org/webhook");
    let rejectStatus = 503, pending = null, attempts = 0;
    const fail = async route => {
      if (route.request().method() !== "POST") return route.continue();
      attempts++;
      if (pending) await pending;
      return route.fulfill({ status: rejectStatus, contentType: rejectStatus === 503 ? "text/html" : "application/json",
        body: rejectStatus === 503 ? "<h1>Proxy unavailable</h1>" : JSON.stringify({ error: rejectStatus === 403 ? "Access denied." : "Webhook changed elsewhere. Reload before saving." }) });
    };
    await page.route("**/api/v2/webhooks", fail);
    for (const status of [503, 403, 409]) {
      rejectStatus = status; await save.click(); await error.waitFor({ state: "visible" });
      await page.waitForFunction(() => document.activeElement.id === "hook-form-error");
      assert.equal(await receiver.inputValue(), "https://example.org/webhook");
      assert(!(await error.textContent()).includes("<h1>"));
      await name.fill("Retained webhook " + status);
      assert(await error.isVisible(), "Uncertain and authorization errors remain until retry or cancel");
    }
    let release;
    pending = new Promise(resolve => { release = resolve; }); rejectStatus = 503;
    const before = attempts;
    await save.click(); await page.waitForFunction(() => document.querySelector('#hook-form button[type="submit"]').disabled);
    await page.locator("#hook-form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    const settings = page.locator(".integrations-page > header").getByRole("link", { name: "Settings", exact: true });
    await settings.focus();
    release(); await error.waitFor({ state: "visible" });
    assert.equal(attempts, before + 1, "One request while saving");
    assert(await settings.evaluate(el => el === document.activeElement), "Do not steal focus from navigation");
    await page.unroute("**/api/v2/webhooks", fail);
    // Only this disabled, disposable webhook is created; no event delivery is queued.
    await save.click(); await page.locator("#integration-status").getByText("Webhook saved.", { exact: true }).waitFor();
    assert(await error.isHidden()); assert(await page.locator("#hook-editor").isHidden());
    const hooks = (await (await context.request.get(origin + "/api/v2/webhooks")).json()).data;
    assert.equal(hooks.length, 1); assert.equal(hooks[0].enabled, false); assert.equal(hooks[0].name, "Retained webhook 409");
    await page.getByRole("button", { name: "Dismiss", exact: true }).click();
    const row = page.locator(".hook-row"); await row.getByRole("button", { name: "Edit", exact: true }).click();
    assert(await error.isHidden());
    // A real competing revision must reject the unchanged editor and preserve its draft.
    assert.equal((await context.request.put(origin + "/api/v2/webhooks/" + hooks[0].id, { data: {
      name: "Competing edit", url: hooks[0].url, enabled: false, events: hooks[0].events, revision: hooks[0].revision
    } })).status(), 200);
    await name.fill("Retained stale draft"); await save.click(); await error.waitFor({ state: "visible" });
    assert.match(await error.textContent(), /changed|revision|reload/i);
    assert.equal(await name.inputValue(), "Retained stale draft");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Reload", exact: true }).click();
    await page.locator("#integration-status").getByText("Integrations loaded.", { exact: true }).waitFor();
    await row.getByRole("button", { name: "Edit", exact: true }).click();
    assert.equal(await name.inputValue(), "Competing edit"); await name.fill("Recovered edit"); await save.click();
    await page.locator("#integration-status").getByText("Webhook saved.", { exact: true }).waitFor();
    const saved = (await (await context.request.get(origin + "/api/v2/webhooks")).json()).data[0];
    assert.equal(saved.name, "Recovered edit");
    assert.equal((await context.request.delete(origin + "/api/v2/webhooks/" + saved.id, { data: { revision: saved.revision } })).status(), 204);
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    console.log("PASS: desktop/mobile/compact visible webhook errors, keyboard focus, draft retention, cancel/correction, HTML/403/409 recovery, no focus theft, duplicate prevention, real revision conflict and disabled create/edit/delete");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
