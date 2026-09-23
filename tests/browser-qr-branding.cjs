const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, mkdtempSync, readFileSync } = require("node:fs");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { locale, t } = require("./browser-locale.cjs");
const theme = process.env.KUTT_TEST_THEME || "light";
assert(["light", "dark"].includes(theme));
const decode = require(process.env.QR_DECODER_MODULE || "./browser-deps/node_modules/jsqr");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1" && new URL(origin).origin === origin);
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-qr-branding-"));
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true }); let page;
  try {
    const context = await browser.newContext({ acceptDownloads: true, locale, colorScheme: theme });
    await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await context.addInitScript(() => {
      const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
      window.liveBlobs = new Set(); window.blobValues = new Map();
      URL.createObjectURL = value => { const url = create(value); window.liveBlobs.add(url); window.blobValues.set(url, value); return url; };
      URL.revokeObjectURL = value => { window.liveBlobs.delete(value); window.blobValues.delete(value); revoke(value); };
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: { async write(items) {
        if (window.denyCopy) throw Error("fixture-denial");
        const blob = await items[0].getType("image/png");
        if (window.delayCopy) await new Promise(resolve => { window.releaseCopy = resolve; });
        window.copied = Array.from(new Uint8Array(await blob.arrayBuffer()));
      } } });
      window.print = () => { window.printCalls = (window.printCalls || 0) + 1; };
    });
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", {
      data: { email: "qr-branding@example.invalid", password: randomBytes(32).toString("hex") }, headers: { Accept: "application/json" }
    });
    assert.equal(bootstrap.status(), 201, "Refuse initialized fixtures");
    await context.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    const links = [];
    for (const address of ["qr-branding", "qr-branding/docs/version-2", "b".repeat(64)]) {
      const result = await context.request.post(origin + "/api/links", { data: { customurl: address, target: "https://192.0.2.1/private-qr-fixture", password: "private-fixture-password" }, headers: { Accept: "application/json" } });
      assert.equal(result.status(), 201); links.push(await result.json());
    }
    page = await context.newPage(); const errors = [], consoleErrors = [], logoRequests = [];
    page.on("request", request => {
      if (request.method() === "POST" && /\/api\/links\/[^/]+\/qr$/.test(new URL(request.url()).pathname)) logoRequests.push(request.postDataJSON());
    });
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (["error", "warning"].includes(message.type()) && !/Failed to load resource|net::ERR_FAILED/.test(message.text())) consoleErrors.push(message.text()); });
    const waitReady = () => page.waitForFunction(() => !document.getElementById("qr-print").disabled && document.getElementById("qr-preview").complete);
    const inspect = async (bytes, type, expected, branded = true) => {
      const pixels = await page.evaluate(async ({ base64, type }) => {
        const img = new Image(); img.src = "data:" + type + ";base64," + base64; await img.decode();
        const canvas = document.createElement("canvas"); canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d"); ctx.drawImage(img, 0, 0);
        return { width: canvas.width, height: canvas.height, data: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
      }, { base64: bytes.toString("base64"), type });
      assert.equal(decode(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)?.data, expected, "Decode actual exported artifact to only its short URL");
      let colored = 0;
      for (let i = 0; i < pixels.data.length; i += 4) if (pixels.data[i] !== pixels.data[i + 1] || pixels.data[i] !== pixels.data[i + 2]) colored++;
      assert.equal(colored > 8, branded, "Logo must actually render, including embedded PNG in SVG");
      return pixels.width;
    };
    await page.goto(origin + "/link/qr/" + links[0].id); await waitReady();
    const logo = Buffer.from(await page.evaluate(() => {
      const c = document.createElement("canvas"); c.width = 48; c.height = 32;
      const g = c.getContext("2d"); g.fillStyle = "#058968"; g.fillRect(0, 0, 24, 32); g.fillStyle = "#d92858"; g.fillRect(24, 0, 24, 32);
      return c.toDataURL("image/png").split(",")[1];
    }), "base64");
    for (const [index, width] of [1440, 390, 320].entries()) {
      const link = links[index]; await page.setViewportSize({ width, height: 1000 });
      await page.goto(origin + "/link/qr/" + link.id); await waitReady();
      assert.equal(await page.locator("html").getAttribute("lang"), locale);
      assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
      assert.equal(await page.locator("#qr-logo-remove").getAttribute("aria-label"), t("qr.remove_logo"));
      assert.equal(await page.locator("#qr-logo-preview").getAttribute("alt"), t("qr.selected_logo"));
      assert((await page.locator(".qr-state").textContent()).includes(t("ui.password_protected_2")));
      assert((await page.title()).includes(t("ui.qr_code"))); assert(await page.getByRole("heading", { name: t("ui.qr_code"), exact: true }).isVisible());
      const beforeUpload = logoRequests.length;
      await page.locator("#qr-logo").setInputFiles({ name: "brand.png", mimeType: "image/png", buffer: logo }); await waitReady();
      const uploaded = logoRequests.slice(beforeUpload);
      assert.deepEqual(uploaded.map(body => body.format).sort(), ["png", "svg"]);
      for (const body of uploaded) assert.equal(body.logo, logo.toString("base64"), "Actual browser POST must send canonical plain base64 without a data URI");
      assert.equal(await page.locator('[name="level"]').inputValue(), "H"); assert(await page.locator('[name="level"]').isDisabled());
      assert(await page.locator("#qr-logo-preview").isVisible());
      const embeddedLogo = await page.evaluate(async () => {
        const svg = await window.blobValues.get(document.getElementById("qr-svg").href).text();
        return new DOMParser().parseFromString(svg, "image/svg+xml").querySelector("image").getAttribute("href");
      });
      assert.equal(await page.locator("#qr-logo-preview").getAttribute("src"), embeddedLogo, "Thumbnail must use only the canonical server raster, never the uploaded metadata");
      for (const size of index ? [300] : [128, 255, 512, 1024]) {
        await page.getByLabel(t("ui.size_px"), { exact: true }).fill(String(size));
        assert(await page.locator("#qr-print").isDisabled());
        await page.getByRole("button", { name: t("ui.apply"), exact: true }).click(); await waitReady();
        for (const format of ["PNG", "SVG"]) {
          const download = page.waitForEvent("download"); await page.getByRole("link", { name: t("ui.download_" + format.toLowerCase()), exact: true }).click();
          const file = await download; assert.equal(file.suggestedFilename(), "kutt-qr-" + link.id + "." + format.toLowerCase());
          assert.equal(await inspect(readFileSync(await file.path()), format === "PNG" ? "image/png" : "image/svg+xml", link.link), size);
        }
      }
      await page.getByRole("button", { name: t("ui.copy_qr_image"), exact: true }).click();
      await page.getByRole("status").getByText(t("ui.qr_image_copied"), { exact: true }).waitFor();
      await inspect(Buffer.from(await page.evaluate(() => window.copied)), "image/png", link.link);
      await page.evaluate(() => { window.denyCopy = true; }); await page.locator("#qr-copy").click();
      await page.getByRole("status").getByText(t("ui.could_not_copy_image_retry_or_download_png"), { exact: true }).waitFor(); await page.evaluate(() => { window.denyCopy = false; });
      await page.locator("#qr-copy").click(); await page.getByRole("status").getByText(t("ui.qr_image_copied"), { exact: true }).waitFor();
      await page.locator("#qr-print").focus(); await page.keyboard.press("Enter"); assert.equal(await page.evaluate(() => window.printCalls), 1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), width + " horizontal overflow");
      const heading = await page.locator(".qr-page .archive-heading").boundingBox();
      assert((await page.locator(".qr-controls").boundingBox()).y >= heading.y + heading.height);
      await page.screenshot({ path: path.join(evidence, width + "-branded.png"), fullPage: true });
      await require("./qr-browser-layout.cjs")(page);
      assert.equal(await page.locator("#qr-preview").evaluate(el => getComputedStyle(el).backgroundColor), "rgb(255, 255, 255)");
      await page.emulateMedia({ media: "print" }); assert(await page.locator(".qr-controls").isHidden());
      await page.screenshot({ path: path.join(evidence, width + "-print.png"), fullPage: true }); await page.emulateMedia({ media: "screen" });
      await page.locator("#qr-logo-remove").focus(); await page.keyboard.press("Enter"); await waitReady();
      assert(await page.locator("#qr-logo").evaluate(el => el === document.activeElement));
      assert(!(await page.locator('[name="level"]').isDisabled()));
      const plain = await page.evaluate(async () => Array.from(new Uint8Array(await window.blobValues.get(document.getElementById("qr-png").href).arrayBuffer())));
      await inspect(Buffer.from(plain), "image/png", link.link, false);
      assert.equal(await page.evaluate(() => window.liveBlobs.size), 2);
      await page.locator("#qr-logo").setInputFiles({ name: "bad.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
      await page.getByRole("alert").getByText(t("qr.invalid_logo"), { exact: true }).waitFor();
      await page.getByRole("button", { name: t("ui.apply"), exact: true }).click();
      assert(await page.locator("#qr-print").isDisabled()); assert.equal(await page.locator("#qr-png").getAttribute("href"), null);
      await page.screenshot({ path: path.join(evidence, width + "-invalid.png"), fullPage: true });
      await require("./qr-browser-layout.cjs")(page);
      await page.locator("#qr-logo").setInputFiles({ name: "oversize.png", mimeType: "image/png", buffer: Buffer.alloc(65537) });
      await page.getByRole("alert").getByText(t("qr.invalid_logo"), { exact: true }).waitFor(); assert(await page.locator("#qr-print").isDisabled());
      await page.locator("#qr-logo-remove").click(); await waitReady();
    }
    const link = links[2], routePattern = "**/api/links/" + link.id + "/qr";
    const corrupt = Buffer.from(logo); corrupt[29] ^= 1;
    await page.locator("#qr-logo").setInputFiles({ name: "corrupt.png", mimeType: "image/png", buffer: corrupt });
    await page.getByRole("alert").getByText(t("qr.invalid_logo"), { exact: true }).waitFor(); assert(await page.locator("#qr-print").isDisabled());
    await page.route(routePattern, route => route.request().postDataJSON().format === "svg"
      ? route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Not an image</h1>" }) : route.continue());
    await page.locator("#qr-logo").setInputFiles({ name: "brand.png", mimeType: "image/png", buffer: logo });
    await page.getByRole("alert").getByText(t("ui.qr_image_could_not_load_sign_in_again_or_retry"), { exact: true }).waitFor();
    assert.equal(await page.locator("#qr-svg").getAttribute("href"), null); assert.equal(await page.evaluate(() => window.liveBlobs.size), 0);
    await page.unroute(routePattern); await page.getByRole("button", { name: t("ui.apply"), exact: true }).click(); await waitReady();
    await page.route(routePattern, route => route.abort("failed"));
    await page.getByRole("button", { name: t("ui.apply"), exact: true }).click();
    await page.getByRole("alert").getByText(t("ui.qr_image_could_not_load_sign_in_again_or_retry"), { exact: true }).waitFor();
    await page.unroute(routePattern); await page.getByRole("button", { name: t("ui.apply"), exact: true }).click(); await waitReady();
    await page.locator("#qr-logo-remove").click(); await waitReady();
    let release, entered;
    const waiting = new Promise(resolve => { entered = resolve; }), blocked = new Promise(resolve => { release = resolve; });
    await page.route(routePattern, async route => {
      const response = await route.fetch();
      if (route.request().postDataJSON().format === "png") { entered(); await blocked; }
      await route.fulfill({ response }).catch(() => {});
    });
    await page.locator("#qr-logo").setInputFiles({ name: "brand.png", mimeType: "image/png", buffer: logo }); await waiting;
    await page.locator("#qr-logo-remove").click(); await waitReady(); release(); await page.unroute(routePattern);
    assert(await page.locator("#qr-logo-preview").isHidden()); assert.equal(await page.locator('[name="level"]').inputValue(), "M");
    await page.evaluate(() => { window.delayCopy = true; }); await page.locator("#qr-copy").click();
    await page.waitForFunction(() => typeof window.releaseCopy === "function");
    await page.getByLabel(t("ui.size_px"), { exact: true }).fill("256");
    await page.evaluate(() => window.releaseCopy()); await page.waitForFunction(() => !document.getElementById("qr-copy").hasAttribute("aria-busy"));
    assert.equal(await page.locator("#qr-copy-status").innerText(), t("qr.changes_pending"));
    await page.locator('[name="level"]').selectOption("Q");
    await page.getByRole("button", { name: t("ui.apply"), exact: true }).click(); await waitReady();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    await page.waitForFunction(() => window.liveBlobs.size === 0); assert.equal(await page.locator("#qr-logo").inputValue(), "");
    assert.equal(await page.locator('[name="level"]').inputValue(), "Q", "Page exit must preserve unbranded correction settings");
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }))); await waitReady();
    assert.equal(await page.locator('[name="level"]').inputValue(), "Q");
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
    await page.waitForFunction(() => window.liveBlobs.size === 0);
    const rows = await (await context.request.get(origin + "/api/links", { headers: { Accept: "application/json" } })).json();
    assert(rows.data.every(row => row.visit_count === 0));
    assert(logoRequests.length > 0);
    for (const body of logoRequests) {
      assert.equal(typeof body.logo, "string"); assert(!body.logo.includes("data:"));
      assert.equal(Buffer.from(body.logo, "base64").toString("base64"), body.logo);
    }
    assert.deepEqual(errors, []); assert.deepEqual(consoleErrors, []);
    console.log("PASS: " + locale + "/" + theme + " 1440/390/320 branded PNG+SVG independent decoding, preview/remove, keyboard, clipboard/print, invalid/oversize/CRC file recovery, malformed responses, delayed render/copy races, blob cleanup and no visits; " + evidence);
  } catch (error) { if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true }); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
