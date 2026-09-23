const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, "127.0.0.1"); assert(evidence); mkdirSync(evidence, { recursive: true });
  const mode = process.env.KUTT_TEST_CSP_MODE || "enforce";
  assert(["enforce", "report-only"].includes(mode));
  const browser = await chromium.launch({ headless: true }); let page;
  try {
    const setup = await browser.newContext(), headers = { Accept: "application/json" };
    const account = { email: "csp-browser@example.invalid", password: randomBytes(32).toString("hex") };
    const bootstrap = await setup.request.post(origin + "/api/auth/create-admin", { headers, data: account });
    assert.equal(bootstrap.status(), 201, "Fresh disposable fixture required");
    const token = (await bootstrap.json()).token;
    await setup.addCookies([{ name: "token", value: token, url: origin }]);
    const links = [];
    for (let i = 0; i < 12; i++) {
      const response = await setup.request.post(origin + "/api/links", { headers, data: {
        target: "https://192.0.2.1/csp-target", customurl: "csp-fixture-" + i,
        ...(i >= 1 && i <= 6 && { password: "csp-synthetic-password" })
      } });
      assert.equal(response.status(), 201); links.push(await response.json());
    }
    const link = links[links.length - 1];
    const errors = [], violations = [];
    const locales = mode === "enforce" ? ["en", "fr", "es"] : ["en"];
    for (const locale of locales) for (const theme of mode === "enforce" ? ["light", "dark"] : ["light"]) {
      const protectedLink = links[locales.indexOf(locale) * 2 + (theme === "dark" ? 1 : 0) + 1];
      const catalog = require("../locales/" + locale + ".json"), context = await browser.newContext({ locale, colorScheme: theme });
      let probing = false; const probeViolations = [];
      await context.exposeBinding("recordCSP", (_, value) => (probing ? probeViolations : violations).push(value));
      await context.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", event => window.recordCSP({ directive: event.effectiveDirective, disposition: event.disposition, blocked: event.blockedURI }));
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { async writeText(value) { window.copiedText = value; } } });
      });
      await context.route("**/*", route => {
        const url = route.request().url();
        if (new URL(url).origin === origin) return route.continue();
        if (url === protectedLink.target) return route.fulfill({ contentType: "text/html", body: "<h1>Synthetic target</h1>" });
        return route.abort();
      });
      page = await context.newPage(); page.setDefaultTimeout(12000);
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        if (message.type() === "error" && !probing && !/Failed to load resource.*(?:400|401|404|409)/.test(message.text())) errors.push(message.text());
      });
      const navigate = async route => {
        const response = await page.goto(origin + route); assert.equal(response.status(), 200, route);
        assert(response.headers()[mode === "enforce" ? "content-security-policy" : "content-security-policy-report-only"]);
        await page.waitForFunction(() => window.htmx && window.KuttI18n);
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
        assert.equal(await page.evaluate(() => htmx.config.allowEval), mode !== "enforce");
        assert.equal(await page.evaluate(() => htmx.config.allowScriptTags), mode !== "enforce");
        assert.deepEqual(await page.evaluate(() => htmx.config.attributesToSettle), ["class", "width", "height"]);
      };
      await navigate("/login");
      await page.locator('#login-signup [name="email"]').fill(account.email);
      await page.locator('#login-signup [name="password"]').fill(account.password);
      await page.locator('#login-signup button[type="submit"]').click();
      await page.waitForURL(origin + "/"); await page.locator("#tr-" + link.id).waitFor();
      for (const width of mode === "enforce" ? [1440, 390, 320] : [1440]) {
        await page.setViewportSize({ width, height: 900 });
        await navigate("/"); await page.locator("#tr-" + link.id).waitFor();
        await page.locator('[name="show_advanced"]').check(); assert(await page.locator("#advanced-options").isVisible());
        await page.locator('[name="show_advanced"]').uncheck(); assert(await page.locator("#advanced-options").isHidden());
        const copy = page.locator("#tr-" + link.id + " [data-ui-copy]").first(); await copy.click();
        await page.waitForFunction(expected => window.copiedText === expected, link.link);
        await page.locator('#main-table-wrapper [data-ui-limit]').filter({ hasText: /^20$/ }).first().click();
        await page.waitForFunction(() => document.getElementById("limit")?.value === "20");
        await page.waitForLoadState("networkidle");
        await page.locator('#main-table-wrapper [data-ui-limit]').filter({ hasText: /^10$/ }).first().click();
        await page.waitForLoadState("networkidle");
        await page.locator('#main-table-wrapper [data-ui-page="next"]').first().click();
        await page.waitForFunction(() => document.getElementById("skip")?.value === "10");
        await page.waitForLoadState("networkidle");
        await page.locator('#main-table-wrapper [data-ui-page="prev"]').first().click();
        await page.waitForFunction(() => document.getElementById("skip")?.value === "0");
        await page.waitForLoadState("networkidle");
        await page.locator("#tr-" + link.id + " button.edit").click();
        const editor = page.locator("#edit-form-" + link.id); await editor.waitFor();
        const description = "CSP " + locale + " " + theme + " " + width;
        await editor.locator('[name="description"]').fill(description);
        await editor.locator('button[type="submit"]').click();
        await editor.getByText(catalog["messages.link_has_been_updated"], { exact: true }).waitFor();
        await editor.locator("[data-ui-edit-close]").click(); await editor.waitFor({ state: "detached" });
        assert.equal(await page.evaluate(() => document.activeElement.id), "edit-opener-" + link.id);
        await navigate("/stats?id=" + link.id);
        await page.waitForFunction(() => document.querySelectorAll("canvas.visits").length && Chart.getChart(document.querySelector("canvas.visits")));
        await page.locator('[data-ui-stats-period][data-period="year"]').click();
        assert(await page.locator('canvas.visits[data-period="year"]').isVisible());
        assert(await page.locator('canvas.visits[data-period="year"]').evaluate(canvas => canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data.some((v, i) => i % 4 === 3 && v > 0)));
        await page.locator("[data-ui-map] path[data-id]").first().dispatchEvent("mousemove");
        assert(await page.locator("#map-tooltip").evaluate(node => node.classList.contains("visible") && !!node.dataset.tooltip));
        await page.locator("[data-ui-map] path[data-id]").first().dispatchEvent("pointerup");
        await page.screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}-stats.png`), fullPage: true });
        await navigate("/admin"); await page.locator("#tr-" + link.id).waitFor();
        await page.locator("#tr-" + link.id + " [data-ui-qr-dialog]").click();
        await page.locator("dialog[open] canvas").waitFor({ state: "attached" });
        await page.locator("dialog[open] .dialog-close").click(); assert.equal(await page.locator("dialog[open]").count(), 0);
        await page.locator("#tab-users").click(); await page.locator("[hx-get='/create-user']").waitFor();
        await page.locator("[hx-get='/create-user']").click(); await page.locator("dialog[open] #create-user-verified").waitFor();
        await page.locator("#create-user-verified").check(); await page.locator("#create-user-verified").uncheck();
        await page.locator("dialog[open] .dialog-close").click();
        await navigate("/settings");
        await page.locator(".show-domain-form").click(); await page.locator("#add-domain").waitFor();
        assert(await page.locator(".show-domain-form").isHidden());
        await page.locator("[data-ui-domain-cancel]").click(); assert(await page.locator(".show-domain-form").isVisible());
        await page.locator("#site-language").selectOption(locale);
        await page.locator(".language-selector button").click(); await page.waitForLoadState("networkidle");
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        const domainLabel = await page.locator('select[name="domain_scope"]').evaluate(async select => {
          await document.fonts.ready;
          const style = getComputedStyle(select), context = document.createElement("canvas").getContext("2d");
          context.font = style.font;
          const label = select.selectedOptions[0].textContent.trim();
          return { label, text: context.measureText(label).width,
            available: select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 22 };
        });
        assert(domainLabel.text <= domainLabel.available, `Token domain label fits at ${locale}/${theme}/${width}: ${JSON.stringify(domainLabel)}`);
        await page.screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}-settings.png`), fullPage: true });
        await navigate("/" + protectedLink.address);
        await page.locator("#protected-link-password").fill("csp-synthetic-password");
        await page.locator('#report-form button[type="submit"]').click(); await page.waitForURL(protectedLink.target);
      }
      await navigate("/settings"); assert.deepEqual(violations, []); assert.deepEqual(errors, []);
      probing = true;
      await page.route("**/csp-fixture.js", route => route.fulfill({ contentType: "application/javascript", body: "window.cspExternal = true;" }));
      // Execute outside Runtime.evaluate, which can bypass CSP's eval restriction.
      await page.route("**/csp-trusted-fixture.js", route => route.fulfill({ contentType: "application/javascript", body:
        'window.cspTrusted = true; try { new Function("window.cspEval = true")(); } catch {} window.cspProbeDone = true;' }));
      await page.evaluate(() => {
        const nonce = document.querySelector("script[nonce]").nonce;
        const inline = document.createElement("script"); inline.textContent = "window.cspInline = true"; document.body.append(inline);
        const external = document.createElement("script"); external.src = "/csp-fixture.js"; document.body.append(external);
        const wrong = document.createElement("script"); wrong.nonce = "attacker"; wrong.textContent = "window.cspWrong = true"; document.body.append(wrong);
        const button = document.createElement("button"); button.setAttribute("onclick", "window.cspHandler = true"); document.body.append(button); button.click();
        const trusted = document.createElement("script"); trusted.nonce = nonce;
        trusted.src = "/csp-trusted-fixture.js"; document.body.append(trusted);
      });
      await page.waitForFunction(() => window.cspTrusted === true && window.cspProbeDone === true);
      await page.waitForTimeout(200);
      const results = await page.evaluate(() => [!!window.cspInline, !!window.cspExternal, !!window.cspWrong, !!window.cspHandler, !!window.cspEval]);
      assert.deepEqual(results, Array(5).fill(mode === "report-only"));
      assert(probeViolations.some(v => v.blocked === "inline"));
      assert(probeViolations.some(v => v.blocked === "eval"));
      assert(probeViolations.every(v => v.disposition === (mode === "enforce" ? "enforce" : "report")));
      await context.close();
      console.log(`PASS: CSP ${mode} ${locale}/${theme} desktop/mobile login, copy/paging/edit, dialogs, stats pixels/map, settings/language/protected navigation and injection/eval probes`);
    }
    await setup.close(); console.log("CSP browser evidence: " + evidence);
  } catch (error) { if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
