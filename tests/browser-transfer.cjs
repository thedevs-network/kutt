const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, mkdtempSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Use a fresh loopback-only instance");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-transfer-ui-"));
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Disposable instance did not become ready");
    const account = { email: "browser-transfer@example.invalid", password: randomBytes(32).toString("hex") };
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", { data: account, headers: { Accept: "application/json" } });
    assert.equal(bootstrap.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    page = await context.newPage(); const errors = [], consoleErrors = [];
    let injectedFailure = false;
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() !== "error") return;
      if (/Failed to load resource:.*400 \(Bad Request\)/.test(message.text())) return;
      if (injectedFailure && /Failed to load resource:.*503 \(Service Unavailable\)/.test(message.text())) return;
      consoleErrors.push(message.text());
    });
    let releaseScript;
    const held = new Promise(resolve => { releaseScript = resolve; });
    const holdScript = async route => { await held; await route.continue(); };
    await page.route("**/scripts/transfer.js", holdScript);
    await page.goto(origin + "/settings/transfer", { waitUntil: "commit" });
    await page.locator("#transfer-import").waitFor();
    assert(await page.getByRole("button", { name: "Dry run", exact: true }).isDisabled(), "No submit before the script is ready");
    assert.equal(await page.locator("#transfer-import").getAttribute("method"), "post", "Never send private import content in a URL");
    releaseScript(); await page.waitForLoadState("load");
    await page.unroute("**/scripts/transfer.js", holdScript);
    const dryRun = async () => {
      const response = page.waitForResponse(row => row.url().endsWith("/transfer/preview"));
      await page.getByRole("button", { name: "Dry run", exact: true }).click();
      const result = await response; assert.equal(result.status(), 200, await result.text());
      await page.getByRole("status").getByText(/Dry run complete|Correct the reported errors/).waitFor();
    };
    const confirm = async () => {
      const response = page.waitForResponse(row => row.url().endsWith("/transfer/commit"));
      await page.getByRole("button", { name: "Confirm import", exact: true }).click();
      const result = await response; assert([200, 201].includes(result.status()), await result.text());
      await page.getByRole("status").getByText(/Import complete/).waitFor();
    };
    for (const [mode, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844], ["compact", 320, 720]]) {
      await page.setViewportSize({ width, height });
      await page.goto(origin + "/settings/library");
      await page.getByRole("link", { name: "Import and export", exact: true }).click();
      await page.getByRole("heading", { name: "Import and export", exact: true }).waitFor();
      const form = page.getByRole("form", { name: "Import links", exact: true });
      await page.waitForFunction(() => !document.querySelector('#transfer-import button[type="submit"]').disabled);
      const contentField = form.getByLabel("Content", { exact: true });
      await contentField.fill('{"bad":true}');
      await page.getByRole("button", { name: "Dry run", exact: true }).click();
      await page.getByRole("status").getByText(/Start with the JSON template/).waitFor();
      assert.equal(await contentField.inputValue(), '{"bad":true}');
      assert.equal(await contentField.getAttribute("aria-invalid"), "true");
      assert(await page.locator("#transfer-status").evaluate(node => node === document.activeElement));
      await page.screenshot({ path: path.join(evidence, `transfer-correction-${mode}.png`), fullPage: true });
      for (const format of ["json", "csv"]) {
        const download = page.waitForEvent("download");
        const templateLink = page.getByRole("link", { name: format.toUpperCase() + " template", exact: true });
        await templateLink.focus(); await templateLink.press("Enter");
        const file = await download;
        assert.equal(file.suggestedFilename(), "kutt-import-template." + format);
        const bytes = readFileSync(await file.path());
        await form.getByLabel("File", { exact: true }).setInputFiles({ name: file.suggestedFilename(), mimeType: format === "json" ? "application/json" : "text/csv", buffer: bytes });
        await page.waitForFunction(value => document.querySelector('textarea[name="content"]').value === value, bytes.toString());
        assert.equal(await contentField.getAttribute("aria-invalid"), null);
        await dryRun();
        assert.equal(await page.locator("#transfer-rows tr").count(), 1);
        await contentField.fill(await contentField.inputValue() + "\n");
        assert(await page.locator("#transfer-commit").isDisabled());
        await page.getByRole("status").getByText("Draft changed. Run a new dry run before confirming.", { exact: true }).waitFor();
      }
      await form.getByLabel("Import format").selectOption("csv");
      const invalidCSV = "address,target,paused\nexample-link,https://example.org/page,yes";
      await contentField.fill(invalidCSV);
      await page.getByRole("button", { name: "Dry run", exact: true }).click();
      await page.getByRole("status").getByText(/Row 1, paused: Use true or false/).waitFor();
      assert.equal(await contentField.inputValue(), invalidCSV);
      await contentField.fill(invalidCSV.replace(",yes", ",true"));
      await dryRun();
      if (mode === "desktop") {
        const kept = await contentField.inputValue();
        const reject = route => route.fulfill({ status: 503, contentType: "text/html", body: "<h1>WAF unavailable</h1>" });
        await page.route("**/api/v2/transfer/preview", reject); injectedFailure = true;
        await page.getByRole("button", { name: "Dry run", exact: true }).click();
        await page.getByRole("status").getByText("Request failed (503).", { exact: true }).waitFor();
        assert.equal(await contentField.inputValue(), kept);
        assert.equal(await contentField.getAttribute("aria-invalid"), null, "Network failure does not label valid content invalid");
        assert(await page.locator("#transfer-preview").isHidden());
        await page.waitForLoadState("networkidle"); injectedFailure = false;
        await page.unroute("**/api/v2/transfer/preview", reject);
        await dryRun();
        await form.getByLabel("File", { exact: true }).setInputFiles({ name: "too-large.json", mimeType: "application/json", buffer: Buffer.alloc(900001, "x") });
        await page.getByRole("status").getByText(/Current content was not replaced/).waitFor();
        assert.equal(await contentField.inputValue(), kept);
        assert.equal(await form.getByLabel("Import format").inputValue(), "csv");
        assert(await page.locator("#transfer-commit").isDisabled());
      }
      const address = "transfer-ui-" + mode;
      const content = JSON.stringify([{ address, target: "https://192.0.2.1/browser-transfer", description: 'Quoted, "value"\nDocument', tags: ["UI " + mode] }]);
      await form.getByLabel("File", { exact: true }).setInputFiles({ name: "links.json", mimeType: "application/json", buffer: Buffer.from(content) });
      await page.waitForFunction(value => document.querySelector('textarea[name="content"]').value === value, content);
      await dryRun();
      assert.equal(await page.locator("#transfer-rows tr").count(), 1);
      assert.equal(await page.locator(".transfer thead").evaluate(el => getComputedStyle(el).display), mode === "desktop" ? "table-header-group" : "none");
      if (mode === "desktop") assert((await page.locator(".transfer th").first().boundingBox()).height < 40, "Preview headings remain readable");
      const heading = await page.locator(".transfer .archive-heading").boundingBox();
      const exportHeading = await page.getByRole("heading", { name: "Export links", exact: true }).boundingBox();
      assert(exportHeading.y >= heading.y + heading.height, "Page navigation cannot overlap export controls");
      const before = await context.request.get(origin + "/api/v2/library?q=" + address, { headers: { Accept: "application/json" } });
      assert.equal(before.status(), 200);
      assert.equal((await before.json()).total, 0, "Dry run does not create links");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), mode + " overflow");
      await page.screenshot({ path: path.join(evidence, `transfer-${mode}.png`), fullPage: true });
      await confirm();
      assert.equal((await context.request.get(origin + "/" + address, { maxRedirects: 0 })).status(), 302);
      const exporting = page.getByRole("form", { name: "Export links", exact: true });
      await exporting.getByRole("searchbox").fill(address);
      for (const format of ["json", "csv"]) {
        await exporting.getByLabel("Export format").selectOption(format);
        const download = page.waitForEvent("download");
        await exporting.getByRole("button", { name: "Download", exact: true }).click();
        const file = await download;
        assert.equal(file.suggestedFilename(), "kutt-links." + format);
        const bytes = readFileSync(await file.path()); assert(bytes.includes(Buffer.from(address)));
        if (format === "json") assert.equal(JSON.parse(bytes).links[0].description, 'Quoted, "value"\nDocument');
        else {
          await form.getByLabel("File", { exact: true }).setInputFiles({ name: "links.csv", mimeType: "text/csv", buffer: bytes });
          await page.waitForFunction(() => document.querySelector('#transfer-import select[name="format"]').value === "csv");
        }
      }
      await dryRun(); assert(await page.getByRole("button", { name: "Confirm import", exact: true }).isDisabled());
      await form.getByLabel("Alias conflicts").selectOption("rename");
      await dryRun();
      await form.getByLabel("Content", { exact: true }).fill(await form.getByLabel("Content", { exact: true }).inputValue() + "\n");
      assert(await page.locator("#transfer-commit").isDisabled(), "Changing input invalidates confirmation");
      assert(await page.locator("#transfer-preview").isHidden());
      await dryRun(); await confirm();
      await page.reload();
      await exporting.getByRole("searchbox").fill(address);
      await form.getByLabel("Content", { exact: true }).fill(JSON.stringify([{ address: "protected-" + mode, target: "https://192.0.2.1/", password_required: true }]));
      await form.getByLabel("Import format").selectOption("json");
      await dryRun();
      await page.getByText("Protected link requires an explicit replacement password.", { exact: true }).waitFor();
      assert(await page.getByRole("button", { name: "Confirm import", exact: true }).isDisabled());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), mode + " error overflow");
      await page.screenshot({ path: path.join(evidence, `transfer-errors-${mode}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(consoleErrors, []);
    console.log(`PASS: desktop/mobile/compact templates, schema correction and error focus, file import, dry run, commit, public redirect, CSV/JSON downloads, conflict correction, invalidation and protected-link error; ${evidence}`);
  } catch (error) {
    if (page) console.error("Transfer failure state", await page.evaluate(() => ({ path: location.pathname,
      queryFields: [...new URLSearchParams(location.search).keys()], status: document.querySelector("#transfer-status")?.textContent,
      draftLength: document.querySelector('#transfer-import textarea')?.value.length })));
    if (page) await page.screenshot({ path: path.join(evidence, "transfer-failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
