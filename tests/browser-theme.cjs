const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { locale, t } = require("./browser-locale.cjs");
const labels = { System: t("theme.system"), Light: t("theme.light"), Dark: t("theme.dark") };

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, "127.0.0.1"); assert(evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const context = await browser.newContext({ locale, colorScheme: "dark", reducedMotion: "reduce" });
    const errors = [], measurements = [];
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", {
      headers: { Accept: "application/json" }, data: { email: "theme@example.invalid", password: randomBytes(32).toString("hex") }
    });
    assert.equal(bootstrap.status(), 201, "Fresh instance required");
    await context.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    const create = await context.request.post(origin + "/api/links", {
      headers: { Accept: "application/json" }, data: { target: "https://192.0.2.1/theme-test", customurl: "theme-test" }
    });
    assert.equal(create.status(), 201); const link = await create.json();
    await context.request.get(origin + "/theme-test", { maxRedirects: 0, headers: { "User-Agent": "Mozilla/5.0 AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36" } });
    page = await context.newPage(); page.on("pageerror", err => errors.push(err.message));
    page.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
    const theme = async (name, effective) => {
      await page.getByRole("radio", { name: labels[name], exact: true }).check();
      assert.equal(await page.locator("html").getAttribute("data-theme"), effective);
      assert.equal(await page.evaluate(() => localStorage.getItem("kutt.theme")), name.toLowerCase());
    };
    const capture = async name => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Overflow: " + name);
      await page.screenshot({ path: path.join(evidence, name + ".png"), fullPage: true, animations: "disabled" });
    };
    const contrast = async (locator, label) => {
      for (const el of await locator.all()) {
        if (!await el.isVisible()) continue;
        const result = await el.evaluate(node => {
          const parse = value => value.match(/[\d.]+/g).map(Number);
          const blend = (a, b) => a.slice(0, 3).map((v, i) => v * (a[3] ?? 1) + b[i] * (1 - (a[3] ?? 1)));
          const lum = a => a.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
          const chain = []; for (let p = node; p; p = p.parentElement) chain.unshift(p);
          let background = [255, 255, 255], gradient = false;
          for (const p of chain) {
            const style = getComputedStyle(p), color = parse(style.backgroundColor);
            background = blend(color, background);
            if ((color[3] ?? 1) === 1) gradient = false;
            if (style.backgroundImage.startsWith("linear-gradient(")) gradient = true;
          }
          if (gradient || node.disabled) return null; // Gradient contrast has its existing separate 33-stop test.
          const style = getComputedStyle(node), a = lum(blend(parse(style.color), background)), b = lum(background);
          return { ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), text: (node.textContent || node.placeholder || "input").trim().slice(0, 55), fg: style.color, bg: background };
        });
        if (!result) continue; measurements.push({ label, ...result });
        assert(result.ratio >= 4.5, label + " " + JSON.stringify(result));
      }
    };
    await page.goto(origin + "/"); assert(await page.title());
    assert.equal(await page.locator("html").getAttribute("lang"), locale);
    assert.equal(await page.locator(".theme-picker legend").textContent(), t("theme.appearance"));
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    assert(await page.getByRole("radio", { name: labels.System, exact: true }).isChecked());
    await page.emulateMedia({ colorScheme: "light" });
    await page.waitForFunction(() => document.documentElement.dataset.theme === "light");
    await theme("Dark", "dark"); await page.reload();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    await page.getByRole("radio", { name: labels.Dark, exact: true }).focus();
    await page.keyboard.press("ArrowLeft");
    assert(await page.getByRole("radio", { name: labels.Light, exact: true }).isChecked());
    await theme("Dark", "dark");
    const other = await context.newPage(); await other.goto(origin + "/settings");
    await theme("Light", "light");
    await other.waitForFunction(() => document.documentElement.dataset.theme === "light"); await other.close();
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const mode of ["Dark", "Light"]) {
        await theme(mode, mode.toLowerCase());
        for (const route of ["/", "/admin", "/admin/moderation", "/settings", "/settings/library", "/settings/workspaces", "/settings/integrations", "/settings/health", "/settings/security", "/settings/retention", "/settings/analytics", "/settings/shortcuts", "/link/routing/" + link.id, "/link/forwarding/" + link.id, "/link/qr/" + link.id]) {
          await page.goto(origin + route); assert.equal(new URL(page.url()).pathname, route);
          await page.waitForLoadState("networkidle");
          assert.equal(await page.locator("html").getAttribute("lang"), locale);
          assert.equal(await page.locator(".theme-picker legend").textContent(), t("theme.appearance"));
          assert.equal(await page.locator("html").getAttribute("data-theme"), mode.toLowerCase());
          const label = `${width}-${mode}-${route.replace(/\W+/g, "-") || "home"}`;
          await contrast(page.locator('main h1, section h1, main h2, section h2, main label, #settings label, main input:not([type=hidden]):not([type=checkbox]), main button, #settings button, .site-header a:not(.button), footer label, footer a'), label);
          if (mode === "Dark") {
            for (const select of await page.locator('select:not([multiple])').all()) {
              if (!await select.isVisible()) continue;
              const decoration = await select.evaluate(el => { const s = getComputedStyle(el); return { image: s.backgroundImage, repeat: s.backgroundRepeat, size: s.backgroundSize }; });
              // A native select without an image has no custom arrow to tile.
              if (decoration.image !== "none") assert.deepEqual([decoration.repeat, decoration.size], ["no-repeat", "18px 18px"], label + " single select arrow");
            }
            for (const icon of await page.locator('button:not(.action) svg[fill=none]').all()) {
              if (!await icon.isVisible()) continue;
              assert(await icon.evaluate(el => getComputedStyle(el).stroke !== "rgb(0, 0, 0)"), label + " visible button icon");
            }
          }
          await capture(label);
          if (route === "/settings/analytics") {
            const colors = await page.evaluate(() => {
              const chart = Chart.getChart(document.querySelector("canvas"));
              const pixels = chart.ctx.getImageData(0, 0, chart.width, chart.height).data;
              return { color: chart.options.scales.y.ticks.color, pixels: pixels.some((v, i) => i % 4 === 3 && v > 0) };
            });
            assert(colors.pixels); assert.equal(colors.color, mode === "Dark" ? "#b8c2c7" : "#586976");
            await theme(mode === "Dark" ? "Light" : "Dark", mode === "Dark" ? "light" : "dark");
            assert.equal(await page.evaluate(() => Chart.getChart(document.querySelector("canvas")).options.scales.y.ticks.color), mode === "Dark" ? "#586976" : "#b8c2c7");
            await theme(mode, mode.toLowerCase());
          }
          if (route.startsWith("/link/qr/")) {
            assert.equal(await page.locator(".qr-sheet img").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
            await page.emulateMedia({ media: "print" });
            assert(!await page.locator(".theme-picker").isVisible());
            await capture(label + "-print"); await page.emulateMedia({ media: "screen" });
          }
        }
      }
    }
    await theme("System", "light");
    await page.emulateMedia({ colorScheme: "dark" }); await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
    const denied = await browser.newContext({ locale, colorScheme: "dark" });
    await denied.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new DOMException("Disabled", "SecurityError"); } }));
    const blocked = await denied.newPage(); blocked.on("pageerror", err => errors.push(err.message));
    await blocked.goto(origin + "/login");
    assert.equal(await blocked.locator("html").getAttribute("data-theme"), "dark");
    await blocked.getByRole("radio", { name: labels.Light, exact: true }).check();
    assert.equal(await blocked.locator("html").getAttribute("data-theme"), "light");
    await blocked.close(); await denied.close();
    assert.deepEqual(errors, []); assert(measurements.length > 200);
    writeFileSync(path.join(evidence, "contrast.json"), JSON.stringify(measurements, null, 2));
    console.log("PASS (" + locale + "): system/light/dark, persistence, cross-tab/media changes, storage denial, rendered text contrast, charts, QR/print and 90 layouts at 1440/390/320px");
  } catch (error) { if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
