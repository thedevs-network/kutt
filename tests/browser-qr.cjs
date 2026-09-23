const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync, readFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const decode = require(process.env.QR_DECODER_MODULE || "./browser-deps/node_modules/jsqr");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Use a fresh loopback-only instance");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-qr-ui-"));
  const browser = await chromium.launch({ headless: true }); let page;
  try {
    const context = await browser.newContext({ acceptDownloads: true });
    // Exercise real ClipboardItem PNG promises without touching the OS clipboard.
    await context.addInitScript(() => {
      if (sessionStorage.getItem("noImageClipboard")) {
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
        return;
      }
      window.copyWrites = 0;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
        async write(items) {
          window.copyWrites++;
          if (window.denyCopy) throw new DOMException("Denied", "NotAllowedError");
          const blob = await items[0].getType("image/png");
          window.copiedPNG = Array.from(new Uint8Array(await blob.arrayBuffer()));
        }
      } });
    });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Disposable instance did not become ready");
    const account = { email: "12345.browser-qr@example.invalid", password: randomBytes(32).toString("hex") };
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", { data: account, headers: { Accept: "application/json" } });
    assert.equal(bootstrap.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    const creation = await context.request.post(origin + "/api/links", { data: { customurl: "qr-browser-validation", target: "https://192.0.2.1/qr-private-target" }, headers: { Accept: "application/json" } });
    assert.equal(creation.status(), 201); const link = await creation.json();
    const domain = "qr-browser.example.invalid";
    await require("./browser-domain-fixture.cjs")(context, origin, domain);
    page = await context.newPage(); const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const decodedImage = async (data, type) => {
      const pixels = await page.evaluate(async ({ data, type }) => {
        const image = new Image(); image.src = `data:${type};base64,${data}`; await image.decode();
        const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0);
        return { width: canvas.width, height: canvas.height, rgba: Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data) };
      }, { data: data.toString("base64"), type });
      const result = decode(new Uint8ClampedArray(pixels.rgba), pixels.width, pixels.height);
      assert.equal(result?.data, link.link, "An independent decoder recovers only the public short URL");
      return pixels;
    };
    for (const [mode, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(origin + "/"); await page.getByRole("link", { name: "QR code", exact: true }).click();
      await page.getByRole("heading", { name: "QR code", exact: true }).waitFor();
      await page.waitForFunction(() => !document.getElementById("qr-print").disabled);
      assert.equal(await page.locator(".qr-sheet figcaption").innerText(), link.link);
      const controls = page.getByRole("form", { name: "QR settings" });
      await controls.getByLabel("Size (px)").fill("256");
      await controls.getByLabel("Error correction").selectOption("H");
      await controls.getByRole("button", { name: "Apply", exact: true }).click();
      await page.waitForURL(/size=256&level=H/); await page.waitForFunction(() => !document.getElementById("qr-print").disabled);
      assert.equal(await page.locator("#qr-preview").evaluate(img => img.naturalWidth), 256);
      assert.equal(await controls.evaluate(form => getComputedStyle(form).flexDirection), "row", "Settings stay in a compact wrapping toolbar");
      const heading = await page.locator(".qr-page .archive-heading").boundingBox();
      assert((await page.locator(".qr-controls").boundingBox()).y >= heading.y + heading.height, "Navigation cannot overlap settings");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), mode + " overflow");
      await page.getByRole("button", { name: "Copy QR image", exact: true }).click();
      await page.getByRole("status").getByText("QR image copied.", { exact: true }).waitFor();
      assert.equal((await decodedImage(Buffer.from(await page.evaluate(() => window.copiedPNG)), "image/png")).width, 256);
      await page.evaluate(() => { window.denyCopy = true; });
      await page.getByRole("button", { name: "Copy QR image", exact: true }).click();
      await page.getByRole("status").getByText(/Could not copy image/).waitFor();
      await page.evaluate(() => { window.denyCopy = false; });
      await page.getByRole("button", { name: "Copy QR image", exact: true }).click();
      await page.getByRole("status").getByText("QR image copied.", { exact: true }).waitFor();
      assert(!(await page.getByRole("button", { name: "Copy QR image", exact: true }).isDisabled()));
      await page.evaluate(() => {
        window.originalToBlob = HTMLCanvasElement.prototype.toBlob;
        HTMLCanvasElement.prototype.toBlob = callback => callback(null);
      });
      await page.getByRole("button", { name: "Copy QR image", exact: true }).click();
      await page.getByRole("status").getByText(/Could not copy image/).waitFor();
      await page.evaluate(() => { HTMLCanvasElement.prototype.toBlob = window.originalToBlob; });
      const count = await page.evaluate(() => window.copyWrites);
      await page.evaluate(() => {
        const button = document.getElementById("qr-copy");
        button.dispatchEvent(new MouseEvent("click"));
        button.dispatchEvent(new MouseEvent("click"));
      });
      await page.getByRole("status").getByText("QR image copied.", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.copyWrites), count + 1, "One write for overlapping clicks");
      await page.screenshot({ path: path.join(evidence, `qr-${mode}.png`), fullPage: true });
      for (const format of ["PNG", "SVG"]) {
        const pending = page.waitForEvent("download"); await page.getByRole("link", { name: "Download " + format, exact: true }).click();
        const download = await pending; assert.equal(download.suggestedFilename(), `kutt-qr-${link.id}.${format.toLowerCase()}`);
        const bytes = readFileSync(await download.path());
        const pixels = await decodedImage(bytes, format === "PNG" ? "image/png" : "image/svg+xml");
        assert.equal(pixels.width, 256); assert.equal(pixels.height, 256);
      }
      const large = await context.request.get(origin + `/api/links/${link.id}/qr?size=1024&level=H`);
      assert.equal(large.status(), 200);
      assert.equal((await decodedImage(await large.body(), "image/png")).width, 1024, "Exact-size PNG independently decodes at the upper bound");
      await page.evaluate(() => { window.printCalls = 0; window.print = () => { window.printCalls++; }; });
      await page.getByRole("button", { name: "Print", exact: true }).click();
      assert.equal(await page.evaluate(() => window.printCalls), 1);
      await page.emulateMedia({ media: "print" });
      assert(await page.locator(".qr-controls").isHidden()); assert(await page.locator(".qr-page .archive-heading").isHidden());
      assert(await page.locator(".qr-sheet").isVisible());
      await page.screenshot({ path: path.join(evidence, `qr-print-${mode}.png`), fullPage: true });
      const pdf = await page.pdf({ path: path.join(evidence, `qr-${mode}.pdf`), format: "A4", printBackground: true });
      assert(pdf.length > 4000);
      await page.emulateMedia({ media: "screen" });
      await page.getByRole("link", { name: "Library", exact: true }).click();
      await page.getByRole("link", { name: "QR code", exact: true }).click();
      await page.waitForFunction(() => !document.getElementById("qr-print").disabled);
      for (const [kind, expected] of [["links", "qr-browser-validation"], ["domains", domain]]) {
        await page.goto(origin + "/admin");
        if (kind === "domains") {
          await page.getByRole("tab", { name: "Domains", exact: true }).click();
          await page.locator("th.domains-address").waitFor();
          await page.waitForFunction(() => !document.querySelector(".htmx-request, .htmx-swapping, .htmx-settling"));
          await page.locator("#main-table-wrapper tbody").evaluate(async body => {
            for (const animation of body.getAnimations({ subtree: true })) await animation.finished;
          });
        }
        const filtered = page.waitForResponse(r => r.url().includes(`/api/${kind}/admin?`) && r.url().includes("user=12345"));
        await page.locator("#search_user").fill(account.email);
        await page.locator("#search_user").press("End");
        const filteredResponse = await filtered;
        assert.equal(filteredResponse.status(), 200);
        assert((await filteredResponse.text()).includes(expected));
        await page.waitForFunction(expected => !document.querySelector(".htmx-request, .htmx-swapping, .htmx-settling") &&
          document.querySelector("#main-table-wrapper tbody")?.textContent.includes(expected), expected);
        await page.locator("#main-table-wrapper tbody").evaluate(async body => {
          for (const animation of body.getAnimations({ subtree: true })) await animation.finished;
        });
        assert.equal(await page.locator("#main-table-wrapper tbody").evaluate(body => getComputedStyle(body).opacity), "1", "Filtered rows finish fading in");
        await page.locator("#main-table-wrapper table").evaluate(table => { table.scrollLeft = 0; });
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), mode + " admin page overflow");
        await page.screenshot({ path: path.join(evidence, `admin-${kind}-filter-${mode}.png`), fullPage: true });
      }
      await page.goto(origin + "/link/qr/" + link.id);
      await page.waitForFunction(() => !document.getElementById("qr-print").disabled);
    }
    await page.route("**/api/links/*/qr?*", route => route.abort());
    await page.reload(); await page.getByRole("alert").getByText(/QR image could not load/).waitFor();
    assert(await page.getByRole("button", { name: "Print", exact: true }).isDisabled());
    assert(await page.getByRole("button", { name: "Copy QR image", exact: true }).isDisabled());
    await page.screenshot({ path: path.join(evidence, "qr-image-failure.png"), fullPage: true });
    await page.unroute("**/api/links/*/qr?*"); await page.reload();
    await page.waitForFunction(() => !document.getElementById("qr-print").disabled);
    await page.evaluate(() => { sessionStorage.setItem("noImageClipboard", "1"); });
    await page.reload();
    await page.waitForFunction(() => !document.getElementById("qr-print").disabled);
    assert(await page.getByRole("button", { name: "Copy QR image", exact: true }).isDisabled());
    assert(await page.getByRole("link", { name: "Download PNG", exact: true }).isVisible());
    const library = await context.request.get(origin + "/api/links", { headers: { Accept: "application/json" } });
    const data = await library.json();
    assert.equal(data.data.find(row => row.id === link.id).visit_count, 0);
    assert.deepEqual(errors, []);
    console.log(`PASS: desktop/mobile QR navigation, decoded PNG clipboard/downloads, denial/retry/unsupported controls, print/PDF, image recovery, admin numeric-email search and no visits; ${evidence}`);
  } catch (error) { if (page) await page.screenshot({ path: path.join(evidence, "qr-failure.png"), fullPage: true }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
