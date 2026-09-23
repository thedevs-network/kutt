const assert = require("node:assert/strict");
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
    const owner = await browser.newContext(), editor = await browser.newContext();
    const headers = { Accept: "application/json" };
    const call = async (context, method, endpoint, data, status = 200) => {
      const response = await context.request.fetch(origin + endpoint, { method, data, headers, maxRedirects: 0 });
      assert.equal(response.status(), status, await response.text());
      return status === 204 ? undefined : response.json();
    };
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await owner.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready);
    const password = randomBytes(32).toString("hex");
    const admin = await call(owner, "POST", "/api/auth/create-admin", { email: "workspace-race-owner@example.invalid", password }, 201);
    await owner.addCookies([{ name: "token", value: admin.token, url: origin }]);
    const email = "workspace-race-editor@example.invalid";
    await call(owner, "POST", "/api/users/admin", { email, password, verified: true }, 201);
    const login = await call(editor, "POST", "/api/auth/login", { email, password });
    await editor.addCookies([{ name: "token", value: login.token, url: origin }]);
    const page = await editor.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const submit = async (form, status) => {
      const response = page.waitForResponse(r => r.url().includes("/settings/workspaces/") && r.request().method() === "POST");
      await form.getByRole("button", { name: "Save link", exact: true }).click();
      assert.equal((await response).status(), status);
      await page.waitForLoadState("networkidle");
    };
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      const space = await call(owner, "POST", "/api/workspaces", { name: "Browser race " + width }, 201);
      const base = "/api/workspaces/" + space.id, url = origin + "/settings/workspaces/" + space.id;
      const invite = await call(owner, "POST", base + "/members", { email, role: "editor" }, 201);
      await call(editor, "POST", "/api/workspaces/invitations/" + invite.id + "/accept", {});
      const link = await call(owner, "POST", base + "/links", { target: "https://192.0.2.1/browser", address: "workspace-race-" + width }, 201);
      const state = async () => (await call(owner, "GET", base)).data.find(l => l.id === link.id);
      const open = async () => {
        await page.goto(url);
        await page.locator("#workspace-edit-" + link.id + " > summary").click();
      };
      const form = page.getByRole("form", { name: "Edit workspace-race-" + width, exact: true });
      await open();
      await form.getByLabel("Description", { exact: true }).fill("My retained draft " + width);
      await call(owner, "PATCH", "/api/links/" + link.id + "/lifecycle", { paused: true, max_visits: 19, starts_at: "2080-01-01T00:00:00Z", ends_at: "2081-01-01T00:00:00Z" });
      await submit(form, 409);
      assert.equal((await state()).paused, true);
      assert.equal((await state()).max_visits, 19);
      assert.equal(await form.getByLabel("Description", { exact: true }).inputValue(), "My retained draft " + width);
      assert.equal(await form.getByLabel("Paused", { exact: true }).isChecked(), false);
      assert.equal(await page.locator(".workspace-edit-error").evaluate(el => el === document.activeElement), true);
      assert.equal(await page.getByRole("alert").count(), 1);
      assert.equal(await page.locator(".workspace-edit-error").evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }), true);
      assert(await page.getByRole("region", { name: "Current saved values" }).isVisible());
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(evidence, `workspace-conflict-${width}.png`), fullPage: true, animations: "disabled" });
      // Deliberate reconciliation preserves the other client's availability.
      await form.getByLabel("Paused", { exact: true }).check();
      await form.getByLabel("Maximum redirects", { exact: true }).fill("19");
      await form.getByLabel("Start (UTC)").fill("2080-01-01T00:00");
      await form.getByLabel("End (UTC)").fill("2081-01-01T00:00");
      await submit(form, 303);
      assert.equal((await state()).description, "My retained draft " + width);
      assert.equal((await state()).paused, true);
      assert.equal((await owner.request.get(origin + "/workspace-race-" + width, { maxRedirects: 0 })).status(), 410);

      await open();
      await form.getByLabel("Alias", { exact: true }).fill("bad alias");
      await form.getByLabel("Description", { exact: true }).fill("Correct this without losing me");
      await form.getByLabel("Maximum redirects", { exact: true }).fill("7");
      await form.getByLabel("New password", { exact: true }).fill("temporary-test-password");
      await submit(form, 400);
      assert.equal(await form.getByLabel("Alias", { exact: true }).inputValue(), "bad alias");
      assert.equal(await form.getByLabel("Maximum redirects", { exact: true }).inputValue(), "7");
      assert.equal(await form.getByLabel("New password", { exact: true }).inputValue(), "");
      assert(!await page.content().then(text => text.includes("temporary-test-password")));
      assert(await form.getByText("Password was not retained. Enter it again to change protection.", { exact: true }).isVisible());
      assert.equal((await state()).max_visits, 19);
      assert.equal(await form.getByLabel("Paused", { exact: true }).evaluate(el => getComputedStyle(el, "::after").content), "none");
      assert(await form.getByLabel("Paused", { exact: true }).isChecked());
      await page.screenshot({ path: path.join(evidence, `workspace-validation-${width}.png`), fullPage: true, animations: "disabled" });
      await form.getByLabel("Alias", { exact: true }).fill("workspace-race-" + width);
      await submit(form, 303);
      assert.equal((await state()).max_visits, 7);
      assert.equal((await state()).password, false);
      await open();
      await call(owner, "PATCH", base + "/members/" + invite.id, { role: "viewer" }, 204);
      await submit(form, 403);
      assert.equal(await page.getByRole("button", { name: "Save link", exact: true }).count(), 0);
      assert.equal((await state()).paused, true);
    }
    assert.deepEqual(errors, []);
    console.log("PASS: shared conflict/current-state review, retained validation drafts, password re-entry, focused visible errors and revocation at 1440/390/320px; " + evidence);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
