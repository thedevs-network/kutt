const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync } = require("node:fs");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-campaign-ui-"));
  const browser = await chromium.launch({ headless: true }), errors = [];
  let page;
  try {
    const context = await browser.newContext(), headers = { Accept: "application/json" };
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Disposable instance did not become healthy");
    const setup = await context.request.post(origin + "/api/auth/create-admin", { headers, data: { email: "campaign-browser@example.invalid", password: randomBytes(32).toString("hex") } });
    assert.equal(setup.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await setup.json()).token, url: origin }]);
    page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    const settled = async () => {
      await page.waitForFunction(() => !document.querySelector(".htmx-request, .htmx-swapping, .htmx-settling"));
      await page.evaluate(async () => { for (const animation of document.body.getAnimations({ subtree: true })) await animation.finished.catch(() => {}); });
    };
    const listing = async alias => (await (await context.request.get(origin + "/api/links?search=" + alias, { headers })).json()).data.find(link => link.address === alias);
    const editCampaign = async (form, mode) => {
      const widget = form.locator("[data-campaign]");
      await widget.locator("summary").click();
      await widget.getByLabel("Source", { exact: true }).fill("newsletter & friends");
      await widget.getByLabel("Medium", { exact: true }).fill("email");
      await widget.getByLabel("Campaign", { exact: true }).fill("été + " + mode);
      assert.equal(await widget.getByLabel("Source", { exact: true }).inputValue(), "newsletter & friends", "Campaign draft retained before apply");
      await widget.getByLabel("Campaign", { exact: true }).press("Enter");
      const url = new URL(await form.locator('[name="target"]').inputValue());
      assert.equal(url.searchParams.get("utm_source"), "newsletter & friends");
      assert.equal(url.searchParams.get("utm_campaign"), "été + " + mode);
      assert.match(await widget.locator("output").textContent(), /not saved yet/);
      return widget;
    };
    for (const [mode, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport); await page.goto(origin + "/");
      assert((await page.title()).length > 0); assert.equal(page.url(), origin + "/");
      const form = page.locator("#shortener-form"), alias = "campaign-ui-" + mode;
      await form.locator('[name="target"]').fill("https://192.0.2.1/product?keep=a&keep=b&utm_source=old#part");
      await form.getByRole("checkbox", { name: "Show advanced options" }).check();
      await form.locator('[name="customurl"]').fill(alias);
      let widget = await editCampaign(form, mode);
      assert.equal(await listing(alias), undefined, "Applying parameters must not create a link");
      const before = await form.locator('[name="target"]').inputValue();
      await widget.getByLabel("Source", { exact: true }).fill("é".repeat(255));
      await widget.getByLabel("Campaign", { exact: true }).fill("é".repeat(255));
      await widget.getByRole("button", { name: "Apply parameters", exact: true }).click();
      assert.match(await widget.locator("output").textContent(), /2040/);
      assert.equal(await form.locator('[name="target"]').inputValue(), before);
      await widget.getByLabel("Source", { exact: true }).fill("newsletter & friends");
      await widget.getByLabel("Campaign", { exact: true }).fill("été + " + mode);
      await widget.getByRole("button", { name: "Apply parameters", exact: true }).click();
      await page.screenshot({ path: path.join(evidence, mode + "-create.png"), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const created = page.waitForResponse(r => r.request().method() === "POST" && r.url() === origin + "/api/links");
      await form.locator("button.submit").click(); assert.equal((await created).status(), 200); await settled();
      let link = await listing(alias); assert(link); assert.equal(link.target, before);
      for (const admin of [false, true]) {
        await page.goto(origin + (admin ? "/admin" : "/")); await settled();
        const row = page.locator("tr").filter({ has: page.locator(`button.edit[hx-vals*="${link.id}"]`) });
        await row.locator("button.edit").click();
        const edit = page.locator("#edit-form-" + link.id); await edit.waitFor(); await settled();
        widget = edit.locator("[data-campaign]"); await widget.locator("summary").click();
        await widget.getByLabel("Source", { exact: true }).waitFor();
        await widget.getByRole("button", { name: "Clear parameters", exact: true }).click();
        const cleared = new URL(await edit.locator('[name="target"]').inputValue());
        assert.equal(cleared.searchParams.has("utm_source"), false); assert.deepEqual(cleared.searchParams.getAll("keep"), ["a", "b"]); assert.equal(cleared.hash, "#part");
        await widget.getByLabel("Content", { exact: true }).fill(admin ? "admin" : "personal");
        await widget.getByRole("button", { name: "Apply parameters", exact: true }).click();
        await page.screenshot({ path: path.join(evidence, mode + (admin ? "-admin.png" : "-edit.png")), fullPage: true });
        const updated = page.waitForResponse(r => r.request().method() === "PATCH" && r.url().includes(link.id));
        await edit.getByRole("button", { name: "Update", exact: true }).click(); assert.equal((await updated).status(), 200); await settled();
        link = await listing(alias); assert.equal(new URL(link.target).searchParams.get("utm_content"), admin ? "admin" : "personal");
      }
      const spaceResponse = await context.request.post(origin + "/api/workspaces", { headers, data: { name: "Campaign UI " + mode } }); assert.equal(spaceResponse.status(), 201);
      const space = await spaceResponse.json(); await page.goto(origin + "/settings/workspaces/" + space.id);
      await page.locator("summary").filter({ hasText: /^Create shared link$/ }).click();
      const shared = page.getByRole("form", { name: "Create shared link", exact: true });
      await shared.getByLabel("Destination", { exact: true }).fill("https://192.0.2.1/workspace");
      await shared.getByLabel("Alias", { exact: true }).fill(alias + "-shared"); await editCampaign(shared, mode);
      await shared.getByRole("button", { name: "Create link", exact: true }).click(); await page.waitForLoadState();
      await page.getByText("Edit link", { exact: true }).click();
      const sharedEdit = page.getByRole("form", { name: "Edit " + alias + "-shared", exact: true });
      widget = await editCampaign(sharedEdit, mode);
      await sharedEdit.getByLabel("Destination", { exact: true }).fill("https://192.0.2.1/replacement?utm_source=manual");
      assert.equal(await widget.getByLabel("Source", { exact: true }).inputValue(), "manual", "Destination edits resynchronize fields");
      await widget.getByLabel("Content", { exact: true }).fill("workspace"); await widget.getByRole("button", { name: "Apply parameters", exact: true }).click();
      await page.screenshot({ path: path.join(evidence, mode + "-workspace.png"), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await sharedEdit.getByRole("button", { name: "Save link", exact: true }).click(); await page.waitForLoadState();
      const saved = await listing(alias + "-shared"); assert.equal(new URL(saved.target).searchParams.get("utm_content"), "workspace");
    }
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/mobile campaign create, apply without save, Enter handling, encoded-length error recovery, clear, personal/admin/workspace edits and target resynchronization; " + evidence);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    console.error({ errors, evidence }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
