const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(origin && new URL(origin).hostname === "127.0.0.1" && evidence, "Use a fresh loopback fixture");
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true }), measurements = [];
  try {
    const context = await browser.newContext();
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Disposable server is not ready");
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", {
      data: { email: "contrast@example.invalid", password: randomBytes(32).toString("hex") }, headers: { Accept: "application/json" }
    });
    assert.equal(bootstrap.status(), 201, "Refuse initialized fixtures");
    await context.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    const linkResponse = await context.request.post(origin + "/api/v2/links", { data: {
      target: "https://example.org/contrast", customurl: "contrast-link", description: "Readable secondary text"
    } });
    assert.equal(linkResponse.status(), 201); const link = await linkResponse.json();
    const page = await context.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("console", message => {
      if (message.type() === "error" && !/Failed to load resource:.*409 /.test(message.text())) errors.push(message.text());
    });
    const check = async (locator, label, pseudo = null) => {
      await locator.waitFor({ state: "visible" });
      // Wait for existing color/opacity transitions before measuring settled text.
      await locator.evaluate(async el => {
        const animations = [];
        for (let node = el; node; node = node.parentElement) animations.push(...node.getAnimations());
        await Promise.all(animations.filter(animation => animation.effect.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
      });
      const result = await locator.evaluate((el, pseudo) => {
        const parse = value => { const match = value.match(/^rgba?\(([^)]+)\)$/); if (!match) throw Error("Unsupported computed color: " + value); return match[1].split(/[,\s/]+/).filter(Boolean).map(Number); };
        const blend = (front, back) => { const alpha = front[3] ?? 1; return front.slice(0, 3).map((value, i) => alpha * value + (1 - alpha) * back[i]); };
        const luminance = values => values.slice(0, 3).map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
        const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
        const chain = []; for (let node = el; node; node = node.parentElement) chain.unshift(node);
        let background = [255, 255, 255], gradients = null, opacity = 1;
        for (const node of chain) {
          const style = getComputedStyle(node); opacity *= Number(style.opacity);
          const color = parse(style.backgroundColor);
          background = blend(color, background);
          if ((color[3] ?? 1) === 1) gradients = null;
          if (style.backgroundImage !== "none") {
            if (!style.backgroundImage.startsWith("linear-gradient(")) throw Error("Unmeasured background image");
            const stops = style.backgroundImage.match(/rgba?\([^)]+\)/g)?.map(parse);
            if (!stops || stops.length !== 2) throw Error("Expected the two-color button gradient");
            gradients = Array.from({ length: 33 }, (_, step) => blend(stops[0].map((value, i) => value + (stops[1][i] - value) * step / 32), background));
          }
        }
        const style = getComputedStyle(el, pseudo), foreground = parse(style.color);
        if (pseudo) opacity *= Number(style.opacity);
        if (opacity !== 1) throw Error("Opacity needs a separate compositing check: " + opacity);
        const samples = gradients || [background];
        return { ratio: Math.min(...samples.map(bg => ratio(blend(foreground, bg), bg))), foreground: style.color, background: samples, font: style.fontSize, outline: getComputedStyle(el).outlineStyle };
      }, pseudo);
      measurements.push({ label, ...result });
      assert(result.ratio >= 4.5, label + " contrast " + result.ratio.toFixed(3));
    };
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
      for (const route of ["/settings", "/settings/health", "/settings/workspaces", "/settings/integrations"]) {
        await page.goto(origin + route);
        assert.equal(new URL(page.url()).pathname, route); assert(await page.title());
        const candidates = page.locator('main a:not(.button), #settings a:not(.button)');
        let checked = 0;
        for (const candidate of await candidates.all()) {
          if (!await candidate.isVisible() || !(await candidate.innerText()).trim()) continue;
          await check(candidate, `${width} ${route} link`); checked++;
          if (checked === 1) {
            await candidate.hover(); await check(candidate, `${width} ${route} hover`);
            await candidate.focus(); await check(candidate, `${width} ${route} focus`);
            assert.notEqual(await candidate.evaluate(el => getComputedStyle(el).outlineStyle), "none");
          }
        }
        assert(checked, "Expected rendered navigation at " + route);
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (route === "/settings/health") await page.screenshot({ path: path.join(evidence, `navigation-${width}.png`), fullPage: true });
      }
      await page.goto(origin + "/link/routing/" + link.id);
      await page.waitForFunction(() => !document.getElementById("routing-save").disabled);
      const config = await (await context.request.get(origin + "/api/links/" + link.id + "/routing")).json();
      assert.equal((await context.request.put(origin + "/api/links/" + link.id + "/routing", { data: { rules: [], revision: config.revision } })).status(), 200);
      await page.getByRole("button", { name: "Save rules", exact: true }).click();
      await page.locator("#routing-status.error").waitFor();
      await check(page.locator("#routing-status"), `${width} real routing conflict`);
      await check(page.locator("#routing-save"), `${width} routing primary button`);
      await check(page.getByLabel("Preferred language"), `${width} routing placeholder`, "::placeholder");
      await page.screenshot({ path: path.join(evidence, `routing-error-${width}.png`), fullPage: true });
    }
    await page.goto(origin + "/");
    await page.locator("#main-table-wrapper table td .description").filter({ hasText: "Readable secondary text" }).waitFor();
    await check(page.locator("#main-table-wrapper table td .description").filter({ hasText: "Readable secondary text" }), "legacy description");
    // Render the existing palette classes to check all enabled button gradients,
    // including variants absent from the current account's ordinary screen.
    await page.evaluate(() => {
      const probe = document.createElement("section"); probe.id = "contrast-probes";
      for (const variant of ["primary", "secondary", "danger", "success"]) {
        const button = document.createElement("button"); button.className = variant; button.textContent = variant; probe.append(button);
      }
      const error = document.createElement("p"); error.className = "error"; error.textContent = "Error"; probe.append(error);
      document.querySelector("main").append(probe);
    });
    for (const variant of ["primary", "secondary", "danger", "success"]) {
      const button = page.locator("#contrast-probes button." + variant);
      await check(button, variant + " gradient"); await button.hover(); await check(button, variant + " hover");
      await button.focus(); await check(button, variant + " focus");
    }
    await check(page.locator("#contrast-probes p.error"), "shared auth/error text class");
    await page.locator("#contrast-probes").evaluate(el => el.remove());
    await context.clearCookies(); await page.goto(origin + "/login");
    await check(page.locator('header a[href="/login"]'), "signed-out login button");
    await check(page.locator('input[name="email"]'), "login email placeholder", "::placeholder");
    await check(page.locator('input[name="password"]'), "login password placeholder", "::placeholder");
    await page.locator('input[name="email"]').fill("contrast@example.invalid");
    await page.locator('input[name="password"]').fill("deliberately-wrong-fixture-password");
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.locator("#login-signup p.error").waitFor();
    await check(page.locator("#login-signup p.error").first(), "actual local sign-in rejection");
    await page.screenshot({ path: path.join(evidence, "login-320.png"), fullPage: true });
    assert.deepEqual(errors, []);
    writeFileSync(path.join(evidence, "contrast.json"), JSON.stringify(measurements, null, 2));
    console.log("PASS: rendered navigation/default/hover/focus, real routing conflict, placeholders, secondary text, auth error class and four sampled button gradients; minimum " + Math.min(...measurements.map(row => row.ratio)).toFixed(3) + ":1 across " + measurements.length + " checks");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
