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
  let page;
  try {
    const admin = await browser.newContext(), user = await browser.newContext();
    const call = async (context, method, url, data, status = 200) => {
      const response = await context.request.fetch(origin + url, { method, data, headers: { Accept: "application/json" }, maxRedirects: 0 });
      assert.equal(response.status(), status, url); return response.json();
    };
    for (let i = 0; i < 100; i++) {
      try { if ((await admin.request.get(origin + "/api/health")).status() === 200) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const password = randomBytes(32).toString("hex"), email = "table-user-with-a-long-address@example.invalid";
    const setup = await call(admin, "POST", "/api/auth/create-admin", { email: "table-admin@example.invalid", password }, 201);
    await admin.addCookies([{ name: "token", value: setup.token, url: origin }]);
    await call(admin, "POST", "/api/users/admin", { email, password, verified: true }, 201);
    const login = await call(user, "POST", "/api/auth/login", { email, password });
    await user.addCookies([{ name: "token", value: login.token, url: origin }]);
    const pages = { personal: await user.newPage(), admin: await admin.newPage() }, errors = [];
    for (const p of Object.values(pages)) {
      p.setDefaultTimeout(12000); p.on("pageerror", error => errors.push(error.message));
      p.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    }
    const settled = async () => {
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => {
        const body = document.querySelector("#main-table-wrapper tbody");
        return body && getComputedStyle(body).opacity === "1" && !document.querySelector(".htmx-request");
      });
    };
    const goto = async route => { assert.equal((await page.goto(origin + route)).status(), 200); await settled(); };
    const navigate = async control => {
      const response = page.waitForResponse(r => new URL(r.url()).pathname.startsWith("/api/") && r.request().method() === "GET");
      await control.click(); assert.equal((await response).status(), 200); await settled();
    };
    const hit = async locator => {
      await locator.scrollIntoViewIfNeeded();
      const result = await locator.evaluate(node => {
        const b = node.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
        return { inside: b.left >= -1 && b.right <= innerWidth + 1,
          hit: node.contains(document.elementFromPoint(x, y)), width: b.width, height: b.height };
      });
      assert(result.inside && result.hit && result.width > 0 && result.height > 0,
        "Reachable control: " + (await locator.getAttribute("aria-label") || await locator.textContent()));
    };
    const check = async name => {
      const table = page.locator("#main-table-wrapper table");
      assert.equal(await table.count(), 1);
      if ((await page.viewportSize()).width <= 1024) {
        assert(await table.evaluate(node => node.scrollWidth <= node.clientWidth + 1), name + " table does not hide content horizontally");
        const rows = table.locator('tbody tr[id^="tr-"]');
        for (let i = 0; i < await rows.count(); i++) {
          const row = rows.nth(i);
          assert(await row.locator(".table-field-label:visible").count(), name + " labeled row");
          assert(await row.evaluate(node => node.scrollWidth <= node.clientWidth + 1), name + " long content fits row");
        }
      }
      const controls = table.locator('button:visible:enabled, a:visible, input:not([type="hidden"]):visible, select:visible');
      for (let i = 0; i < await controls.count(); i++) await hit(controls.nth(i));
      const empty = table.locator(".no-data td");
      if (await empty.count()) await hit(empty);
      await table.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidence, name + ".png") });
      await table.locator("thead").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(evidence, name + "-toolbar.png") });
    };
    const tabs = async () => {
      for (const name of ["Users", "Domains", "Links"]) {
        await page.getByRole("tab", { name, exact: true }).click(); await settled();
        assert.equal(await page.getByRole("tab", { name, exact: true }).getAttribute("aria-selected"), "true");
        await check("admin-" + name.toLowerCase() + "-" + (await page.viewportSize()).width);
      }
    };
    let primary;
    for (const state of ["empty", "one", "many"]) {
      if (state === "one") primary = await call(user, "POST", "/api/links", {
        target: "https://example.org/" + "long-path-".repeat(35), customurl: "table-layout-long-short-alias",
        description: "Description " + "long-content ".repeat(15)
      }, 201);
      if (state === "many") {
        for (let i = 0; i < 11; i++) await call(user, "POST", "/api/links", { target: "https://example.org/" + i, customurl: "table-page-" + i }, 201);
        await call(admin, "POST", "/api/domains/admin", {
          address: "long-domain-for-responsive-management.example.invalid", homepage: "https://example.org/" + "long-path-".repeat(20)
        });
      }
      for (const width of [1440, 768, 390, 320]) {
        page = pages.personal; await page.setViewportSize({ width, height: 1000 }); await goto("/");
        await check("personal-" + state + "-" + width);
        if (state === "many") {
          await navigate(page.getByRole("button", { name: "Next page", exact: true }).first());
          assert.equal(await page.locator('tbody tr[id^="tr-"]').count(), 2);
          await check("personal-last-" + width);
          await navigate(page.getByRole("button", { name: "Previous page", exact: true }).first());
          await navigate(page.getByRole("button", { name: "Show 20 per page", exact: true }).first());
          assert.equal(await page.locator('tbody tr[id^="tr-"]').count(), 12);
          await page.getByLabel("Search links", { exact: true }).fill(primary.address); await settled();
          await page.waitForFunction(() => document.querySelectorAll('tbody tr[id^="tr-"]').length === 1);
        }
        if (state !== "empty") {
          const row = page.locator("#tr-" + primary.id);
          await row.getByRole("button", { name: "Edit " + primary.address, exact: true }).click(); await settled();
          const editor = page.locator("#edit-form-" + primary.id);
          await hit(editor.getByRole("button", { name: "Close", exact: true }));
          await editor.getByRole("button", { name: "Close", exact: true }).click();
          await row.getByRole("button", { name: "Move " + primary.address + " to trash", exact: true }).click();
          await page.getByRole("heading", { name: "Move link to trash?", exact: true }).waitFor();
          await page.getByRole("button", { name: "Cancel", exact: true }).click();
          assert.equal((await call(user, "GET", "/api/links?limit=50")).data.some(link => link.id === primary.id), true);
        }
        page = pages.admin; await page.setViewportSize({ width, height: 1000 }); await goto("/admin"); await tabs();
        if (state === "many") {
          await page.getByRole("tab", { name: "Domains", exact: true }).click(); await settled();
          await page.getByRole("button", { name: "Ban domain long-domain-for-responsive-management.example.invalid", exact: true }).click();
          await page.getByRole("button", { name: "Cancel", exact: true }).click();
          await page.getByRole("tab", { name: "Users", exact: true }).click(); await settled();
          await page.getByRole("button", { name: "Delete user " + email, exact: true }).click();
          await page.getByRole("button", { name: "Cancel", exact: true }).click();
        }
      }
      console.log("PASS: " + state + " personal/admin rows and actions at 1440/768/390/320px");
    }
    assert.equal((await user.request.get(origin + "/api/links")).status(), 200, "User remains authenticated");
    assert.equal((await user.request.get(origin + "/api/users/admin")).status(), 401, "Legacy admin boundary remains unchanged");
    assert.equal((await user.request.get(origin + "/api/domains/admin")).status(), 401);
    assert.deepEqual(errors, []);
    console.log("PASS: responsive personal/admin tables, visible empty states, long URLs/emails/domains, action hit regions, pagination/search and cancel without mutation");
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "table-failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
