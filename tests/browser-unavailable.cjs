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
    for (let i = 0; i < 100; i++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break; await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready);
    const setup = await context.request.post(origin + "/api/auth/create-admin", { headers, data: { email: "recipient@example.invalid", password: randomBytes(32).toString("hex") } });
    assert.equal(setup.status(), 201, "Refuse initialized fixtures");
    const token = (await setup.json()).token, rows = [];
    for (const [name, state] of Object.entries({ paused: { paused: true }, scheduled: { starts_at: new Date(Date.now() + 3600000).toISOString() },
      expired: { ends_at: new Date(Date.now() - 60000).toISOString() }, capped: { max_visits: 1 } })) {
      const created = await context.request.post(origin + "/api/links", { headers: { ...headers, Cookie: "token=" + token }, data: {
        target: "https://example.org/private-destination", customurl: "recipient-" + name, ...state
      }});
      assert.equal(created.status(), 201); const link = await created.json(); rows.push(link);
      if (name === "capped") assert.equal((await context.request.get(origin + "/" + link.address, { maxRedirects: 0 })).status(), 302);
    }
    await context.clearCookies();
    const page = await context.newPage(), errors = [], consoleErrors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error" && !message.text().includes("410 (Gone)")) consoleErrors.push(message.text()); });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const link of rows) {
        const reply = await page.goto(origin + "/" + link.address);
        assert.equal(reply.status(), 410); assert.equal(reply.headers()["cache-control"], "no-store");
        await page.waitForLoadState("networkidle");
        assert((await page.title()).endsWith(" | Link unavailable"));
        const main = page.getByRole("main", { name: "Link unavailable" });
        assert.equal(await main.getByRole("heading", { name: "Link unavailable", level: 1 }).count(), 1);
        assert((await main.textContent()).includes("Ask the person who shared it for an updated link."));
        assert(!(await page.content()).includes("private-destination"));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const home = main.getByRole("link", { name: "Back to homepage", exact: true }); await home.focus();
        assert(await home.evaluate(element => document.activeElement === element));
        await page.screenshot({ path: path.join(evidence, link.address + "-" + width + ".png"), fullPage: true, animations: "disabled" });
        await page.keyboard.press("Enter"); await page.waitForURL(origin + "/login");
        await page.getByRole("button", { name: "Log in", exact: true }).waitFor();
        assert.equal((await context.request.get(origin + "/api/links", { headers })).status(), 401);
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    console.log("PASS: twelve public unavailable recipient pages, desktop/mobile/compact headings/title/landmark, private destination, keyboard homepage recovery, no overflow/script errors and management remains private");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
