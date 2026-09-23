// Refuse existing installations; all records belong to a disposable loopback fixture.
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
  const errors = [], results = [];
  let page;
  try {
    const setup = await browser.newContext();
    const headers = { Accept: "application/json" };
    const bootstrap = await setup.request.post(origin + "/api/auth/create-admin", {
      headers, data: { email: "schedule-browser@example.invalid", password: randomBytes(32).toString("hex") }
    });
    assert.equal(bootstrap.status(), 201, "Refuse initialized instances");
    const token = (await bootstrap.json()).token;
    for (const locale of ["en", "fr", "es"]) for (const theme of ["light", "dark"]) {
      const t = key => require("../locales/" + locale + ".json")[key];
      // A DST-observing browser zone must not reinterpret explicitly UTC controls.
      const context = await browser.newContext({ locale, colorScheme: theme, timezoneId: "America/New_York" });
      await context.addCookies([{ name: "token", value: token, url: origin }]);
      page = await context.newPage(); page.setDefaultTimeout(10000);
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
      const settled = () => page.waitForFunction(() => !document.querySelector(".htmx-settling, .htmx-request"));
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        const response = await page.goto(origin);
        assert.equal(response.status(), 200); assert.equal(new URL(page.url()).pathname, "/");
        assert.match(await page.title(), /\S.*\|/);
        assert.equal(await page.locator('#shortener-form').count(), 1);
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert(response.headers()["content-security-policy"], "Enforced CSP must stay enabled");
        await page.locator('input[data-ui-advanced]').check();
        assert.equal(await page.locator('#shortener-form [name="expire_in"]').count(), 0);
        const set = async (name, value) => {
          await page.locator(`#${name}-display`).focus();
          await page.keyboard.press("Enter");
          const dialog = page.locator(`#${name}-picker`);
          await dialog.waitFor({ state: "visible" });
          assert.equal(await page.locator(`#${name}-display`).getAttribute("aria-expanded"), "true");
          await dialog.locator('[type="date"]').fill(value.slice(0, 10));
          await dialog.locator('[type="time"]').fill(value.slice(11));
          await dialog.getByRole("button", { name: t("schedule.apply"), exact: true }).click();
          await dialog.waitFor({ state: "hidden" });
          assert.equal(await page.locator(`#${name}-display`).inputValue(), value.replace("T", " "));
          assert.equal(await page.locator(`#${name}`).inputValue(), value);
          assert.equal(await page.locator(`#${name}-display`).evaluate(node => node === document.activeElement), true);
        };
        await set("starts_at", "2080-03-10T02:30:15");
        await set("ends_at", "2080-03-11T18:45:59");
        await page.locator('#starts_at-display').click();
        await page.locator('#starts_at-picker [type="date"]').fill("2081-01-01");
        await page.keyboard.press("Escape");
        assert.equal(await page.locator('#starts_at-display').inputValue(), "2080-03-10 02:30:15");
        await page.locator('#ends_at-display').click();
        await page.locator('#ends_at-picker [type="date"]').fill("");
        await page.locator('#ends_at-picker [data-date-time-apply]').click();
        assert.equal(await page.locator('#ends_at-picker [role="alert"]').innerText(), t("schedule.invalid"));
        await page.screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}-picker.png`), fullPage: true });
        await page.locator('#ends_at-picker [data-date-time-cancel]').click();
        assert.equal(await page.locator('#ends_at-display').inputValue(), "2080-03-11 18:45:59");
        await page.locator('#starts_at-display').click();
        await page.locator('#starts_at-picker [type="date"]').fill("1969-01-01");
        await page.locator('#starts_at-picker [data-date-time-cancel]').click();
        assert.equal(await page.locator('#starts_at-picker [type="date"]').isDisabled(), true,
          "Cancelled invalid drafts must not block the parent form's native validity");
        const alias = `schedule-${locale}-${theme}-${width}`;
        await page.locator('#target').fill("https://192.0.2.1/schedule");
        await page.locator('#customurl').fill(alias);
        const save = page.waitForResponse(r => r.url() === origin + "/api/links" && r.request().method() === "POST");
        if (locale === "en" && theme === "light" && width === 1440) {
          let release, reached;
          const gate = new Promise(resolve => { release = resolve; });
          const intercepted = new Promise(resolve => { reached = resolve; });
          const hold = async route => { reached(route.request().postData()); await gate; await route.continue(); };
          await page.route(origin + "/api/links", hold);
          try {
            await page.locator('#shortener-submit').click();
            const body = new URLSearchParams(await intercepted);
            assert.equal(body.get('starts_at'), "2080-03-10T02:30:15");
            assert.equal(body.get('ends_at'), "2080-03-11T18:45:59");
            for (const name of ['starts_at', 'ends_at']) {
              assert.equal(await page.locator(`#${name}-display`).isDisabled(), true);
              assert.equal(await page.locator(`#${name}-display`).locator('..').locator('button').isDisabled(), true);
              assert.equal(await page.locator(`#${name}`).isDisabled(), false);
            }
          } finally { release(); }
          assert.equal((await save).status(), 200);
          await page.unroute(origin + "/api/links", hold);
        } else {
          await page.locator('#shortener-submit').click(); assert.equal((await save).status(), 200);
        }
        await page.locator('#shorturl .link').waitFor();
        await settled();
        const links = await context.request.get(origin + "/api/links", { headers });
        const link = (await links.json()).data.find(value => value.address === alias);
        assert(link); assert.equal(link.starts_at, "2080-03-10T02:30:15.000Z");
        assert.equal(link.ends_at, "2080-03-11T18:45:59.000Z"); assert.equal(link.expire_in, null);
        assert.equal((await context.request.get(origin + "/" + alias, { maxRedirects: 0 })).status(), 410);
        assert.equal(await page.locator('#starts_at-display').inputValue(), "2080-03-10 02:30:15", "Preserved across HTMX swaps");
        // A validation rerender must preserve both dates and expose a visible error.
        await page.locator('#customurl').fill("not valid");
        const reject = page.waitForResponse(r => r.url() === origin + "/api/links" && r.request().method() === "POST");
        await page.locator('#shortener-submit').click(); await reject;
        await page.locator('#shortener-form p.error:visible').first().waitFor();
        await settled();
        assert.equal(await page.locator('#target').inputValue(), "https://192.0.2.1/schedule");
        assert.equal(await page.locator('#ends_at-display').inputValue(), "2080-03-11 18:45:59");
        await page.locator('#customurl').fill(alias + "-open");
        for (const name of ["starts_at", "ends_at"]) {
          await page.locator(`#${name}-display`).click();
          await page.locator(`#${name}-picker [data-date-time-clear]`).click();
          assert.equal(await page.locator(`#${name}`).inputValue(), "");
          assert.equal(await page.locator(`#${name}-display`).inputValue(), "");
        }
        const cleared = page.waitForResponse(r => r.url() === origin + "/api/links" && r.request().method() === "POST");
        await page.locator('#shortener-submit').click(); await cleared;
        await page.locator('#shorturl .link').waitFor();
        await settled();
        const active = await context.request.get(origin + "/" + alias + "-open", { maxRedirects: 0 });
        assert.equal(active.status(), 302);
        await set("starts_at", "2080-03-10T02:30:15"); await set("ends_at", "2080-03-11T18:45:59");
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "No horizontal page overflow");
        for (const name of ["starts_at", "ends_at"]) {
          assert(await page.locator(`#${name}-display`).evaluate(node => {
            const c = document.createElement("canvas").getContext("2d"), s = getComputedStyle(node); c.font = s.font;
            return c.measureText(node.value).width <= node.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
          }), "Full date and seconds must fit");
        }
        await page.locator('#advanced-options').scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}-result.png`), fullPage: true });
        await page.locator('#advanced-options').screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}-fields.png`) });
        results.push({ locale, theme, width, saved: true, seconds: true, cleared: true });
      }
      await context.close();
    }
    assert.deepEqual(errors, []);
    writeFileSync(path.join(evidence, "receipt.json"), JSON.stringify({ results, errors }, null, 2));
    console.log("PASS: 18 localized/theme/width schedule workflows, exact seconds, UTC, cancellation, clearing, HTMX drafts, persisted redirects and CSP");
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
      console.error({ title: await page.title(), body: (await page.locator("body").innerText()).slice(0, 2500), errors });
    }
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
