const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert(evidence); mkdirSync(evidence, { recursive: true });
  const temp = mkdtempSync(path.join(tmpdir(), "kutt-heading-zoom-"));
  const extension = path.join(temp, "extension"); mkdirSync(extension);
  // A disposable extension changes actual browser zoom, not CSS zoom or pinch scale.
  writeFileSync(path.join(extension, "manifest.json"), JSON.stringify({
    manifest_version: 3, name: "Kutt fixture zoom", version: "1.0.0",
    host_permissions: ["http://127.0.0.1/*"], background: { service_worker: "worker.js" }
  }));
  writeFileSync(path.join(extension, "worker.js"), `globalThis.setFixtureZoom = async ({ origin, factor }) => {
    if (new URL(origin).hostname !== "127.0.0.1" || ![1, 2, 4].includes(factor)) throw new Error("Fixture only");
    const tabs = (await chrome.tabs.query({url: "http://127.0.0.1/*"})).filter(tab => new URL(tab.url).origin === origin);
    if (tabs.length !== 1) throw new Error("Expected one fixture tab");
    await chrome.tabs.setZoomSettings(tabs[0].id, {mode: "automatic", scope: "per-tab"});
    await chrome.tabs.setZoom(tabs[0].id, factor);
    return chrome.tabs.getZoom(tabs[0].id);
  }; chrome.runtime.onInstalled.addListener(() => {});`);
  let context, page;
  const results = [], errors = [];
  try {
    context = await chromium.launchPersistentContext(path.join(temp, "profile"), {
      channel: "chromium", headless: true, viewport: { width: 1440, height: 1000 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    const call = async (url, data) => {
      const response = await context.request.post(origin + url, { data, headers: { Accept: "application/json" } });
      assert.equal(response.status(), 201, "Fresh disposable fixture required: " + url);
      return response.json();
    };
    for (let i = 0; i < 100; i++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const admin = await call("/api/auth/create-admin", {
      email: "heading-ui@example.invalid", password: randomBytes(32).toString("hex")
    });
    await context.addCookies([{ name: "token", value: admin.token, url: origin }]);
    const link = await call("/api/links", { target: "https://example.org/layout-test", customurl: "heading-layout" });
    const space = await call("/api/workspaces", { name: "Workspace-" + "LongTitle".repeat(7) });
    page = context.pages()[0]; page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const routes = [
      ["library", "/settings/library"], ["transfer", "/settings/transfer"],
      ["workspaces", "/settings/workspaces"], ["workspace-long", "/settings/workspaces/" + space.id],
      ["analytics", "/settings/analytics"], ["monitoring", "/settings/health"],
      ["retention", "/settings/retention"], ["shortcuts", "/settings/shortcuts"], ["trash", "/settings/trash"],
      ...["qr", "health", "routing", "forwarding", "tracking", "history"].map(name => [name, "/link/" + name + "/" + link.id])
    ];
    let zoomFactor = 1;
    const goto = async route => {
      const response = await page.goto(origin + route);
      assert.equal(response.status(), 200, route); await page.waitForLoadState("networkidle");
      // Chromium resets per-tab zoom on navigation; reapply before every measurement.
      const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
      const applied = await worker.evaluate(args => globalThis.setFixtureZoom(args), { origin, factor: zoomFactor });
      assert(Math.abs(applied - zoomFactor) < 1e-9, "Browser applied requested zoom");
      await page.waitForFunction(factor => Math.abs(devicePixelRatio - factor) < 0.01, zoomFactor);
      // Zoom changes the responsive breakpoint and starts size transitions.
      // Compare settled layouts, not different frames of the same transition.
      const settlement = await page.locator(".main-wrapper > header").evaluate(async node => {
        await document.fonts.ready;
        const before = getComputedStyle(node).height;
        const animations = node.getAnimations({ subtree: true });
        const properties = animations.map(animation => animation.transitionProperty || animation.animationName);
        await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return { before, after: getComputedStyle(node).height, properties };
      });
      if (settlement.before !== settlement.after) console.log("ZOOM_SETTLEMENT", JSON.stringify({ route, zoom: zoomFactor, ...settlement }));
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => visualViewport.scale), 1, "No pinch emulation");
    };
    const masthead = () => page.locator(".main-wrapper > header").evaluate(node => {
      const s = getComputedStyle(node);
      return { height: s.height, padding: s.padding, display: s.display, position: s.position };
    });
    for (const [width, factor] of [[1440, 1], [768, 1], [390, 1], [320, 1], [1440, 2], [1440, 4]]) {
      zoomFactor = factor;
      await page.setViewportSize({ width, height: 1000 }); await goto("/");
      const baseline = await masthead();
      for (const [name, route] of routes) {
        await goto(route);
        const headings = page.locator(".archive-heading");
        assert(await headings.count(), name + " heading present");
        assert((await page.title()).length > 0);
        assert.deepEqual(await masthead(), baseline, "Content styles must not alter masthead");
        for (let i = 0; i < await headings.count(); i++) {
          const heading = headings.nth(i);
          await heading.scrollIntoViewIfNeeded();
          const geometry = await heading.evaluate(node => {
            const rect = node.getBoundingClientRect(), next = node.nextElementSibling?.getBoundingClientRect();
            return { left: rect.left, right: rect.right, bottom: rect.bottom, width: innerWidth,
              nextTop: next?.top, childBottom: Math.max(...[...node.children].map(child => child.getBoundingClientRect().bottom)) };
          });
          assert(geometry.left >= 0 && geometry.right <= geometry.width + 1, name + " heading within viewport");
          assert(geometry.childBottom <= geometry.bottom + 1, name + " heading reserves all wrapped rows");
          assert(geometry.nextTop === undefined || geometry.nextTop >= geometry.bottom - 1, name + " following content does not overlap");
        }
        const links = headings.locator("a");
        for (let i = 0; i < await links.count(); i++) {
          const anchor = links.nth(i); await anchor.scrollIntoViewIfNeeded();
          const hit = await anchor.evaluate(node => [...node.getClientRects()].every(rect => {
            const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
            return x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && node.contains(document.elementFromPoint(x, y));
          }));
          assert(hit, name + " unobscured heading link: " + await anchor.textContent());
          if (factor === 1 && [1440, 390].includes(width)) {
            const href = await anchor.getAttribute("href");
            await anchor.click(); await page.waitForURL(origin + href);
            await goto(route);
          }
        }
        if (["library", "workspace-long", "routing"].includes(name)) {
          await headings.first().scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(evidence, `${name}-${width}-zoom${factor}.png`) });
        }
        results.push({ name, width, zoom: factor, cssWidth: await page.evaluate(() => innerWidth), headings: await headings.count() });
      }
      console.log(`PASS: all 15 content-heading routes at ${width}px / ${factor * 100}% browser zoom`);
    }
    assert.deepEqual(errors, []);
    writeFileSync(path.join(evidence, "heading-results.json"), JSON.stringify({ results, errors }, null, 2));
    console.log("PASS: content-sized headings, all link hit regions, desktop/mobile navigation, long workspace title, unchanged masthead and actual browser zoom");
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "heading-failure.png"), fullPage: true });
    throw error;
  } finally { await context?.close(); rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
