const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "A fresh loopback fixture is required");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-webhooks-ui-"));
  const browser = await chromium.launch({ headless: true }), errors = []; let page;
  try {
    const context = await browser.newContext(), headers = { Accept: "application/json" };
    let ready = false;
    for (let i = 0; i < 100; i++) { try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {} if (ready) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert(ready);
    const setup = await context.request.post(origin + "/api/auth/create-admin", { headers, data: { email: "webhooks-browser@example.invalid", password: randomBytes(32).toString("hex") } });
    assert.equal(setup.status(), 201, "Never reuse an initialized instance");
    await context.addCookies([{ name: "token", value: (await setup.json()).token, url: origin }]);
    page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", dialog => dialog.accept());
    const loaded = async text => page.locator("#integration-status").filter({ hasText: text || "Integrations loaded." }).waitFor();
    const layout = async name => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + " overflow");
      for (const el of await page.locator(".integrations-page button:visible,.integrations-page input:visible").all()) {
        const box = await el.boundingBox(); assert(box && box.width >= 18 && box.height >= 18, name + " control dimensions");
      }
    };
    for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport); await page.goto(origin + "/settings");
      await page.getByRole("link", { name: "Integrations", exact: true }).click(); await loaded();
      await page.getByRole("button", { name: "New webhook", exact: true }).click();
      await page.getByLabel("Name", { exact: true }).fill(label + " receiver");
      await page.getByLabel("Receiver URL", { exact: true }).fill("https://httpbingo.org/status/204");
      assert.equal(await page.getByLabel("Enabled", { exact: true }).isChecked(), false);
      await layout(label); await page.screenshot({ path: path.join(evidence, label + "-editor.png"), fullPage: true });
      await page.getByRole("button", { name: "Save webhook", exact: true }).click(); await loaded("Webhook saved.");
      const secret = await page.locator("#hook-secret-value").textContent(); assert.match(secret, /^whsec_/);
      const config = (await (await context.request.get(origin + "/api/webhooks", { headers })).json()).data[0];
      assert.equal(config.enabled, false); assert(!Object.hasOwn(config, "secret"));
      // Signing secrets are intentionally excluded from screenshot artifacts.
      await page.getByRole("button", { name: "Dismiss", exact: true }).click(); assert.equal(await page.locator("#hook-secret-value").textContent(), "");
      let row = page.locator(".hook-row").filter({ has: page.getByRole("heading", { name: label + " receiver", exact: true }) });
      await row.getByRole("button", { name: "Enable", exact: true }).click(); await loaded("Webhook updated.");
      await row.getByRole("button", { name: "Send test", exact: true }).click(); await loaded("Test delivery queued.");
      await page.locator("#deliveries-list").getByText("webhook.test - pending", { exact: true }).waitFor();
      await page.locator("#events-list li").filter({ hasText: "webhook.test" }).first().waitFor();
      await layout(label); await page.screenshot({ path: path.join(evidence, label + "-deliveries-live.png"), fullPage: true });
      await page.getByLabel("Live", { exact: true }).uncheck(); await page.getByText("Paused", { exact: true }).waitFor();
      await page.getByLabel("Live", { exact: true }).check(); await page.getByText("Connected", { exact: true }).waitFor();
      await row.getByRole("button", { name: "Rotate secret", exact: true }).click(); await loaded("Signing secret rotated.");
      assert.notEqual(await page.locator("#hook-secret-value").textContent(), secret);
      await page.getByRole("button", { name: "Dismiss", exact: true }).click();
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      const fresh = (await (await context.request.get(origin + "/api/webhooks", { headers })).json()).data[0];
      const update = { name: fresh.name, url: fresh.url, enabled: fresh.enabled, events: fresh.events, revision: fresh.revision };
      assert.equal((await context.request.put(origin + "/api/webhooks/" + fresh.id, { headers, data: update })).status(), 200);
      await page.getByRole("button", { name: "Save webhook", exact: true }).click();
      await loaded("Webhook changed. Reload before saving.");
      await page.getByRole("button", { name: "Reload", exact: true }).click(); await loaded(); assert(await page.locator("#hook-editor").isHidden());
      row = page.locator(".hook-row").filter({ has: page.getByRole("heading", { name: label + " receiver", exact: true }) });
      await row.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByLabel("Receiver URL", { exact: true }).fill("https://127.0.0.1/");
      await page.getByRole("button", { name: "Save webhook", exact: true }).click(); await loaded("Webhook URL must resolve exclusively");
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await page.route("**/api/v2/webhooks", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fixture unavailable" }) }));
      await page.getByRole("button", { name: "Reload", exact: true }).click(); await loaded("Fixture unavailable");
      await page.unroute("**/api/v2/webhooks"); await page.getByRole("button", { name: "Reload", exact: true }).click(); await loaded();
      await row.getByRole("button", { name: "Delete", exact: true }).click(); await loaded("Webhook deleted.");
      assert.equal(await page.locator(".hook-row").count(), 0);
      await page.reload(); await loaded(); await layout(label);
    }
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/mobile native webhook CRUD, secret rotation/dismissal, enable/test queue, live updates/reconnect, deliveries, conflicts, SSRF denial, reload and error recovery; " + evidence);
  } catch (error) {
    if (page) { await page.locator("#hook-secret-value").evaluate(el => { el.textContent = "[REDACTED]"; }).catch(() => {}); await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true }); }
    console.error({ evidence, errors }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
