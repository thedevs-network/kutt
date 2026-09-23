const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync } = require("node:fs");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL; assert(origin && new URL(origin).hostname === "127.0.0.1");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-health-ui-"));
  const browser = await chromium.launch({ headless: true }), errors = [];
  let page;
  try {
    const context = await browser.newContext(), headers = { Accept: "application/json" };
    for (let n = 0; n < 100; n++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const setup = await context.request.post(origin + "/api/auth/create-admin", { data: { email: "health-browser@example.invalid", password: randomBytes(32).toString("hex") }, headers });
    assert.equal(setup.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await setup.json()).token, url: origin }]);
    page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport);
      const response = await context.request.post(origin + "/api/links", { headers, data: { customurl: "health-ui-" + label, target: "https://192.0.2.1/health" } });
      assert.equal(response.status(), 201); const link = await response.json(), api = origin + "/api/v2/links/" + link.id + "/health";
      const action = async (name, method, expected = 200) => {
        const pending = page.waitForResponse(r => r.url().startsWith(api) && r.request().method() === method);
        await page.getByRole("button", { name, exact: true }).click(); assert.equal((await pending).status(), expected); await page.waitForTimeout(100);
      };
      await page.goto(origin + "/settings/library");
      await page.locator(".library-links>li").filter({ hasText: link.address }).getByRole("link", { name: "Destination health", exact: true }).click();
      await page.getByText("Saved monitoring loaded.", { exact: true }).waitFor();
      assert(await page.getByRole("button", { name: "Check now", exact: true }).isDisabled());
      await page.getByLabel("Monitor destinations", { exact: true }).check();
      await page.getByLabel("Check interval (hours)", { exact: true }).fill("8");
      await action("Save monitoring", "PUT");
      await action("Check now", "POST", 202);
      await page.reload(); await page.getByText("Saved monitoring loaded.", { exact: true }).waitFor();
      assert(await page.getByLabel("Monitor destinations", { exact: true }).isChecked());
      assert.equal(await page.getByLabel("Check interval (hours)", { exact: true }).inputValue(), "8");
      const saved = await (await context.request.get(api, { headers })).json();
      assert.equal((await context.request.put(api, { headers, data: { enabled: true, interval_hours: 8, revision: saved.revision } })).status(), 200);
      await page.getByLabel("Check interval (hours)", { exact: true }).fill("12");
      await action("Save monitoring", "PUT", 409);
      assert.match(await page.locator("#health-message").textContent(), /Changed elsewhere/);
      assert.equal(await page.getByLabel("Check interval (hours)", { exact: true }).inputValue(), "12");
      await action("Reload saved monitoring", "GET");
      await page.route(api, route => route.request().method() === "GET" ? route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Temporary outage"}' }) : route.continue());
      await action("Reload saved monitoring", "GET", 503); assert.match(await page.locator("#health-message").textContent(), /Temporary outage/);
      await page.unroute(api); await action("Reload saved monitoring", "GET");
      // Render a deterministic failed check; network/probe results are separately
      // verified in backend and public acceptance, not inferred from this fixture.
      const current = await (await context.request.get(api, { headers })).json();
      await page.route(api, route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ...current, state: "attention", checked_at: new Date().toISOString(), overdue: true,
        results: [{ name: "Default destination", code: "ADDRESS_DENIED", http_status: null, duration_ms: 12, action: "DNS includes a private or reserved address. Correct DNS or leave this destination unmonitored." }] }) }));
      await action("Reload saved monitoring", "GET");
      assert.match(await page.locator("#health-results").textContent(), /private or reserved/);
      assert.match(await page.locator("#health-times").textContent(), /overdue/);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert(await page.evaluate(() => { const h = document.querySelector(".archive-heading"), next = h.nextElementSibling.getBoundingClientRect(); return [...h.children].every(c => c.getBoundingClientRect().bottom <= next.top); }));
      await page.screenshot({ path: path.join(evidence, label + "-attention.png"), fullPage: true });
      await page.unroute(api); await action("Reload saved monitoring", "GET");
      await page.getByLabel("Monitor destinations", { exact: true }).uncheck(); await action("Save monitoring", "PUT");
      assert(await page.getByRole("button", { name: "Check now", exact: true }).isDisabled());
      await page.getByRole("link", { name: "Monitoring", exact: true }).click();
      await page.getByText("Monitoring refreshed.", { exact: true }).waitFor();
      const monitorLink = page.getByRole("link", { name: origin + "/" + link.address, exact: true });
      assert(await monitorLink.isVisible());
      assert.equal(await monitorLink.getAttribute("href"), "/link/health/" + link.id);
      await page.getByRole("button", { name: "Refresh monitoring", exact: true }).click();
      await page.getByText("Monitoring refreshed.", { exact: true }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(evidence, label + "-dashboard.png"), fullPage: true });
    }
    assert.deepEqual(errors, []); console.log("PASS: desktop/mobile monitoring enable/save/queue/reload, revision conflicts, outage recovery, actionable result rendering, disable and dashboard; " + evidence);
  } catch (error) { if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true }); console.error({ evidence, errors }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
