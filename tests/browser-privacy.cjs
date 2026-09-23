const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Fresh loopback-only instance required");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-privacy-ui-"));
  const browser = await chromium.launch({ headless: true }); let page; const errors = [];
  try {
    const context = await browser.newContext(), headers = { Accept: "application/json" };
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Disposable instance did not become ready");
    const setup = await context.request.post(origin + "/api/auth/create-admin", { data: { email: "privacy-browser@example.invalid", password: randomBytes(32).toString("hex") }, headers });
    assert.equal(setup.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await setup.json()).token, url: origin }]);
    page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    const created = await context.request.post(origin + "/api/links", { data: { customurl: "privacy-browser-fixture", target: "https://192.0.2.1/default" }, headers });
    assert.equal(created.status(), 201); const link = await created.json();
    const trackingPath = "/api/links/" + link.id + "/tracking";
    const loaded = text => page.getByText(text || "Settings loaded", { exact: true }).waitFor();
    const healthyLayout = async label => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + " no horizontal overflow");
      for (const node of await page.locator(".privacy-page button:visible, .privacy-page input:visible").all()) {
        const box = await node.boundingBox(); assert(box && box.width >= 18 && box.height >= 18, label + " usable control dimensions");
      }
    };
    for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport); await page.goto(origin + "/");
      await page.getByRole("link", { name: "Tracking settings", exact: true }).click(); await loaded();
      await page.getByLabel("Record analytics", { exact: true }).uncheck();
      await page.getByRole("button", { name: "Save tracking", exact: true }).click(); await loaded("Tracking saved");
      assert.equal((await (await context.request.get(origin + trackingPath, { headers })).json()).enabled, false);
      await page.reload(); await loaded(); assert.equal(await page.getByLabel("Record analytics", { exact: true }).isChecked(), false);
      assert.equal((await context.request.get(origin + "/" + link.address, { maxRedirects: 0 })).status(), 302);
      await healthyLayout(label); await page.screenshot({ path: path.join(evidence, label + "-tracking.png"), fullPage: true });
      const current = await (await context.request.get(origin + trackingPath, { headers })).json();
      assert.equal((await context.request.put(origin + trackingPath, { headers, data: { enabled: false, revision: current.revision } })).status(), 200);
      await page.getByLabel("Record analytics", { exact: true }).check();
      await page.getByRole("button", { name: "Save tracking", exact: true }).click();
      await page.getByText("Tracking changed elsewhere. Reload before saving.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Reload", exact: true }).click(); await loaded();
      assert.equal(await page.getByLabel("Record analytics", { exact: true }).isChecked(), false);
      await page.getByLabel("Record analytics", { exact: true }).check();
      await page.getByRole("button", { name: "Save tracking", exact: true }).click(); await loaded("Tracking saved");
      await page.route("**" + trackingPath, route => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Test authorization denied" }) }));
      await page.getByRole("button", { name: "Reload", exact: true }).click();
      await page.getByText("Test authorization denied", { exact: true }).waitFor(); assert(await page.locator("#tracking-form").isHidden());
      await page.unroute("**" + trackingPath); await page.getByRole("button", { name: "Reload", exact: true }).click(); await loaded();

      await page.goto(origin + "/settings");
      await page.getByRole("link", { name: "Analytics retention", exact: true }).click(); await loaded();
      await page.getByLabel("Delete expired analytics", { exact: true }).check();
      await page.getByLabel("Retention days", { exact: true }).fill("30");
      let releasePreview, markStarted;
      const started = new Promise(resolve => { markStarted = resolve; });
      const paused = new Promise(resolve => { releasePreview = resolve; });
      await page.route("**/api/analytics/retention/preview", async route => { markStarted(); await paused; await route.continue(); });
      await page.getByRole("button", { name: "Preview changes", exact: true }).click(); await started;
      assert(await page.getByLabel("Retention days", { exact: true }).isDisabled(), "No changes while signed preview is in flight");
      assert(await page.getByLabel("Keep all analytics", { exact: true }).isDisabled());
      releasePreview(); await loaded("Preview ready"); await page.unroute("**/api/analytics/retention/preview");
      await page.getByRole("button", { name: "Apply retention", exact: true }).click();
      await page.getByText("Acknowledge permanent deletion before applying retention.", { exact: true }).waitFor();
      assert.equal((await (await context.request.get(origin + "/api/analytics/retention", { headers })).json()).days, 0);
      await page.getByRole("button", { name: "Preview changes", exact: true }).click(); await loaded("Preview ready");
      await page.getByLabel("Retention days", { exact: true }).fill("31"); assert(await page.locator("#retention-preview").isHidden(), "Changing draft invalidates confirmation");
      await page.getByRole("button", { name: "Preview changes", exact: true }).click(); await loaded("Preview ready");
      await healthyLayout(label); await page.screenshot({ path: path.join(evidence, label + "-retention-preview.png"), fullPage: true });
      await page.getByLabel("Permanently delete expired analytics", { exact: true }).check();
      await page.getByRole("button", { name: "Apply retention", exact: true }).click(); await loaded("Retention saved");
      assert.equal((await (await context.request.get(origin + "/api/analytics/retention", { headers })).json()).days, 31);
      await page.reload(); await loaded(); assert.equal(await page.getByLabel("Retention days", { exact: true }).inputValue(), "31");
      await healthyLayout(label); await page.screenshot({ path: path.join(evidence, label + "-retention-saved.png"), fullPage: true });
      await page.getByLabel("Keep all analytics", { exact: true }).check();
      await page.getByRole("button", { name: "Preview changes", exact: true }).click(); await loaded("Preview ready");
      assert(await page.locator("#retention-ack-label").isHidden());
      await page.getByRole("button", { name: "Apply retention", exact: true }).click(); await loaded("Retention saved");
      assert.equal((await (await context.request.get(origin + "/api/analytics/retention", { headers })).json()).days, 0);
      await page.route("**/api/analytics/retention", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Test unavailable" }) }));
      await page.getByRole("button", { name: "Reload", exact: true }).click(); await page.getByText("Test unavailable", { exact: true }).waitFor();
      assert(await page.locator("#retention-form").isHidden()); assert(await page.locator("#retention-state").isHidden());
      await page.unroute("**/api/analytics/retention"); await page.getByRole("button", { name: "Reload", exact: true }).click(); await loaded();
    }
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/mobile tracking save/reload/conflict/recovery, public redirects, admin retention preview/acknowledgement/confirmation, draft invalidation, in-flight editing protection, enable/disable/reload/error recovery and usable layouts; " + evidence);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    console.error({ errors, evidence }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
