const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert(evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  const errors = [], expectedErrors = [], results = [];
  let injectingFailure = false, cancellingRequest = false;
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      window.dialogEvents = [];
      for (const name of ["beforeRequest", "beforeOnLoad", "afterRequest", "responseError", "sendAbort", "afterSettle"]) {
        document.addEventListener("htmx:" + name, event => {
          window.dialogEvents.push({ name, target: event.detail.target?.id, status: event.detail.xhr?.status,
            successful: event.detail.successful, message: document.querySelector("dialog[open] .dialog-status")?.textContent });
          if (window.dialogEvents.length > 40) window.dialogEvents.shift();
        });
      }
    });
    const request = async (method, url, data, status = 200) => {
      const response = await context.request.fetch(origin + url, { method, data, headers: { Accept: "application/json" } });
      assert.equal(response.status(), status, url); return response.json();
    };
    for (let i = 0; i < 100; i++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const account = await request("POST", "/api/auth/create-admin", {
      email: "dialog-admin@example.invalid", password: randomBytes(32).toString("hex")
    }, 201);
    await context.addCookies([{ name: "token", value: account.token, url: origin }]);
    const link = await request("POST", "/api/links", { target: "https://example.org/modal", customurl: "dialog-fixture" }, 201);
    const email = "dialog-other@example.invalid";
    await request("POST", "/api/users/admin", { email, password: randomBytes(32).toString("hex"), verified: true }, 201);
    await require("./browser-domain-fixture.cjs")(context, origin, "dialog-owned.example.invalid");
    await request("POST", "/api/domains/admin", { address: "dialog-unowned.example.invalid" });
    page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      if (message.type() !== "error") return;
      const text = message.text();
      if ((cancellingRequest && /htmx:(sendAbort|afterRequest)/.test(text)) ||
          (injectingFailure && /500|htmx:(responseError|afterRequest|sendError|timeout)|net::ERR_/.test(text))) expectedErrors.push(text);
      else errors.push(text);
    });
    const settled = async () => {
      await page.waitForLoadState("networkidle");
      await page.waitForFunction(() => !document.querySelector(".htmx-request"));
    };
    const goto = async route => { assert.equal((await page.goto(origin + route)).status(), 200); await settled(); };
    const modal = () => page.locator("dialog.dialog[open]");
    const focusInside = async () => assert(await modal().evaluate(node => node.contains(document.activeElement)), "Modal owns focus");
    const inspect = async (label, width) => {
      await settled();
      const dialog = modal(); assert.equal(await dialog.count(), 1);
      await dialog.locator(".content-wrapper .content:visible, .content-wrapper canvas:visible, .content-wrapper img:visible").first().waitFor();
      await settled();
      await dialog.evaluate(async node => {
        await Promise.all(node.getAnimations({ subtree: true })
          .filter(animation => Number.isFinite(animation.effect.getComputedTiming().endTime))
          .map(animation => animation.finished.catch(() => {})));
      });
      assert.equal(await dialog.getAttribute("aria-modal"), "true");
      const title = await dialog.getAttribute("aria-labelledby");
      assert(title ? (await page.locator("#" + title).textContent()).trim() : await dialog.getAttribute("aria-label"));
      await focusInside();
      // Native modal isolation also rejects programmatic background focus.
      await page.locator(".main-wrapper > header a").first().evaluate(node => node.focus());
      await focusInside();
      const count = await dialog.locator("button:visible:enabled, input:visible:enabled, select:visible:enabled, a[href]:visible").count();
      for (const key of ["Tab", "Shift+Tab"]) for (let i = 0; i < count + 2; i++) {
        await page.keyboard.press(key); await focusInside();
      }
      const box = dialog.locator(".box");
      const geometry = await box.evaluate(node => {
        const r = node.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom,
          width: innerWidth, height: innerHeight, scroll: node.scrollWidth, client: node.clientWidth };
      });
      assert(geometry.left >= 0 && geometry.right <= geometry.width + 1 && geometry.top >= 0 &&
        geometry.bottom <= geometry.height + 1 && geometry.scroll <= geometry.client + 1,
        "Dialog fits viewport without hidden horizontal content: " + JSON.stringify({ label, geometry }));
      await page.screenshot({ path: path.join(evidence, `${label}-${width}.png`) });
      results.push({ label, width, focusable: count });
    };
    const exercise = async (name, label, width, close = "Escape") => {
      const opener = page.getByRole("button", { name, exact: true });
      await opener.focus(); await page.keyboard.press("Enter"); await modal().waitFor();
      await inspect(label, width);
      if (close === "Escape") await page.keyboard.press("Escape");
      else await modal().getByRole("button", { name: close, exact: true }).click();
      assert.equal(await modal().count(), 0);
      assert(await opener.evaluate(node => document.activeElement === node), "Focus returns to opener");
    };
    for (const width of process.env.KUTT_DIALOG_ERRORS_ONLY === "1" ? [] : [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 }); await goto("/");
      await exercise("Move " + link.address + " to trash", "personal-trash", width);
      await exercise("Move " + link.address + " to trash", "personal-cancel", width, "Cancel");
      await goto("/admin");
      await exercise("Ban " + link.address, "admin-ban-link", width);
      await exercise("Move " + link.address + " to trash", "admin-trash", width, "Close dialog");
      await exercise("QR code for " + link.address, "admin-qr", width);
      await page.getByRole("tab", { name: "Users", exact: true }).click(); await settled();
      await exercise("Create user", "admin-create-user", width);
      await exercise("Ban user " + email, "admin-ban-user", width);
      await exercise("Delete user " + email, "admin-delete-user", width);
      await page.getByRole("tab", { name: "Domains", exact: true }).click(); await settled();
      await exercise("Add domain", "admin-add-domain", width);
      await exercise("Ban domain dialog-unowned.example.invalid", "admin-ban-domain", width);
      await exercise("Delete domain dialog-unowned.example.invalid", "admin-delete-domain", width);
      await goto("/settings");
      await exercise("Delete domain dialog-owned.example.invalid", "owner-delete-domain", width);
      console.log(`PASS: all personal/admin/domain modals, keyboard loop, Escape/cancel and focus restoration at ${width}px`);
    }
    await goto("/admin");
    let release, intercepted;
    const gate = new Promise(resolve => { release = resolve; });
    const ready = new Promise(resolve => { intercepted = resolve; });
    const pattern = "**/confirm-link-delete?*";
    await page.route(pattern, async route => {
      intercepted(); await gate;
      try { await route.fulfill({ status: 200, contentType: "text/html", body: '<div class="content"><h2>Stale cancelled response</h2></div>' }); } catch {}
    });
    await page.getByRole("button", { name: "Move " + link.address + " to trash", exact: true }).click();
    await ready; await focusInside();
    cancellingRequest = true;
    await modal().getByRole("button", { name: "Close dialog", exact: true }).click();
    assert.equal(await modal().count(), 0);
    await page.getByRole("button", { name: "Ban " + link.address, exact: true }).click();
    release(); await settled(); await page.unroute(pattern);
    cancellingRequest = false;
    assert.equal(await page.getByText("Stale cancelled response").count(), 0);
    await modal().getByRole("heading", { name: "Ban link?", exact: true }).waitFor();
    await page.keyboard.press("Escape");
    injectingFailure = true;
    await page.route(pattern, route => route.fulfill({ status: 500, contentType: "text/plain", body: "synthetic failure" }));
    await page.getByRole("button", { name: "Move " + link.address + " to trash", exact: true }).click();
    await modal().getByRole("status").filter({ hasText: "Could not load" }).waitFor();
    await page.keyboard.press("Escape"); await page.unroute(pattern); injectingFailure = false;
    await page.getByRole("tab", { name: "Users", exact: true }).click(); await settled();
    await page.getByRole("button", { name: "Create user", exact: true }).click(); await settled();
    await modal().getByRole("button", { name: "Create", exact: true }).click(); await settled();
    assert(await modal().locator("label.error").count(), "Server validation remains in modal");
    await focusInside(); await page.keyboard.press("Escape");
    let releaseWrite, sawWrite, writeCount = 0;
    const writeGate = new Promise(resolve => { releaseWrite = resolve; });
    const writeReady = new Promise(resolve => { sawWrite = resolve; });
    await page.route("**/api/users/admin", async route => {
      if (route.request().method() !== "POST") return route.continue();
      writeCount++;
      sawWrite(); await writeGate; await route.continue();
    });
    await page.getByRole("button", { name: "Create user", exact: true }).click(); await settled();
    await modal().getByLabel("Email address:", { exact: true }).fill("dialog-created@example.invalid");
    await modal().getByLabel("Password:", { exact: true }).fill(randomBytes(32).toString("hex"));
    await modal().getByRole("button", { name: "Create", exact: true }).click(); await writeReady;
    await page.keyboard.press("Escape"); assert.equal(await modal().count(), 1, "Do not imply a pending write was cancelled");
    assert(await modal().getByRole("button", { name: "Close dialog", exact: true }).isDisabled());
    await modal().getByLabel("Email address:", { exact: true }).focus();
    await page.keyboard.press("Enter"); await page.keyboard.press("Enter");
    releaseWrite(); await settled(); await page.unroute("**/api/users/admin");
    assert.equal(writeCount, 1, "Pending repeated Enter cannot queue another write");
    await modal().getByText("The user", { exact: false }).waitFor();
    await focusInside(); await modal().getByRole("button", { name: "Close", exact: true }).click();
    assert.equal(await modal().count(), 0);
    assert((await request("GET", "/api/links")).data.some(item => item.id === link.id), "Cancellation never trashes link");
    await page.getByRole("button", { name: "Create user", exact: true }).click(); await settled();
    await modal().getByLabel("Email address:", { exact: true }).fill("dialog-retry@example.invalid");
    await modal().getByLabel("Password:", { exact: true }).fill(randomBytes(32).toString("hex"));
    injectingFailure = true;
    await page.route("**/api/users/admin", route => route.request().method() === "POST" ?
      route.fulfill({ status: 500, contentType: "text/plain", body: "synthetic failure" }) : route.continue());
    await modal().getByRole("button", { name: "Create", exact: true }).click(); await settled();
    await modal().getByRole("status").filter({ hasText: "Check the saved state" }).waitFor();
    assert.equal(await modal().getByLabel("Email address:", { exact: true }).inputValue(), "dialog-retry@example.invalid");
    assert(!(await modal().getByRole("button", { name: "Close dialog", exact: true }).isDisabled()));
    await page.unroute("**/api/users/admin"); injectingFailure = false;
    await modal().getByRole("button", { name: "Create", exact: true }).click(); await settled();
    await modal().getByText("The user", { exact: false }).waitFor();
    await modal().getByRole("button", { name: "Close", exact: true }).click();
    await goto("/");
    await page.getByRole("button", { name: "Move " + link.address + " to trash", exact: true }).click(); await settled();
    await modal().getByRole("button", { name: "Move to trash", exact: true }).click(); await settled();
    await modal().getByRole("button", { name: "Close", exact: true }).click();
    assert.equal(await modal().count(), 0);
    assert(await page.locator("#main-table-wrapper h2").evaluate(node => node === document.activeElement),
      "Deleted trigger restores focus to the remaining section heading: " + JSON.stringify(await page.evaluate(() => ({
        tag: document.activeElement?.tagName, id: document.activeElement?.id,
        headingCount: document.querySelectorAll("#main-table-wrapper h2").length,
        headingTabindex: document.querySelector("#main-table-wrapper h2")?.getAttribute("tabindex")
      }))));
    assert.equal((await context.request.get(origin + "/" + link.address)).status(), 410);
    assert.deepEqual(errors, []);
    writeFileSync(path.join(evidence, "dialog-results.json"), JSON.stringify({ results, errors, expectedErrors }, null, 2));
    console.log("PASS: cancelled slow GET/stale response, load/write failure and retry, retained validation, one pending write, success and removed-opener focus; cancelled actions preserve records");
  } catch (error) {
    if (page) console.error(await page.evaluate(() => window.dialogEvents));
    if (page) await page.screenshot({ path: path.join(evidence, "dialog-failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
