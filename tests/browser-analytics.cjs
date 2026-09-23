const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Fresh loopback-only instance required");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-analytics-ui-"));
  const browser = await chromium.launch({ headless: true }); let page; const errors = [];
  try {
    const context = await browser.newContext(), headers = { Accept: "application/json" };
    for (let i = 0; i < 100; i++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const setup = await context.request.post(origin + "/api/auth/create-admin", { data: { email: "analytics-browser@example.invalid", password: randomBytes(32).toString("hex") }, headers });
    assert.equal(setup.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await setup.json()).token, url: origin }]);
    page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    const tagName = "=Campaign " + "long-tag-".repeat(6);
    const tagResponse = await context.request.post(origin + "/api/library/labels", { data: { kind: "tag", name: tagName }, headers });
    assert.equal(tagResponse.status(), 201); const tag = await tagResponse.json();
    const created = await context.request.post(origin + "/api/links", { data: { customurl: "analytics-browser-fixture", target: "https://192.0.2.1/default" }, headers });
    assert.equal(created.status(), 201); const link = await created.json();
    assert.equal((await context.request.post(origin + "/api/library/bulk", { data: { action: "add_label", label_id: tag.id, ids: [link.id] }, headers })).status(), 200);
    for (const userAgent of [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
    ]) assert.equal((await context.request.get(origin + "/" + link.address, { maxRedirects: 0, headers: { "User-Agent": userAgent } })).status(), 302);
    const submit = async () => {
      const waited = page.waitForResponse(r => r.url().includes("/api/analytics?") && r.request().method() === "GET");
      await page.getByRole("button", { name: "Apply", exact: true }).click(); const response = await waited; assert.equal(response.status(), 200, await response.text());
      await page.waitForFunction(() => !document.querySelector("#analytics-report").hidden);
    };
    const today = new Date().toISOString().slice(0, 10), yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport); await page.goto(origin + "/settings/library");
      await page.getByRole("link", { name: "Analytics", exact: true }).click();
      await page.getByText("Report ready", { exact: true }).waitFor();
      assert.equal(await page.locator("#analytics-total").textContent(), "2");
      assert.match(await page.locator('[data-table="browser"]').getByRole("row", { name: /safari/i }).textContent(), /1/);
      await page.getByLabel("Tag", { exact: true }).selectOption(tag.id);
      await page.getByLabel("Domain", { exact: true }).selectOption("default");
      await page.getByLabel("Search links", { exact: true }).fill("analytics-browser");
      await submit();
      assert.equal(await page.locator("#analytics-total").textContent(), "2");
      await page.waitForFunction(() => {
        const c = document.querySelector("#analytics-chart");
        if (!c.width || !c.height) return false;
        const p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let bars = 0;
        for (let i = 0; i < p.length; i += 4) if (p[i] === 38 && p[i + 1] === 123 && p[i + 2] === 162 && p[i + 3]) bars++;
        return bars > 20;
      });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), label + " overflow");
      const layout = await page.evaluate(() => {
        const form = document.querySelector("#analytics-filters"), labels = [...form.querySelectorAll("label")].map(node => node.getBoundingClientRect());
        const table = document.querySelector('[data-table="days"] table'), row = table.querySelector("tbody tr");
        const cell = table.querySelector("td"), body = table.querySelector("tbody");
        return { formHeight: form.getBoundingClientRect().height, labelsSameRow: Math.abs(labels[0].top - labels[1].top) < 2,
          tableDisplay: getComputedStyle(table).display, bodyOpacity: getComputedStyle(body).opacity,
          bodyAnimation: getComputedStyle(body).animationName, rowHeight: row.getBoundingClientRect().height,
          textColor: getComputedStyle(cell).color, shadow: getComputedStyle(table).boxShadow };
      });
      assert(layout.labelsSameRow, label + " date filters share a row");
      assert(layout.formHeight < (label === "desktop" ? 180 : 400), label + " compact filter layout");
      assert.equal(layout.tableDisplay, "table"); assert.equal(layout.bodyOpacity, "1");
      assert.equal(layout.bodyAnimation, "none"); assert.equal(layout.shadow, "none");
      assert(layout.rowHeight > 25 && layout.rowHeight < 65, label + " readable, compact table rows");
      assert.notEqual(layout.textColor, "rgba(0, 0, 0, 0)");
      const navigation = page.getByRole("navigation", { name: "Date pages", exact: true });
      await navigation.getByRole("button", { name: "Next", exact: true }).click();
      assert.match(await navigation.textContent(), /2 \/ 2/);
      await navigation.getByRole("button", { name: "Previous", exact: true }).click();
      await page.screenshot({ path: path.join(evidence, label + "-report.png"), fullPage: true });
      for (const format of ["CSV", "JSON"]) {
        const pending = page.waitForEvent("download"); await page.getByRole("link", { name: format, exact: true }).click();
        const download = await pending, filename = path.join(evidence, label + "." + format.toLowerCase()); await download.saveAs(filename);
        const content = readFileSync(filename, "utf8");
        if (format === "JSON") assert.equal(JSON.parse(content).total, 2);
        else { assert.match(content, /section,name,id,visits,links/); assert(content.includes("'="), "CSV formula escaped"); }
      }
      await page.getByLabel("From (UTC)", { exact: true }).fill(yesterday);
      await page.getByLabel("Through (UTC)", { exact: true }).fill(yesterday); await submit();
      await page.getByText("No tracked visits in this range", { exact: true }).waitFor();
      await page.getByLabel("From (UTC)", { exact: true }).fill(today);
      await page.getByLabel("Through (UTC)", { exact: true }).fill(today); await submit();
      assert.equal(await page.locator("#analytics-total").textContent(), "2");
      await page.route("**/api/analytics?*", route => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: "Test authorization denied" }) }));
      await page.getByRole("button", { name: "Apply", exact: true }).click();
      await page.getByText("Test authorization denied", { exact: true }).waitFor();
      assert(await page.locator("#analytics-report").isHidden());
      await page.unroute("**/api/analytics?*"); await submit();
      await page.reload(); await page.getByText("Report ready", { exact: true }).waitFor();
      assert.equal(await page.getByLabel("Tag", { exact: true }).inputValue(), tag.id);
      await page.screenshot({ path: path.join(evidence, label + "-filtered.png"), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/mobile analytics, date/tag/domain/search filters, data-bearing canvas, table pages, CSV/JSON downloads, empty/error/retry/reload states and no overflow/runtime errors; " + evidence);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    console.error({ errors, evidence }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
