const assert = require("node:assert/strict");
const { locale, t } = require("./browser-locale.cjs");
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
  try {
    const context = await browser.newContext({ locale, extraHTTPHeaders: { "Accept-Language": locale } });
    const call = async (method, route, data, expected = 200) => {
      const response = await context.request.fetch(origin + route, { method, data, headers: { Accept: "application/json" }, maxRedirects: 0 });
      assert.equal(response.status(), expected, route + ": " + await response.text());
      return expected === 204 ? null : response.json();
    };
    const admin = await call("POST", "/api/auth/create-admin", { email: "sort-browser@example.invalid", password: randomBytes(32).toString("hex") }, 201);
    await context.addCookies([{ name: "token", value: admin.token, url: origin }]);
    const links = [];
    for (let i = 11; i >= 0; i--) links.push(await call("POST", "/api/links", { customurl: "sort-ui-" + String(i).padStart(2, "0"), target: "https://example.org/" + i }, 201));
    const workspace = await call("POST", "/api/workspaces", { name: "Sorted team" }, 201);
    for (const link of links) await call("POST", "/api/workspaces/" + workspace.id + "/shares", { link_id: link.id }, 204);
    const page = await context.newPage(), errors = [];
    page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const settle = async () => { await page.waitForLoadState("networkidle"); await page.waitForFunction(() => !document.querySelector(".htmx-request,.htmx-swapping,.htmx-settling")); };
    const tableChange = async action => {
      const response = page.waitForResponse(r => /\/api\/(links|users|domains)/.test(new URL(r.url()).pathname) && r.request().method() === "GET");
      response.catch(() => {});
      await action(); assert.equal((await response).status(), 200); await settle();
    };
    const rows = () => page.locator('#main-table-wrapper tbody tr[id^="tr-"]');
    const shot = async name => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + " page fits");
      for (const control of await page.locator(".list-sort-select:visible").all()) {
        await control.scrollIntoViewIfNeeded();
        const box = await control.boundingBox();
        assert(box && box.x >= 0 && box.x + box.width <= page.viewportSize().width + 1 && box.width > 40 && box.height >= 32 && box.height <= 48,
          name + " control bounds: " + JSON.stringify(box));
        assert(await control.evaluate(node => {
          const style = getComputedStyle(node), canvas = document.createElement("canvas"), context = canvas.getContext("2d");
          context.font = style.font;
          return context.measureText(node.selectedOptions[0].textContent.trim()).width <= node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        }), name + " selected label fits");
      }
      await page.screenshot({ path: path.join(evidence, name + ".png"), fullPage: true, animations: "disabled" });
      // Admin uses display:contents for the group; scroll a real control box.
      await page.locator(".list-sort-select:visible").first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidence, name + "-viewport.png"), animations: "disabled" });
    };
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin + "/"); await settle();
      await page.screenshot({ path: path.join(evidence, "initial-" + width + ".png"), fullPage: true });
      await tableChange(() => page.getByLabel(t("sorting.field"), { exact: true }).selectOption("address"));
      await tableChange(() => page.getByLabel(t("sorting.direction"), { exact: true }).selectOption("asc"));
      assert.equal(await rows().first().getAttribute("id"), "tr-" + links.at(-1).id);
      await tableChange(() => page.getByRole("button", { name: t("ui.next_page"), exact: true }).first().click());
      assert.equal(await rows().count(), 2);
      await tableChange(() => page.getByLabel(t("sorting.direction"), { exact: true }).selectOption("desc"));
      assert.equal(await page.locator("#skip").inputValue(), "0");
      assert.equal(await rows().first().getAttribute("id"), "tr-" + links[0].id);
      await shot("personal-" + width);
      await page.goto(origin + "/admin"); await settle();
      for (const tab of [t("ui.users"), t("ui.domains"), t("ui.links")]) {
        await tableChange(() => page.getByRole("tab", { name: tab, exact: true }).click());
        assert.equal(await page.getByLabel(t("sorting.field"), { exact: true }).inputValue(), "id");
        await tableChange(() => page.getByLabel(t("sorting.field"), { exact: true }).selectOption(tab === t("ui.links") ? "visit_count" : "links_count"));
        await shot("admin-" + tab.toLowerCase() + "-" + width);
      }
      for (const [route, form, list] of [["/settings/library", t("ui.filter_links"), ".library-links > li"],
        ["/settings/workspaces/" + workspace.id, t("ui.filter_shared_links"), ".workspace-links > li"]]) {
        await page.goto(origin + route); await settle();
        const filter = page.getByRole("form", { name: form, exact: true });
        await filter.getByLabel(t("sorting.field"), { exact: true }).selectOption("address");
        await filter.getByLabel(t("sorting.direction"), { exact: true }).selectOption("asc");
        await filter.getByRole("button", { name: t("ui.filter"), exact: true }).click(); await settle();
        assert.equal(new URL(page.url()).searchParams.get("sort"), "address");
        assert.equal(new URL(page.url()).searchParams.get("direction"), "asc");
        assert((await page.locator(list).first().textContent()).includes("sort-ui-00"));
        await shot((form === t("ui.filter_links") ? "library-" : "workspace-") + width);
        if (form === t("ui.filter_shared_links")) {
          await page.getByText(t("ui.workspace_and_members"), { exact: true }).click();
          const candidates = page.getByRole("form", { name: t("ui.find_personal_link"), exact: true });
          await candidates.getByRole("searchbox").fill("sort-ui");
          await candidates.getByRole("button", { name: t("ui.search"), exact: true }).click(); await settle();
          assert.equal(new URL(page.url()).searchParams.get("sort"), "address");
          assert.equal(new URL(page.url()).searchParams.get("direction"), "asc");
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(origin + "/"); await settle();
    await tableChange(() => page.getByLabel(t("sorting.field"), { exact: true }).selectOption("address"));
    await tableChange(() => page.getByLabel(t("sorting.direction"), { exact: true }).selectOption("asc"));
    for (const alias of ["sort-ui-00", "sort-ui-01"]) { await page.getByRole("button", { name: t("ui.edit_value", { value1: alias }), exact: true }).click(); await settle(); }
    assert(await page.getByLabel(t("sorting.field"), { exact: true }).isDisabled());
    assert.equal(await page.getByLabel(t("sorting.field"), { exact: true }).getAttribute("title"), t("sorting.close_editors"));
    const zero = page.locator("#edit-form-" + links.at(-1).id), one = page.locator("#edit-form-" + links.at(-2).id);
    await one.locator('[name="description"]').fill("An unsaved draft");
    await zero.locator('[name="address"]').fill("sort-ui-zz");
    await zero.getByRole("button", { name: t("ui.update"), exact: true }).click(); await settle();
    assert.equal(await one.locator('[name="description"]').inputValue(), "An unsaved draft");
    await zero.getByRole("button", { name: t("ui.close"), exact: true }).click(); await settle();
    assert.equal(await one.locator('[name="description"]').inputValue(), "An unsaved draft");
    await tableChange(() => one.getByRole("button", { name: t("ui.close"), exact: true }).click());
    assert(!(await page.getByLabel(t("sorting.field"), { exact: true }).isDisabled()));
    assert.equal(await rows().first().getAttribute("id"), "tr-" + links.at(-2).id);
    // A list already in flight must not overwrite a newly opened editor or its draft.
    for (const delayedEditor of [false, true]) {
      let releaseList, listStarted, releaseEditor, editorStarted;
      const listGate = new Promise(resolve => { releaseList = resolve; });
      const listReady = new Promise(resolve => { listStarted = resolve; });
      const editorGate = new Promise(resolve => { releaseEditor = resolve; });
      const editorReady = new Promise(resolve => { editorStarted = resolve; });
      let hold = true;
      await page.route("**/api/links?**", async route => {
        if (!hold || route.request().method() !== "GET") return route.continue();
        hold = false;
        const response = await route.fetch(); listStarted(); await listGate; await route.fulfill({ response });
      });
      if (delayedEditor) await page.route("**/link/edit/**", async route => {
        const response = await route.fetch(); editorStarted(); await editorGate; await route.fulfill({ response });
      });
      await page.evaluate(() => htmx.trigger(document.querySelector("table[hx-get]"), "reloadMainTable"));
      await listReady;
      await page.getByRole("button", { name: t("ui.edit_value", { value1: "sort-ui-01" }), exact: true }).click();
      if (delayedEditor) await editorReady;
      else await one.locator('[name="description"]').fill("A draft opened after refresh");
      const listResponse = page.waitForResponse(r => new URL(r.url()).pathname === "/api/links" && r.request().method() === "GET");
      releaseList(); await listResponse;
      if (delayedEditor) { releaseEditor(); await one.waitFor(); await one.locator('[name="description"]').fill("A draft opened after refresh"); }
      await settle();
      assert.equal(await one.locator('[name="description"]').inputValue(), "A draft opened after refresh");
      // Search while an editor is open is deferred, with the selected sort retained.
      await page.getByRole("searchbox", { name: t("ui.search_links"), exact: true }).fill("sort-ui");
      await page.waitForTimeout(650);
      assert.equal(await one.locator('[name="description"]').inputValue(), "A draft opened after refresh");
      await tableChange(() => one.getByRole("button", { name: t("ui.close"), exact: true }).click());
      assert.equal(await rows().first().getAttribute("id"), "tr-" + links.at(-2).id);
      await page.unroute("**/api/links?**");
      if (delayedEditor) await page.unroute("**/link/edit/**");
    }
    assert.deepEqual(errors, []);
    console.log("PASS: sorting at 1440/390/320px, pagination/reset, admin profiles, native Library/workspace state, concurrent drafts and in-flight list/editor races");
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
