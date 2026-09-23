const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, "127.0.0.1"); assert(evidence);
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [], errors = [];
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.fixtureCopies = [];
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { async writeText(value) { window.fixtureCopies.push(value); } } });
    });
    const response = await context.request.post(origin + "/api/auth/create-admin", {
      data: { email: "domain-proof@example.invalid", password: randomBytes(32).toString("hex") }, headers: { Accept: "application/json" }
    });
    assert.equal(response.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await response.json()).token, url: origin }]);
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [1440, 390, 320]) {
      const address = (width === 1440 ? "notwww." : width === 390 ? "sub.www." : "") + "ownership-" + width + ".example.invalid";
      await page.setViewportSize({ width, height: 900 }); await page.goto(origin + "/settings");
      // Widen HTMX's visible-but-not-initialized window. This form must override
      // delayed settling, otherwise a quick submit navigates to Settings by GET.
      await page.evaluate(() => { htmx.config.defaultSettleDelay = 500; });
      await page.locator(".show-domain-form").click();
      await page.locator('#add-domain input[name="address"]').fill(address);
      const challengeResponse = page.waitForResponse(response => new URL(response.url()).pathname === "/api/domains" && response.request().method() === "POST");
      await page.locator("#add-domain").getByRole("button", { name: "Add domain", exact: true }).click();
      const challenge = await challengeResponse;
      assert.equal(challenge.status(), 200, "Settings must render a DNS ownership challenge, including for administrators");
      assert((await challenge.text()).includes('name="proof"'), "Settings must issue a signed DNS challenge before claiming a domain");
      await page.locator("#add-domain").getByRole("button", { name: "Verify ownership", exact: true }).waitFor();
      assert.equal(await page.locator('#add-domain input[name="address"]').inputValue(), address);
      assert((await page.locator(".domain-verification").textContent()).includes("_kutt-verification." + address));
      for (const label of ["Copy DNS record name", "Copy DNS record value"]) {
        const button = page.getByRole("button", { name: label, exact: true });
        const value = await button.getAttribute("data-url");
        assert(await button.locator("svg").evaluate(el => { const rect = el.getBoundingClientRect(); return rect.width >= 18 && rect.height >= 18; }), "Copy icon is visible, not a blank button");
        await button.click(); await button.locator("..").getByRole("status").getByText("Copied.", { exact: true }).waitFor();
        assert.equal(await page.evaluate(() => window.fixtureCopies.at(-1)), value);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "DNS records fit the viewport");
      await page.screenshot({ path: path.join(evidence, "dns-proof-" + width + ".png") });
      await page.locator("#add-domain").getByRole("button", { name: "Verify ownership", exact: true }).click();
      await page.locator("#add-domain").waitFor({ state: "detached" });
      await page.getByRole("button", { name: "Delete domain " + address, exact: true }).waitFor();
      await page.reload(); await page.getByRole("button", { name: "Delete domain " + address, exact: true }).waitFor();
      results.push({ width, challengeVisible: true, verified: true, persisted: true, overflow: false });
    }
    await page.route("**/api/v2/events", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ cursor: "1", data: [{
      id: "fixture-moderation", type: "link.updated", sequence: "1", occurred_at: new Date().toISOString(),
      data: { link_id: "fixture-link", fields: ["banned"] }, delivery: { status: "not_queued", reason: "CAPACITY_LIMIT" }
    }] }) }));
    await page.goto(origin + "/settings/integrations");
    await page.getByText("Moderation saved. Webhook notification was not queued because delivery capacity was reached.", { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(evidence, "moderation-notification-320.png") });
    assert.deepEqual(errors, []);
    writeFileSync(path.join(evidence, "results.json"), JSON.stringify({ results, errors, dns: "explicit offline TXT fixture", productionData: false }, null, 2));
    console.log("PASS: domain DNS ownership challenge, preserved draft, successful claim and reload at 1440/390/320px");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
