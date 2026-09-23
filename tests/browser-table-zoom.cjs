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
  const temp = mkdtempSync(path.join(tmpdir(), "kutt-table-zoom-"));
  const extension = path.join(temp, "extension"); mkdirSync(extension);
  // Exercise browser reflow, not CSS zoom or pinch magnification.
  writeFileSync(path.join(extension, "manifest.json"), JSON.stringify({
    manifest_version: 3, name: "Kutt fixture zoom", version: "1.0.0",
    host_permissions: ["http://127.0.0.1/*"], background: { service_worker: "worker.js" }
  }));
  writeFileSync(path.join(extension, "worker.js"), `globalThis.setFixtureZoom = async ({ origin, factor }) => {
    if (new URL(origin).hostname !== "127.0.0.1" || ![2, 4].includes(factor)) throw new Error("Fixture only");
    const tabs = (await chrome.tabs.query({url: "http://127.0.0.1/*"})).filter(tab => new URL(tab.url).origin === origin);
    if (tabs.length !== 1) throw new Error("Expected one fixture tab");
    await chrome.tabs.setZoomSettings(tabs[0].id, {mode: "automatic", scope: "per-tab"});
    await chrome.tabs.setZoom(tabs[0].id, factor);
    return chrome.tabs.getZoom(tabs[0].id);
  }; chrome.runtime.onInstalled.addListener(() => {});`);
  let context, page;
  const errors = [], results = [];
  try {
    context = await chromium.launchPersistentContext(path.join(temp, "profile"), {
      channel: "chromium", headless: true, viewport: { width: 1440, height: 1000 },
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`]
    });
    const post = async (url, data, status = 201) => {
      const response = await context.request.post(origin + url, { data, headers: { Accept: "application/json" } });
      assert.equal(response.status(), status, "Fresh fixture required: " + url); return response.json();
    };
    for (let i = 0; i < 100; i++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const account = await post("/api/auth/create-admin", {
      email: "table-zoom-with-long-address@example.invalid", password: randomBytes(32).toString("hex")
    });
    await context.addCookies([{ name: "token", value: account.token, url: origin }]);
    const link = await post("/api/links", {
      target: "https://example.org/" + "long-path-".repeat(35), customurl: "table-zoom-alias",
      description: "Long description ".repeat(15)
    });
    await post("/api/domains/admin", {
      address: "long-domain-for-responsive-management.example.invalid", homepage: "https://example.org/" + "path-".repeat(35)
    }, 200);
    page = context.pages()[0]; page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const settled = async () => {
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => {
        const tbody = document.querySelector("#main-table-wrapper tbody");
        return tbody && getComputedStyle(tbody).opacity === "1" && !document.querySelector(".htmx-request");
      });
    };
    const captureViewport = async name => {
      // Native capture avoids CSS-pixel clip overrides that mis-crop browser zoom.
      const capture = await context.newCDPSession(page);
      try {
        const result = await capture.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
        writeFileSync(path.join(evidence, name + ".png"), Buffer.from(result.data, "base64"));
      } finally { await capture.detach(); }
    };
    const check = async (name, factor) => {
      const table = page.locator("#main-table-wrapper table");
      assert.equal(await page.evaluate(() => innerWidth), 1440 / factor);
      assert.equal(await page.evaluate(() => visualViewport.scale), 1);
      assert(await table.evaluate(node => node.scrollWidth <= node.clientWidth + 1), "No hidden table overflow");
      const controls = table.locator('button:visible:enabled, a:visible, input:not([type="hidden"]):visible, select:visible');
      for (let i = 0; i < await controls.count(); i++) {
        const control = controls.nth(i); await control.scrollIntoViewIfNeeded();
        assert(await control.evaluate(node => {
          const r = node.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && r.left >= -1 && r.right <= innerWidth + 1 &&
            node.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
        }), name + " reachable zoomed control: " + await control.getAttribute("aria-label"));
      }
      await captureViewport(`${name}-actions-zoom${factor}`);
      await page.evaluate(() => {
        const top = document.querySelector("#main-table-wrapper table").getBoundingClientRect().top + scrollY;
        scrollTo({ top: Math.max(0, top - 8), behavior: "instant" });
      });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert(await table.locator("thead").evaluate(node => {
        const r = node.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight;
      }), "Screenshot includes table header");
      await captureViewport(`${name}-zoom${factor}`);
      results.push({ name, factor, cssWidth: await page.evaluate(() => innerWidth), controls: await controls.count() });
    };
    for (const factor of [2, 4]) {
      for (const route of ["/", "/admin"]) {
        assert.equal((await page.goto(origin + route)).status(), 200); await settled();
        const worker = context.serviceWorkers()[0] || await context.waitForEvent("serviceworker");
        assert(Math.abs(await worker.evaluate(args => globalThis.setFixtureZoom(args), { origin, factor }) - factor) < 1e-9);
        await page.waitForFunction(value => Math.abs(devicePixelRatio - value) < 0.01, factor);
        if (route === "/") {
          await check("personal", factor);
          await page.getByRole("button", { name: "Edit " + link.address, exact: true }).click(); await settled();
          await page.locator("#edit-form-" + link.id).getByRole("button", { name: "Close", exact: true }).click();
          await check("personal-after-edit-close", factor);
        } else for (const name of ["Links", "Users", "Domains"]) {
          await page.getByRole("tab", { name, exact: true }).click(); await settled();
          assert.equal(await page.getByRole("tab", { name, exact: true }).getAttribute("aria-selected"), "true");
          await check("admin-" + name.toLowerCase(), factor);
        }
      }
      console.log("PASS: personal and all admin tables at " + factor * 100 + "% browser zoom");
    }
    assert.deepEqual(errors, []);
    writeFileSync(path.join(evidence, "table-zoom-results.json"), JSON.stringify({ results, errors }, null, 2));
    console.log("PASS: genuine 200/400% zoom, long content, all action hit regions, edit cancellation and admin navigation");
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "table-zoom-failure.png"), fullPage: true });
    throw error;
  } finally { await context?.close(); rmSync(temp, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
