const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(process.env.KUTT_BROWSER_DISPOSABLE === "1" && new URL(origin).hostname === "127.0.0.1");
  assert(evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const setup = await browser.newContext();
    const headers = { Accept: "application/json" };
    const bootstrap = await setup.request.post(origin + "/api/auth/create-admin", {
      headers, data: { email: "policy-browser@example.invalid", password: randomBytes(32).toString("hex") }
    });
    assert.equal(bootstrap.status(), 201, "Refuse initialized fixtures");
    const token = (await bootstrap.json()).token;
    await setup.addCookies([{ name: "token", value: token, url: origin }]);
    const errors = [], results = [];
    for (const locale of ["en", "fr", "es"]) {
      const catalog = require("../locales/" + locale + ".json");
      const context = await browser.newContext({ locale });
      await context.addCookies([{ name: "token", value: token, url: origin }]);
      page = await context.newPage(); page.setDefaultTimeout(10000);
      page.on("pageerror", error => errors.push(error.message));
      for (const width of [1440, 390, 320]) for (const theme of ["light", "dark"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(origin + "/settings/destination-policy");
        await page.locator('[data-theme-picker] input[value="' + theme + '"]').check();
        await page.waitForFunction(() => {
          const foreground = getComputedStyle(document.body).color;
          const selector = document.documentElement.dataset.theme === 'dark'
            ? '.site-header a.nav, .language-selector select' : '.site-header a.nav';
          return [...document.querySelectorAll(selector)]
            .every(node => getComputedStyle(node).color === foreground);
        });
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.equal(await page.locator("h1").textContent(), catalog["destination_policy.title"]);
        assert(await page.locator(".destination-policy").innerText().then(text => text.includes("192.0.2.1")));
        assert.equal(await page.locator(".destination-policy input,.destination-policy button,.destination-policy form").count(), 0, "Policy is read-only");
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(evidence, locale + "-" + width + "-" + theme + "-policy.png"), fullPage: true, animations: "disabled" });
        await page.goto(origin + "/");
        const denied = "https://198.51.100.2/keep-my-draft";
        await page.locator("#target").fill(denied);
        await page.locator('#shortener-form button[type="submit"]').click();
        await page.locator("#target[aria-invalid=true]").waitFor();
        assert.equal(await page.locator("#target").inputValue(), denied);
        assert((await page.locator("#shortener-form").innerText()).includes(catalog["destination_policy.denied"]));
        await page.waitForFunction(() => document.querySelector('#target') === document.activeElement);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const allowed = "https://192.0.2.1/" + locale + width + theme;
        await page.locator("#target").fill(allowed);
        await page.locator('#shortener-form button[type="submit"]').click();
        await page.locator("#shorturl .link button").waitFor();
        const list = await context.request.get(origin + "/api/links", { headers });
        assert.equal(list.status(), 200);
        const link = (await list.json()).data.find(row => row.target === allowed);
        assert(link);
        await page.goto(origin + "/");
        await page.locator("#tr-" + link.id + " button.edit").click();
        const editor = page.locator("#edit-form-" + link.id); await editor.waitFor();
        await editor.locator('[name="target"]').fill(denied);
        await editor.locator('[name="description"]').fill("Keep this draft " + locale);
        await editor.locator('button[type="submit"]').click();
        await editor.locator('[name="target"][aria-invalid=true]').waitFor();
        assert.equal(await editor.locator('[name="target"]').inputValue(), denied);
        assert.equal(await editor.locator('[name="description"]').inputValue(), "Keep this draft " + locale);
        assert((await editor.innerText()).includes(catalog["destination_policy.denied"]));
        await page.screenshot({ path: path.join(evidence, locale + "-" + width + "-" + theme + "-rejected-edit.png"), fullPage: true });
        await editor.locator('[name="target"]').fill(allowed);
        await editor.locator('button[type="submit"]').click();
        await editor.getByText(catalog["messages.link_has_been_updated"], { exact: true }).waitFor();
        const redirect = await setup.request.get(origin + "/" + link.address, { maxRedirects: 0 });
        assert.equal(redirect.status(), 302); assert.equal(redirect.headers().location, allowed);
        results.push({ locale, width, theme });
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log("PASS: " + results.length + " translated desktop/mobile theme workflows, read-only host policy, accessible validation, draft preservation, repair and public redirect; " + evidence);
    await setup.close();
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
