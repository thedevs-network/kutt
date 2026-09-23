const assert = require("node:assert/strict");
const { locale, t } = require("./browser-locale.cjs");
const { randomBytes } = require("node:crypto");
const { mkdirSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  const url = new URL(origin);
  assert.equal(url.hostname, "127.0.0.1", "Fresh loopback-only instance required");
  assert.equal(url.origin, origin);
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-dotted-ui-"));
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true }), errors = [];
  let page;
  try {
    const context = await browser.newContext({ locale, extraHTTPHeaders: { "Accept-Language": locale } }), headers = { Accept: "application/json" };
    const target = "https://192.0.2.1/dotted-browser";
    await context.route("**/*", route => {
      const requestURL = new URL(route.request().url());
      if (requestURL.origin === origin) return route.continue();
      return route.abort();
    });
    const call = async (method, endpoint, data, status = 200) => {
      const response = await context.request.fetch(origin + endpoint, { method, data, headers, maxRedirects: 0 });
      assert.equal(response.status(), status, method + " " + endpoint + ": " + await response.text());
      return response.json();
    };
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready);
    const admin = await call("POST", "/api/auth/create-admin", {
      email: "dotted-browser@example.invalid", password: randomBytes(32).toString("hex")
    }, 201);
    await context.addCookies([{ name: "token", value: admin.token, url: origin }]);
    page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (["warning", "error"].includes(message.type())) errors.push(message.type() + ": " + message.text()); });
    const settled = () => page.waitForFunction(() => !document.querySelector(".htmx-request, .htmx-swapping, .htmx-settling"));
    const listing = async address => (await call("GET", "/api/links?search=" + encodeURIComponent(address))).data.find(row => row.address === address);
    const submit = async (form, method, endpoint, button, status = 200) => {
      const pending = page.waitForResponse(response => response.request().method() === method && new URL(response.url()).pathname === endpoint);
      await form.getByRole("button", { name: button, exact: true }).click();
      assert.equal((await pending).status(), status);
      await settled();
    };
    const capture = async name => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Horizontal overflow: " + name);
      await page.screenshot({ path: path.join(evidence, name + ".png"), fullPage: true, animations: "disabled" });
    };
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + "/");
      assert.equal(page.url(), origin + "/"); assert((await page.title()).length > 0);
      const form = page.locator("#shortener-form");
      await form.locator('[name="target"]').fill(target);
      await form.getByRole("checkbox", { name: t("ui.show_advanced_options") }).check();
      const input = form.locator('[name="customurl"]');
      assert.equal(await input.getAttribute("maxlength"), "64");
      assert.equal(await input.getAttribute("pattern"), null);
      const initial = "browser-" + width + "/guide.pdf";
      await input.fill("browser-" + width + "/bad..pdf");
      await submit(form, "POST", "/api/links", t("ui.shorten_link"));
      await form.getByText(t("messages.custom_url_is_not_valid"), { exact: true }).waitFor();
      assert.equal(await form.locator('[name="target"]').inputValue(), target);
      assert.equal(await listing("browser-" + width + "/bad..pdf"), undefined);
      await input.fill(initial);
      await submit(form, "POST", "/api/links", t("ui.shorten_link"));
      let link = await listing(initial); assert(link);
      await capture(width + "-created");
      for (const adminView of [false, true]) {
        await page.goto(origin + (adminView ? "/admin" : "/")); await settled();
        const opener = page.locator('button.edit[hx-vals*="' + link.id + '"]');
        await opener.click();
        const edit = page.locator("#edit-form-" + link.id);
        await edit.waitFor(); await settled();
        const aliasInput = edit.locator('[name="address"]');
        assert.equal(await aliasInput.getAttribute("maxlength"), "64");
        assert.equal(await aliasInput.getAttribute("pattern"), null);
        const endpoint = "/api/links/" + (adminView ? "admin/" : "") + link.id;
        await aliasInput.fill("browser-" + width + "/.hidden");
        await edit.locator('[name="description"]').fill("Keep dotted draft " + width);
        await submit(edit, "PATCH", endpoint, t("ui.update"));
        await edit.getByText(t("messages.custom_url_is_not_valid_2"), { exact: true }).waitFor();
        assert.equal(await edit.locator('[name="description"]').inputValue(), "Keep dotted draft " + width);
        assert(await listing(link.address));
        await capture(width + (adminView ? "-admin-error" : "-personal-error"));
        const previous = link.address, next = "browser-" + width + "/guide." + (adminView ? "admin" : "v2") + ".pdf";
        await aliasInput.fill(next);
        await submit(edit, "PATCH", endpoint, t("ui.update"));
        await edit.getByText(t("messages.link_has_been_updated"), { exact: true }).waitFor();
        link = await listing(next); assert(link);
        assert.equal((await context.request.get(origin + "/" + previous, { maxRedirects: 0 })).status(), 410);
        await capture(width + (adminView ? "-admin-saved" : "-personal-saved"));
      }
      // Check the actual redirect response without contacting its external target.
      const publicURL = origin + "/" + link.address;
      await page.route(publicURL, async route => {
        const response = await route.fetch({ maxRedirects: 0 });
        assert.equal(response.status(), 302); assert.equal(response.headers().location, target);
        await route.fulfill({ status: 200, contentType: "text/plain", body: "Dotted alias destination" });
      });
      await page.goto(publicURL);
      assert.equal(page.url(), publicURL); assert.equal(await page.textContent("body"), "Dotted alias destination");
      await page.unroute(publicURL);
      const space = await call("POST", "/api/workspaces", { name: "Dotted UI " + width }, 201);
      const sharedPath = "/settings/workspaces/" + space.id, sharedAlias = "browser-" + width + "/shared.v1.pdf";
      await page.goto(origin + sharedPath);
      await page.getByText(t("ui.create_shared_link"), { exact: true }).click();
      const shared = page.getByRole("form", { name: t("ui.create_shared_link"), exact: true });
      await shared.getByLabel(t("ui.destination"), { exact: true }).fill(target);
      await shared.getByLabel(t("ui.alias"), { exact: true }).fill(sharedAlias);
      await submit(shared, "POST", sharedPath, t("ui.create_link"), 303);
      await page.waitForLoadState("networkidle");
      const saved = await listing(sharedAlias); assert(saved);
      await page.locator("#workspace-edit-" + saved.id + " > summary").click();
      const sharedEdit = page.locator("#workspace-edit-" + saved.id + " form");
      await sharedEdit.getByLabel(t("ui.alias"), { exact: true }).fill("browser-" + width + "/shared..pdf");
      await sharedEdit.getByLabel(t("ui.description_3"), { exact: true }).fill("Keep shared draft");
      await submit(sharedEdit, "POST", sharedPath, t("ui.save_link"), 400);
      await page.waitForLoadState("networkidle");
      assert.equal(await sharedEdit.getByLabel(t("ui.description_3"), { exact: true }).inputValue(), "Keep shared draft");
      assert(await listing(sharedAlias));
      await capture(width + "-workspace-error");
      const finalAlias = "browser-" + width + "/shared.v2.pdf";
      await sharedEdit.getByLabel(t("ui.alias"), { exact: true }).fill(finalAlias);
      await submit(sharedEdit, "POST", sharedPath, t("ui.save_link"), 303);
      await page.waitForLoadState("networkidle");
      assert.equal((await listing(finalAlias)).id, saved.id);
      await capture(width + "-workspace-saved");
      await page.reload(); assert(await page.getByText(finalAlias, { exact: false }).count());
    }
    // The expected workspace validation response is the only browser HTTP error.
    assert.deepEqual(errors.filter(message => !/^error: Failed to load resource: the server responded with a status of 400 \(Bad Request\)$/.test(message)), []);
    console.log("PASS: dotted alias create/error recovery, personal/admin/workspace rename and drafts, literal public redirect, persisted state and layout at 1440/390/320px; " + evidence);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
