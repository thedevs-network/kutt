const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(origin && new URL(origin).hostname === "127.0.0.1" && evidence);
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext(), headers = { Accept: "application/json" };
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break; await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready);
    const setup = await context.request.post(origin + "/api/auth/create-admin", { headers,
      data: { email: "responses@example.invalid", password: randomBytes(32).toString("hex") } });
    assert.equal(setup.status(), 201, "Refuse initialized fixtures");
    await context.addCookies([{ name: "token", value: (await setup.json()).token, url: origin }]);
    const page = await context.newPage(), errors = [], consoleErrors = [];
    page.setDefaultTimeout(15000); page.on("dialog", dialog => dialog.accept());
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !/Failed to load resource:.*(?:403|409|503) /.test(message.text())) consoleErrors.push(message.text()); });
    const call = async (method, route, data, expected = 200) => {
      const result = await context.request.fetch(origin + route, { method, data, headers });
      assert.equal(result.status(), expected); return result.json();
    };
    const variants = [
      { status: 200, contentType: "text/html", body: "<h1>Sign in</h1>" },
      { status: 200, contentType: "application/json", body: "{ PRIVATE_PARSER_DETAIL" },
      { status: 200, contentType: "application/json", body: "{}" },
      { status: 200, contentType: "application/json", body: "null" },
      { status: 303, headers: { Location: origin + "/api/health" }, body: "" }
    ];
    let count = 0;
    const failures = async (endpoint, method, button, status, verify, extra = []) => {
      for (const reply of [...variants, ...extra]) {
        const handler = route => route.request().method() === method ? route.fulfill(reply) : route.continue();
        await page.route(endpoint, handler);
        const completed = page.waitForResponse(response => response.request().method() === method &&
          (typeof endpoint === "function" ? endpoint(new URL(response.url())) : response.url() === endpoint));
        await button.focus(); await button.press("Enter");
        await (await completed).finished();
        await status.getByText(/Unexpected server response/).waitFor();
        await page.waitForFunction(element => !element.disabled, await button.elementHandle());
        assert(!/PRIVATE_PARSER_DETAIL|undefined|not iterable|toLocaleString/.test(await status.textContent()));
        await verify(); count++;
        await page.unroute(endpoint, handler);
      }
    };
    for (const [mode, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844], ["compact", 320, 720]]) {
      await page.setViewportSize({ width, height });
      const link = await call("POST", "/api/links", { target: "https://192.0.2.1/response-check", customurl: "responses-" + mode, paused: true }, 201);
      const base = "/api/v2/links/" + link.id;
      await page.goto(origin + "/link/forwarding/" + link.id);
      await page.getByText("Saved allowlists loaded.", { exact: true }).waitFor();
      const query = page.getByLabel("Allowed query keys", { exact: true }); await query.fill("campaign");
      const forwardStatus = page.locator("#forwarding-status"), saveForward = page.locator("#forwarding-save");
      const forwardDraft = async () => { assert.equal(await query.inputValue(), "campaign"); assert(await saveForward.isEnabled()); };
      await failures(origin + base + "/forwarding", "PUT", saveForward, forwardStatus, forwardDraft,
        [{ status: 200, contentType: "application/json", body: JSON.stringify({ query_keys: [], path_prefixes: [], revision: "1" }) }]);
      await failures(origin + base + "/forwarding", "GET", page.locator("#forwarding-reload"), forwardStatus, forwardDraft);
      await failures(origin + base + "/forwarding/preview", "POST", page.locator("#forwarding-test"), page.locator("#forwarding-result"), forwardDraft);
      await saveForward.click(); await page.getByText("Allowlists saved.", { exact: true }).waitFor();
      assert.deepEqual((await call("GET", base + "/forwarding")).query_keys, ["campaign"]);
      // A server may have committed before an intermediary corrupts its response.
      await query.fill("committed");
      await page.route(origin + base + "/forwarding", async route => {
        if (route.request().method() !== "PUT") return route.continue();
        assert.equal((await route.fetch()).status(), 200); await route.fulfill(variants[0]);
      });
      await saveForward.click(); await forwardStatus.getByText(/not confirmed/).waitFor();
      await page.unroute(origin + base + "/forwarding");
      await saveForward.click(); await forwardStatus.getByText(/Changed elsewhere/).waitFor();
      assert.equal(await query.inputValue(), "committed");
      await page.locator("#forwarding-reload").click(); await page.getByText("Saved allowlists loaded.", { exact: true }).waitFor();
      assert.equal(await query.inputValue(), "committed");
      await page.goto(origin + "/link/routing/" + link.id); await page.getByText("No routing rules", { exact: true }).waitFor();
      await page.locator("#routing-add").click(); await page.getByLabel("Name", { exact: true }).fill("Mobile draft");
      await page.getByLabel("Destination", { exact: true }).fill("https://example.org/mobile");
      const rules = page.locator("#routing-rules"), saveRouting = page.locator("#routing-save"), routingStatus = page.locator("#routing-status");
      const routingDraft = async () => { assert.equal(await rules.getByLabel("Name", { exact: true }).inputValue(), "Mobile draft"); assert(await saveRouting.isEnabled()); };
      await failures(origin + "/api/links/" + link.id + "/routing", "PUT", saveRouting, routingStatus, routingDraft);
      await failures(origin + "/api/links/" + link.id + "/routing", "GET", page.locator("#routing-reload"), routingStatus, routingDraft,
        [{ status: 200, contentType: "application/json", body: JSON.stringify({ revision: 0, rules: [null] }) }]);
      await failures(origin + "/api/links/" + link.id + "/routing/preview", "POST", page.locator("#routing-test"), page.locator("#routing-result"), routingDraft);
      await saveRouting.click(); await page.getByText("Rules saved", { exact: true }).waitFor();
      assert.equal((await call("GET", base + "/routing")).rules[0].name, "Mobile draft");
      await page.goto(origin + "/link/health/" + link.id); await page.getByText("Saved monitoring loaded.", { exact: true }).waitFor();
      await page.getByLabel("Monitor destinations", { exact: true }).check();
      await page.locator("#health-save").click(); await page.getByText("Monitoring saved.", { exact: true }).waitFor();
      const previous = await page.locator("#health-results").textContent(), state = await page.locator("#health-state").textContent();
      const interval = page.getByLabel("Check interval (hours)", { exact: true }); await interval.fill("48");
      const healthDraft = async () => {
        assert.equal(await interval.inputValue(), "48"); assert.equal(await page.locator("#health-state").textContent(), state);
        assert.equal(await page.locator("#health-results").textContent(), previous); assert(await page.locator("#health-check").isEnabled());
      };
      await failures(origin + base + "/health", "PUT", page.locator("#health-save"), page.locator("#health-message"), healthDraft);
      await failures(origin + base + "/health", "GET", page.locator("#health-reload"), page.locator("#health-message"), healthDraft);
      await failures(origin + base + "/health/check", "POST", page.locator("#health-check"), page.locator("#health-message"), healthDraft);
      await page.screenshot({ path: path.join(evidence, "monitoring-error-" + mode + ".png"), fullPage: true, animations: "disabled" });
      await page.locator("#health-save").click(); await page.getByText("Monitoring saved.", { exact: true }).waitFor();
      assert.equal((await call("GET", base + "/health")).interval_hours, 48);
      await page.goto(origin + "/settings/health"); await page.getByText("Monitoring refreshed.", { exact: true }).waitFor();
      const dashboard = await page.locator("#health-links").textContent();
      await failures(origin + "/api/v2/links/health", "GET", page.locator("#health-refresh"), page.locator("#health-message"), async () => {
        assert.equal(await page.locator("#health-links").textContent(), dashboard);
      });
      await page.locator("#health-refresh").click(); await page.getByText("Monitoring refreshed.", { exact: true }).waitFor();
      // Stop the fixture monitor after exercising its non-destructive configuration.
      const current = await call("GET", base + "/health"); await call("PUT", base + "/health", { revision: current.revision, enabled: false, interval_hours: 48 });
      await page.goto(origin + "/settings/analytics"); await page.locator("#analytics-report").waitFor({ state: "visible" });
      const filters = page.locator("#analytics-filters"); await filters.getByLabel("Search links", { exact: true }).fill("responses");
      await failures(url => url.pathname === "/api/analytics", "GET", filters.getByRole("button", { name: "Apply", exact: true }), page.locator("#analytics-status"), async () => {
        assert(await page.locator("#analytics-report").isHidden());
        assert.equal(await page.locator("#analytics-json").getAttribute("href"), null);
        assert.equal(await page.locator("#analytics-csv").getAttribute("href"), null);
        assert.equal(await filters.getByLabel("Search links", { exact: true }).inputValue(), "responses");
      });
      await page.screenshot({ path: path.join(evidence, "analytics-error-" + mode + ".png"), fullPage: true, animations: "disabled" });
      await filters.getByRole("button", { name: "Apply", exact: true }).click(); await page.locator("#analytics-report").waitFor({ state: "visible" });
      assert(await page.locator("#analytics-csv").getAttribute("href"));
      await page.goto(origin + "/link/tracking/" + link.id); await page.getByText("Settings loaded", { exact: true }).waitFor();
      const tracking = page.getByLabel("Record analytics", { exact: true }); await tracking.uncheck();
      const privacyStatus = page.locator("#privacy-status");
      await failures(origin + "/api/links/" + link.id + "/tracking", "PUT", page.getByRole("button", { name: "Save tracking", exact: true }), privacyStatus, async () => {
        assert.equal(await tracking.isChecked(), false); assert(await page.locator("#tracking-form").isVisible());
        assert.equal((await call("GET", "/api/links/" + link.id + "/tracking")).enabled, true);
      });
      await failures(origin + "/api/links/" + link.id + "/tracking", "GET", page.locator("#privacy-reload"), privacyStatus, async () => {
        assert.equal(await tracking.isChecked(), false); assert(await page.locator("#tracking-form").isVisible());
      });
      await page.screenshot({ path: path.join(evidence, "privacy-error-" + mode + ".png"), fullPage: true, animations: "disabled" });
      await page.getByRole("button", { name: "Save tracking", exact: true }).click(); await page.getByText("Tracking saved", { exact: true }).waitFor();
      assert.equal((await call("GET", "/api/links/" + link.id + "/tracking")).enabled, false);
      await page.goto(origin + "/settings/retention"); await page.getByText("Settings loaded", { exact: true }).waitFor();
      const retentionState = await page.locator("#retention-state").textContent();
      await failures(origin + "/api/analytics/retention", "GET", page.locator("#privacy-reload"), privacyStatus, async () => {
        assert(await page.locator("#retention-form").isVisible()); assert.equal(await page.locator("#retention-state").textContent(), retentionState);
      });
      const previewRetention = page.getByRole("button", { name: "Preview changes", exact: true });
      await failures(origin + "/api/analytics/retention/preview", "POST", previewRetention, privacyStatus, async () => {
        assert(await page.locator("#retention-preview").isHidden());
      });
      // Only the non-destructive keep-all policy is applied, on disposable data.
      for (const reply of variants) {
        await previewRetention.click(); await page.getByText("Preview ready", { exact: true }).waitFor();
        await page.route(origin + "/api/analytics/retention", route => route.request().method() === "PUT" ? route.fulfill(reply) : route.continue());
        await page.locator("#retention-save").click(); await privacyStatus.getByText(/Unexpected server response/).waitFor();
        assert(await page.locator("#retention-preview").isHidden()); count++;
        await page.unroute(origin + "/api/analytics/retention");
      }
      await previewRetention.click(); await page.getByText("Preview ready", { exact: true }).waitFor();
      await page.locator("#retention-save").click(); await page.getByText("Retention saved", { exact: true }).waitFor();
      const policy = await call("GET", "/api/analytics/retention"); assert.equal(policy.days, 0); assert.equal(policy.deleted_buckets, 0);
      const hook = await call("POST", "/api/v2/webhooks", { name: "Response hook " + mode, url: "https://example.org/webhook", enabled: false, events: ["link.created"] }, 201);
      await page.goto(origin + "/settings/integrations"); await page.getByText("Integrations loaded.", { exact: true }).waitFor();
      await page.locator("#events-live").uncheck();
      const hookRow = page.locator('.hook-row[data-id="' + hook.id + '"]'), integrationStatus = page.locator("#integration-status");
      for (const [method, suffix, label] of [["PUT", "", "Enable"], ["DELETE", "", "Delete"], ["POST", "/test", "Send test"], ["POST", "/rotate", "Rotate secret"]]) {
        await failures(origin + "/api/v2/webhooks/" + hook.id + suffix, method, hookRow.getByRole("button", { name: label, exact: true }), integrationStatus, async () => {
          assert(await hookRow.isVisible()); assert(await page.locator("#hook-secret").isHidden());
          assert.equal((await call("GET", "/api/v2/webhooks")).data[0].revision, 1);
        });
      }
      await hookRow.getByRole("button", { name: "Edit", exact: true }).click();
      await page.getByLabel("Name", { exact: true }).fill("Retained hook draft");
      await failures(origin + "/api/v2/webhooks/" + hook.id, "PUT", page.locator("#hook-form").getByRole("button", { name: "Save webhook", exact: true }), page.locator("#hook-form-error"), async () => {
        assert(await page.locator("#hook-editor").isVisible()); assert.equal(await page.getByLabel("Name", { exact: true }).inputValue(), "Retained hook draft");
      });
      await page.screenshot({ path: path.join(evidence, "webhook-error-" + mode + ".png"), fullPage: true, animations: "disabled" });
      await page.locator("#hook-form").getByRole("button", { name: "Save webhook", exact: true }).click(); await page.getByText("Webhook saved.", { exact: true }).waitFor();
      assert.equal((await call("GET", "/api/v2/webhooks")).data[0].name, "Retained hook draft");
      await hookRow.getByRole("button", { name: "Delete", exact: true }).click(); await page.getByText("Webhook deleted.", { exact: true }).waitFor();
      assert.equal((await call("GET", "/api/v2/webhooks")).data.length, 0);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    console.log(`PASS: ${count} malformed/redirected desktop/mobile/compact response cases across forwarding/routing/monitoring/analytics/privacy/webhooks; drafts, state, hidden stale exports, ambiguous committed writes/conflict reload and real retry preserved; no retention deletion or webhook delivery`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
