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
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-routing-ui-"));
  const browser = await chromium.launch({ headless: true });
  let page;
  const errors = [];
  try {
    const context = await browser.newContext(), headers = { Accept: "application/json" };
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Disposable instance did not start");
    const setup = await context.request.post(origin + "/api/auth/create-admin", { data: { email: "routing-browser@example.invalid", password: randomBytes(32).toString("hex") }, headers });
    assert.equal(setup.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await setup.json()).token, url: origin }]);
    page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message)); page.on("dialog", dialog => dialog.accept());
    const action = async (button, method, status = 200) => {
      const awaited = page.waitForResponse(r => r.url().includes("/routing") && r.request().method() === method);
      await button.click(); const r = await awaited; assert.equal(r.status(), status, await r.text());
      await page.waitForTimeout(100);
    };
    for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport);
      const created = await context.request.post(origin + "/api/links", { data: { customurl: "routing-ui-" + label, target: "https://192.0.2.1/" + "fallback".repeat(25) }, headers });
      assert.equal(created.status(), 201); const link = await created.json(), url = origin + "/link/routing/" + link.id;
      await page.goto(origin + "/settings/library");
      const row = page.locator(".library-links>li").filter({ hasText: link.address });
      await row.getByRole("link", { name: "Redirect rules", exact: true }).click();
      assert.equal(page.url(), url); await page.getByText("No routing rules", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Add rule", exact: true }).click();
      const first = page.locator(".routing-rule").nth(0);
      await first.getByLabel("Name", { exact: true }).fill("French mobile");
      await first.getByLabel("Destination", { exact: true }).fill("https://192.0.2.1/french");
      await first.getByRole("button", { name: "Add condition", exact: true }).click();
      assert.deepEqual(errors, []);
      const language = first.locator(".routing-condition").nth(1);
      await language.getByLabel("Condition", { exact: true }).selectOption("languages");
      await language.getByLabel("Values (comma-separated)", { exact: true }).fill("fr");
      await page.getByRole("button", { name: "Add rule", exact: true }).click();
      const second = page.locator(".routing-rule").nth(1);
      await second.getByLabel("Name", { exact: true }).fill("Campaign");
      await second.getByLabel("Destination", { exact: true }).fill("https://192.0.2.1/campaign");
      await second.getByLabel("Condition", { exact: true }).selectOption("query");
      await second.getByLabel("Query key", { exact: true }).fill("campaign");
      await second.getByLabel("Value", { exact: true }).fill("summer");
      const preview = page.locator("#routing-preview-form");
      await preview.getByLabel("Device", { exact: true }).selectOption("mobile");
      await preview.getByLabel("Preferred language", { exact: true }).fill("fr-FR");
      await preview.getByLabel("Query string", { exact: true }).fill("campaign=summer");
      await action(preview.getByRole("button", { name: "Preview", exact: true }), "POST");
      assert.match(await page.locator("#routing-result").textContent(), /Rule 1: French mobile/);
      await second.getByRole("button", { name: "Move rule up", exact: true }).click();
      await action(preview.getByRole("button", { name: "Preview", exact: true }), "POST");
      assert.match(await page.locator("#routing-result").textContent(), /Rule 1: Campaign/);
      await action(page.getByRole("button", { name: "Save rules", exact: true }), "PUT");
      assert.equal(await page.locator("#routing-status").textContent(), "Rules saved");
      await page.reload(); await page.getByText("Saved rules", { exact: true }).waitFor();
      assert.equal(await page.locator(".routing-rule").first().getByLabel("Name", { exact: true }).inputValue(), "Campaign");
      await page.screenshot({ path: path.join(evidence, label + "-rules.png"), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + " overflow");
      assert.equal((await context.request.patch(origin + "/api/links/" + link.id, { data: { password: "routing-browser-password" }, headers })).status(), 200);
      await page.route("https://192.0.2.1/campaign", route => route.fulfill({ status: 200, contentType: "text/plain", body: "Routed destination" }));
      await page.goto(origin + "/" + link.address + "?campaign=summer");
      assert.equal(await page.locator('input[name="routing_query"]').inputValue(), "campaign=summer");
      assert(!(await page.content()).includes("https://192.0.2.1/campaign"), "No alternate target before password");
      await page.getByLabel("Password:", { exact: true }).fill("routing-browser-password");
      await page.getByRole("button", { name: "Unlock & Go", exact: true }).click();
      await page.waitForURL("https://192.0.2.1/campaign");
      assert.equal(await page.textContent("body"), "Routed destination");
      await page.goto(url); await page.getByText("Saved rules", { exact: true }).waitFor();
      const endpoint = origin + "/api/links/" + link.id + "/routing", stored = await (await context.request.get(endpoint, { headers })).json();
      assert.equal((await context.request.put(endpoint, { data: { revision: stored.revision, rules: stored.rules }, headers })).status(), 200);
      await page.locator(".routing-rule").first().getByLabel("Name", { exact: true }).fill("Stale tab");
      await action(page.getByRole("button", { name: "Save rules", exact: true }), "PUT", 409);
      assert.match(await page.locator("#routing-status").textContent(), /changed elsewhere/);
      await page.getByRole("button", { name: "Reload saved rules", exact: true }).click();
      await page.getByText("Saved rules", { exact: true }).waitFor();
      assert.equal(await page.locator(".routing-rule").first().getByLabel("Name", { exact: true }).inputValue(), "Campaign");
      while (await page.locator(".routing-rule").count()) await page.getByRole("button", { name: "Remove rule", exact: true }).first().click();
      await action(page.getByRole("button", { name: "Save rules", exact: true }), "PUT");
      await action(preview.getByRole("button", { name: "Preview", exact: true }), "POST");
      assert.match(await page.locator("#routing-result").textContent(), /Default destination/);
      await page.screenshot({ path: path.join(evidence, label + "-fallback.png"), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    assert.deepEqual(errors, []); console.log("PASS: desktop/mobile routing rules, typed conditions, draft preview, priority, save/reload, native password routing, stale conflict recovery, clear fallback and no overflow/page errors; " + evidence);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    console.error({ errors, evidence });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
