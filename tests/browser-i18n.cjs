// Fresh loopback fixture only; the bootstrap assertion refuses existing installations.
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert(evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const setup = await browser.newContext();
    const headers = { Accept: "application/json" };
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await setup.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Fixture did not start");
    const bootstrap = await setup.request.post(origin + "/api/auth/create-admin", {
      headers, data: { email: "i18n-browser@example.invalid", password: randomBytes(32).toString("hex") }
    });
    assert.equal(bootstrap.status(), 201, "Refuse initialized instances");
    const token = (await bootstrap.json()).token;
    await setup.addCookies([{ name: "token", value: token, url: origin }]);
    const hostile = '<img src=x onerror="window.injected=1"> & $t(ui.admin)';
    const creation = await setup.request.post(origin + "/api/links", {
      headers, data: { target: "https://192.0.2.1/i18n", customurl: "i18n-browser", description: hostile, expire_in: "2 days" }
    });
    assert.equal(creation.status(), 201);
    const link = await creation.json();
    assert.equal((await setup.request.post(origin + "/api/library/labels", { headers, data: { kind: "tag", name: hostile } })).status(), 201);
    const work = await setup.request.post(origin + "/api/workspaces", { headers, data: { name: "i18n-workspace" } });
    assert.equal(work.status(), 201); const workspace = await work.json();
    assert.equal((await setup.request.post(origin + "/api/workspaces/" + workspace.id + "/shares", { headers, data: { link_id: link.id } })).status(), 204);
    const errors = [], measurements = [];
    for (const locale of ["en", "fr", "es"]) {
      const catalog = require("../locales/" + locale + ".json");
      const context = await browser.newContext({ locale: "en-US" });
      const assertTheme = async () => {
        assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
        assert.equal(await page.evaluate(() => localStorage.getItem("kutt.theme")), "dark");
        assert.equal(await page.locator(".theme-picker legend").textContent(), catalog["theme.appearance"]);
        for (const value of ["system", "light", "dark"]) {
          assert.equal(await page.getByRole("radio", { name: catalog["theme." + value], exact: true }).getAttribute("value"), value);
        }
        assert(await page.getByRole("radio", { name: catalog["theme.dark"], exact: true }).isChecked());
        assert(await page.locator("#site-language").evaluate(node => {
          const style = getComputedStyle(node), canvas = document.createElement("canvas"), context = canvas.getContext("2d");
          context.font = style.font;
          return context.measureText(node.selectedOptions[0].textContent.trim()).width <= node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        }), locale + " dark-mode language label fits");
      };
      page = await context.newPage(); page.setDefaultTimeout(10000);
      page.on("pageerror", error => errors.push(locale + ": " + error.message));
      page.on("console", message => { if (message.type() === "error" && !/Failed to load resource.*(?:400|401|404|409)/.test(message.text())) errors.push(locale + ": " + message.text()); });
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        const login = await page.goto(origin + "/login");
        assert.equal(login.headers()["referrer-policy"], "same-origin");
        await page.locator('[data-theme-picker] input[value="dark"]').check();
        await page.locator("#site-language").selectOption(locale);
        const changed = page.waitForResponse(response => response.url() === origin + "/language");
        await page.locator(".language-selector button").click();
        const result = await changed;
        assert.equal(result.status(), 303); assert.equal(result.request().headers().origin, origin);
        await page.waitForLoadState("networkidle");
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        await assertTheme();
        await page.getByRole("radio", { name: catalog["theme.light"], exact: true }).check();
        assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
        await page.getByRole("radio", { name: catalog["theme.dark"], exact: true }).check();
        await page.locator('#login-signup button[type="submit"]').click();
        await page.locator("#login-signup p.error").first().waitFor();
        assert.equal(await page.locator("#login-signup p.error").first().textContent(), catalog["messages.email_is_not_valid"]);
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        await page.screenshot({ path: path.join(evidence, locale + "-" + width + "-login.png"), fullPage: true });
      }
      await context.addCookies([{ name: "token", value: token, url: origin }]);
      await page.goto(origin + "/settings");
      await page.locator("#site-language").selectOption(locale);
      const settingsPreference = page.waitForResponse(response => response.url() === origin + "/language");
      await page.locator(".language-selector button").click();
      const settingsResult = await settingsPreference;
      assert.equal(settingsResult.status(), 303); assert.equal(settingsResult.request().headers().origin, origin);
      await page.waitForLoadState("networkidle");
      await assertTheme();
      await page.goto(origin + "/settings/library?q=i18n-browser");
      await page.locator("#site-language").selectOption(locale);
      const libraryPreference = page.waitForResponse(response => response.url() === origin + "/language");
      await page.locator(".language-selector button").click();
      const libraryResult = await libraryPreference;
      assert.equal(libraryResult.status(), 303); assert.equal(libraryResult.request().headers().origin, origin);
      await page.waitForLoadState("networkidle");
      await assertTheme();
      assert.equal(new URL(page.url()).search, "?q=i18n-browser");
      const preference = (await context.cookies()).find(cookie => cookie.name === "kutt_locale");
      assert(preference.httpOnly && preference.sameSite === "Lax" && preference.value === locale);
      assert(!await page.evaluate(() => document.cookie.includes("kutt_locale")));
      const routes = ["/", "/admin", "/admin/moderation", "/admin/moderation/link/" + link.id, "/settings", "/settings/library", "/settings/trash", "/settings/workspaces/" + workspace.id,
        "/settings/analytics", "/settings/transfer", "/settings/retention", "/settings/integrations", "/settings/health", "/settings/shortcuts", "/settings/security", "/terms",
        ...["routing", "forwarding", "tracking", "health", "history", "qr"].map(name => "/link/" + name + "/" + link.id)];
      for (const width of [1440, 390, 320]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of routes) {
          const response = await page.goto(origin + route); assert.equal(response.status(), 200, locale + route);
          await page.waitForLoadState("domcontentloaded");
          await page.waitForFunction(() => window.KuttI18n && document.querySelector(".site-header"));
          await page.evaluate(() => document.fonts.ready);
          assert.equal(await page.locator("html").getAttribute("lang"), locale);
          assert.equal(await page.evaluate(() => window.KuttI18n.locale), locale);
          await assertTheme();
          assert((await page.title()).length > 6);
          assert((await page.locator("body").innerText()).length > 100);
          assert.equal(await page.locator(".language-selector option:checked").textContent(), ({ en: "English", fr: "Français", es: "Español" })[locale]);
          assert.equal(await page.evaluate(() => window.injected || false), false);
          assert.equal(await page.locator('img[onerror]').count(), 0);
          const clippedSortLabels = await page.locator('.list-sort-controls select:visible').evaluateAll(nodes => {
            const context = document.createElement('canvas').getContext('2d');
            return nodes.filter(node => {
              const style = getComputedStyle(node);
              context.font = style.font;
              return context.measureText(node.selectedOptions[0].textContent.trim()).width >
                node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            }).map(node => node.name);
          });
          assert.deepEqual(clippedSortLabels, [], `${locale} ${width} ${route} selected sorting labels fit`);
          for (const icon of await page.locator('.library-link-meta a svg[fill=none]').all()) {
            if (await page.locator('html').getAttribute('data-theme') === 'dark') {
              assert(await icon.evaluate(node => getComputedStyle(node).stroke === getComputedStyle(node.closest('a')).color),
                locale + ' dark library icons inherit readable link color');
            }
          }
          const geometry = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
          assert(geometry.content <= width + 1, locale + " " + width + " " + route + " overflow: " + JSON.stringify(geometry));
          if (width <= 600 && route === "/settings/library") {
            const filters = await page.locator(".library-filters").boundingBox();
            for (const field of await page.locator(".library-filters > label").all()) {
              assert((await field.boundingBox()).width >= filters.width - 1, "Translated mobile filter labels need full width");
            }
          }
          measurements.push({ locale, width, route });
          if (["/settings/library", "/settings", "/settings/security"].includes(route)) await page.screenshot({ path: path.join(evidence, locale + "-" + width + "-" + route.split("/").pop() + ".png"), fullPage: true, animations: "disabled" });
        }
        await page.goto(origin + "/"); await page.waitForLoadState("networkidle");
        await page.locator("#tr-" + link.id + " button.edit").click();
        const editor = page.locator("#edit-form-" + link.id); await editor.waitFor();
        const duration = await editor.locator('[name="expire_in"]').inputValue();
        assert(/days?/.test(duration), "Machine-readable duration remains unchanged");
        await editor.locator('[name="description"]').fill(hostile + " " + locale + width);
        await editor.locator('button[type="submit"]').click();
        await editor.getByText(catalog["messages.link_has_been_updated"], { exact: true }).waitFor();
        assert.equal(await editor.locator('[name="description"]').inputValue(), hostile + " " + locale + width);
        assert.equal(await page.evaluate(() => window.injected || false), false);
        await page.goto(origin + "/settings/library?q=i18n-browser");
        await page.locator('input[name="ids"]').check();
        assert.equal(await page.locator("#library-selection").textContent(), catalog["library.selected_one"].replace("{{count}}", "1"));
        await page.locator("#library-action").selectOption("pause");
        await page.locator("#library-apply").click(); await page.waitForLoadState("networkidle");
        assert.equal(await page.locator(".library-notice").textContent(), catalog["library.bulk_applied_one"].replace("{{action}}", catalog["ui.pause"]).replace("{{count}}", "1"));
        await page.reload(); assert.equal(await page.locator("html").getAttribute("lang"), locale);
      }
      // A browser transport exception uses the selected catalog rather than native English errors.
      assert.equal(await page.evaluate(() => window.KuttI18n.failure(new TypeError("Failed to fetch"))), catalog["common.request_failed"]);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log("PASS: " + measurements.length + " localized desktop/mobile page layouts, native locale forms preserving theme preferences, translated theme controls, hostile values, HTMX editing, unchanged expiry syntax, plural selection/bulk notices, and runtime/console checks; " + evidence);
    await setup.close();
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
