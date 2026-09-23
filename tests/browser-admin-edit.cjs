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
    const admin = await browser.newContext(), owner = await browser.newContext();
    const headers = { Accept: "application/json" };
    const call = async (context, method, endpoint, data, status = 200) => {
      const response = await context.request.fetch(origin + endpoint, { method, data, headers, maxRedirects: 0 });
      assert.equal(response.status(), status, await response.text());
      return response.json();
    };
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { ready = (await admin.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready);
    const password = randomBytes(32).toString("hex"), email = "admin-editor-owner@example.invalid";
    const setup = await call(admin, "POST", "/api/auth/create-admin", { email: "admin-editor@example.invalid", password }, 201);
    await admin.addCookies([{ name: "token", value: setup.token, url: origin }]);
    await call(admin, "POST", "/api/users/admin", { email, password, verified: true }, 201);
    const login = await call(owner, "POST", "/api/auth/login", { email, password });
    await owner.addCookies([{ name: "token", value: login.token, url: origin }]);
    const page = await admin.newPage(), errors = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", msg => { if (["error", "warning"].includes(msg.type())) errors.push(msg.text()); });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      const link = await call(owner, "POST", "/api/links", { target: "https://192.0.2.1/admin-browser", customurl: "admin-browser-" + width, paused: true, max_visits: 23 }, 201);
      const state = async () => (await call(owner, "GET", "/api/links")).data.find(l => l.id === link.id);
      await page.goto(origin + "/admin");
      await page.waitForLoadState("networkidle");
      const row = page.locator("#tr-" + link.id), form = page.locator("#edit-form-" + link.id);
      await row.locator("button.edit").click();
      const save = async message => {
        const previous = await form.elementHandle();
        await form.getByRole("button", { name: "Update", exact: true }).click();
        await previous.waitForElementState("hidden");
        await form.getByText(message, { exact: true }).waitFor();
        assert.equal(await form.getAttribute("hx-patch"), "/api/links/admin/{id}");
        assert.equal(await page.locator("#lifecycle-" + link.id).count(), 0);
        assert.equal(await row.getByLabel("View user", { exact: true }).innerText(), email);
        assert.equal(await row.getByLabel("View links by this user", { exact: true }).count(), 1);
        assert.equal((await state()).paused, true); assert.equal((await state()).max_visits, 23);
      };
      await form.getByLabel("Description:", { exact: true }).fill("Saved admin context " + width);
      await save("Link has been updated.");
      for (const [name, invalid, correct, message] of [
        ["target", "not a url", link.target, "URL is not valid."],
        ["address", "bad alias", link.address, "Custom URL is not valid"],
        ["expire_in", "nonsense", "", "Expire format is invalid. Valid examples: 1m, 8h, 42 days."]
      ]) {
        const input = form.locator('[name="' + name + '"]');
        await input.fill(invalid);
        await form.getByLabel("Description:", { exact: true }).fill("Draft " + invalid);
        const before = await state();
        await save(message);
        assert.equal(await input.inputValue(), invalid);
        assert.deepEqual(await state(), before);
        if (name === "address") {
          await form.scrollIntoViewIfNeeded();
          await page.screenshot({ path: path.join(evidence, `admin-validation-${width}.png`), fullPage: true, animations: "disabled" });
        }
        await input.fill(correct);
        await save("Link has been updated.");
      }
      await save("Should at least update one field.");
      await form.getByRole("button", { name: "Close", exact: true }).click();
      assert.equal(await form.count(), 0);
      await row.locator("button.edit").click();
      assert.equal(await form.getByLabel("Description:", { exact: true }).inputValue(), "Draft nonsense");
      await form.getByRole("button", { name: "Close", exact: true }).click();
      await row.getByLabel("View links by this user", { exact: true }).click();
      await page.waitForLoadState("networkidle");
      assert.equal(await row.count(), 1);
    }
    assert.deepEqual(errors, []);
    console.log("PASS: native admin save/error/retry, owner labels/filtering, no-change, repeated open/close and unchanged availability at 1440/390/320px; " + evidence);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
