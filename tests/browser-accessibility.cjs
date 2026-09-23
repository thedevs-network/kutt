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
  let page; const errors = [];
  try {
    const admin = await browser.newContext(), user = await browser.newContext();
    await user.addInitScript(() => {
      window.formTrace = [];
      for (const type of ["htmx:beforeRequest", "htmx:afterSwap", "htmx:afterSettle", "htmx:beforeCleanupElement", "htmx:afterProcessNode", "submit"]) {
        document.addEventListener(type, event => {
          const node = event.detail?.elt || event.target;
          if (type === "htmx:afterProcessNode" && !node.matches?.("form, tr.edit")) return;
          if (type === "htmx:beforeCleanupElement" && !node.matches?.("form, tbody, table")) return;
          window.formTrace.push({ type, tag: node.tagName, id: node.id, connected: node.isConnected,
            form: node.closest?.("form")?.id, prevented: event.defaultPrevented });
          window.formTrace = window.formTrace.slice(-80);
        });
      }
    });
    const call = async (context, method, url, data, status = 200) => {
      const res = await context.request.fetch(origin + url, { method, data, headers: { Accept: "application/json" }, maxRedirects: 0 });
      assert.equal(res.status(), status, await res.text());
      return status === 204 ? undefined : res.json();
    };
    for (let i = 0; i < 100; i++) {
      try { if ((await admin.request.get(origin + "/api/health")).status() === 200) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const password = randomBytes(32).toString("hex"), email = "keyboard-user@example.invalid";
    const setup = await call(admin, "POST", "/api/auth/create-admin", { email: "keyboard-admin@example.invalid", password }, 201);
    await admin.addCookies([{ name: "token", value: setup.token, url: origin }]);
    await call(admin, "POST", "/api/users/admin", { email, password, verified: true }, 201);
    const login = await call(user, "POST", "/api/auth/login", { email, password });
    await user.addCookies([{ name: "token", value: login.token, url: origin }]);
    const link = await call(user, "POST", "/api/links", { target: "https://example.org/keyboard", customurl: "keyboard-primary" }, 201);
    for (let i = 0; i < 11; i++) await call(user, "POST", "/api/links", { target: "https://example.org/" + i, customurl: "keyboard-page-" + i }, 201);
    page = await user.newPage(); page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
    const goto = async url => { await page.goto(origin + url); await page.waitForLoadState("networkidle"); };
    const focus = async selector => page.waitForFunction(selector => document.activeElement?.matches(selector), selector);
    const enter = async locator => { await locator.focus(); await page.keyboard.press("Enter"); };
    const named = async () => {
      const unnamed = await page.locator("button, select, input:not([type=hidden]), textarea").evaluateAll(nodes => nodes.filter(node => {
        if (!node.getClientRects().length || node.disabled) return false;
        return !(node.getAttribute("aria-label") || node.getAttribute("aria-labelledby") ||
          (node.labels && [...node.labels].some(label => label.textContent.trim())) ||
          (node.tagName === "BUTTON" && node.textContent.trim()));
      }).map(node => node.outerHTML));
      assert.deepEqual(unnamed, [], "Every visible enabled control has an accessible name");
    };
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await goto("/"); await named();
      await page.getByRole("textbox", { name: "Destination URL", exact: true }).fill("https://example.org/created-" + width);
      await page.keyboard.press("Tab"); await focus("#shortener-submit");
      const outline = await page.locator("#shortener-submit").evaluate(node => {
        const style = getComputedStyle(node), rect = node.getBoundingClientRect();
        return { visible: node.matches(":focus-visible"), width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor,
          offset: style.outlineOffset, height: rect.height, widthPx: rect.width };
      });
      assert(outline.visible); assert.equal(outline.width, "3px"); assert.equal(outline.style, "solid");
      assert.equal(outline.color, "rgb(36, 91, 128)"); assert.equal(outline.offset, "3px"); assert(outline.height >= 32 && outline.widthPx >= 32);
      await page.screenshot({ path: path.join(evidence, "focus-submit-" + width + ".png") });
      const created = page.waitForResponse(r => r.url().endsWith("/api/links") && r.request().method() === "POST");
      await page.keyboard.press("Enter"); assert.equal((await created).status(), 200);
      await page.waitForFunction(() => !!document.querySelector("#shorturl h1.link button"));
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(100); assert.notEqual(await page.evaluate(() => document.activeElement.tagName), "BODY");
      await named();
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(await page.locator("#shortener-submit").evaluate(node => getComputedStyle(node).transitionDuration), "0s");
      await page.emulateMedia({ reducedMotion: "no-preference" });

      await goto("/");
      await enter(page.getByRole("button", { name: "Next page", exact: true }).first());
      await focus(".pagination .prev");
      await enter(page.getByRole("button", { name: "Previous page", exact: true }).first());
      await focus(".pagination .next");
      await enter(page.getByRole("button", { name: "Show 20 per page", exact: true }).first());
      await page.waitForFunction(() => document.querySelector("#limit").value === "20" && !document.querySelector(".htmx-request"));
      assert.equal(await page.getByRole("button", { name: "Show 20 per page", exact: true }).first().getAttribute("aria-pressed"), "true");
      assert(await page.getByRole("button", { name: "Show 20 per page", exact: true }).first().evaluate(node => document.activeElement === node));
      await page.getByLabel("Search links", { exact: true }).fill(link.address);
      await page.locator("#tr-" + link.id).waitFor();
      await page.waitForLoadState("networkidle");
      await enter(page.locator("#edit-opener-" + link.id));
      await page.waitForLoadState("networkidle");
      const form = page.locator("#edit-form-" + link.id);
      await form.locator('[name="description"]').fill("Keyboard save " + width);
      assert.equal(await form.getAttribute("method"), "post", "Native fallback must not put fields in the URL");
      assert(await page.evaluate(id => window.formTrace.some(event => event.type === "htmx:afterProcessNode" && event.id === id), "edit-form-" + link.id),
        "Inserted editor is initialized before it can receive keyboard input");
      const save = page.waitForResponse(r => r.request().method() === "PATCH");
      await enter(form.getByRole("button", { name: "Update", exact: true })); await save;
      await focus("#edit-submit-" + link.id); await named();
      await enter(form.getByRole("button", { name: "Close", exact: true }));
      await focus("#edit-opener-" + link.id);

      await goto("/settings/library?q=" + link.address);
      await page.getByLabel("Select " + link.address, { exact: true }).check();
      await page.getByLabel("Action", { exact: true }).selectOption("pause");
      await enter(page.locator("#library-apply")); await page.waitForLoadState("networkidle");
      await focus("[data-page-focus]");
      assert.equal((await call(user, "GET", "/api/links?limit=50")).data.find(item => item.id === link.id).paused, true);
      await page.getByLabel("Select " + link.address, { exact: true }).check();
      await page.getByLabel("Action", { exact: true }).selectOption("trash");
      page.once("dialog", dialog => dialog.dismiss());
      await enter(page.locator("#library-apply")); await focus("#library-apply");
      assert.equal((await call(user, "GET", "/api/links?limit=50")).data.some(item => item.id === link.id), true);
      page.once("dialog", dialog => dialog.accept());
      await enter(page.locator("#library-apply")); await page.waitForLoadState("networkidle"); await focus("[data-page-focus]");
      await goto("/settings/trash"); page.once("dialog", dialog => dialog.accept());
      await enter(page.locator("#trash-" + link.id).getByRole("button", { name: "Restore", exact: true }));
      await focus("#trash-" + link.id + " [role=status]");
      assert.equal((await user.request.get(origin + "/" + link.address, { maxRedirects: 0 })).status(), 410);

      await goto("/link/forwarding/" + link.id);
      await page.getByText("Saved allowlists loaded.", { exact: true }).waitFor();
      await page.getByLabel("Allowed query keys").fill("campaign");
      await enter(page.locator("#forwarding-save"));
      await page.getByText("Allowlists saved.", { exact: true }).waitFor(); await focus("#forwarding-save");
      await enter(page.locator("#forwarding-test"));
      await page.waitForFunction(() => document.querySelector("#forwarding-result").textContent.startsWith("Default destination"));
      await focus("#forwarding-test");

      await goto("/link/routing/" + link.id); await page.getByText("No routing rules", { exact: true }).waitFor();
      await enter(page.locator("#routing-save")); await page.getByText("Rules saved", { exact: true }).waitFor(); await focus("#routing-save");
      let release, arrived;
      const held = new Promise(resolve => { release = resolve; }), received = new Promise(resolve => { arrived = resolve; });
      await page.route("**/api/links/" + link.id + "/routing", async route => {
        if (route.request().method() !== "PUT") return route.continue();
        const response = await route.fetch(); arrived(); await held; await route.fulfill({ response });
      });
      await enter(page.locator("#routing-save")); await received;
      await enter(page.locator("#routing-add"));
      const name = page.locator('[data-field="name"]').first(); await name.fill("Newer unsaved draft");
      release(); await page.getByText("New unsaved changes", { exact: true }).waitFor();
      assert(await name.evaluate(node => document.activeElement === node), "Completion must not steal focus from a newer draft");
      await page.unroute("**/api/links/" + link.id + "/routing");
      page.once("dialog", dialog => dialog.accept()); await goto("/link/health/" + link.id);
      await page.getByText("Saved monitoring loaded.", { exact: true }).waitFor();
      await enter(page.locator("#health-save")); await page.getByText("Monitoring saved.", { exact: true }).waitFor(); await focus("#health-save");

      await goto("/settings/analytics"); await page.getByText("No tracked visits in this range", { exact: true }).waitFor();
      const nav = page.getByRole("navigation", { name: "Date pages", exact: true });
      await enter(nav.getByRole("button", { name: "Next", exact: true })); await focus("#analytics-days-previous");
      await enter(nav.getByRole("button", { name: "Previous", exact: true })); await focus("#analytics-days-next");
      await enter(page.getByRole("button", { name: "Apply", exact: true })); await page.waitForLoadState("networkidle");
      await focus('#analytics-filters button[type="submit"]');

      await goto("/settings/workspaces");
      const create = page.getByRole("form", { name: "Create workspace", exact: true });
      await create.getByLabel("Workspace name").fill("Keyboard " + width);
      await enter(create.getByRole("button", { name: "Create workspace", exact: true }));
      await page.waitForLoadState("networkidle"); await focus("[data-page-focus]"); await named();
    }

    await page.close(); page = await admin.newPage(); page.setDefaultTimeout(12000);
    page.on("pageerror", error => errors.push(error.message));
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 }); await goto("/admin"); await named();
      assert.equal(await page.getByRole("button", { name: "Next page" }).first().isDisabled(), false);
      await page.getByRole("tab", { name: "Links", exact: true }).focus();
      await page.keyboard.press("ArrowRight"); await focus("#tab-users");
      await page.keyboard.press("Enter"); await page.getByRole("tab", { name: "Users", selected: true }).waitFor(); await focus("#tab-users");
      assert.equal(await page.getByRole("button", { name: "Next page" }).first().isDisabled(), true); await named();
      await page.keyboard.press("End"); await focus("#tab-domains"); await page.keyboard.press("Enter");
      await page.getByRole("tab", { name: "Domains", selected: true }).waitFor(); await focus("#tab-domains");
      assert.equal(await page.getByRole("button", { name: "Next page" }).first().isDisabled(), true); await named();
      await page.keyboard.press("Home"); await page.keyboard.press("Enter");
      await page.getByRole("tab", { name: "Links", selected: true }).waitFor(); await focus("#tab-links");
      await page.getByLabel("Search links", { exact: true }).fill(link.address);
      const row = page.locator("#tr-" + link.id); await row.waitFor();
      await enter(row.getByRole("button", { name: "View user", exact: true }));
      await page.getByRole("tab", { name: "Users", selected: true }).waitFor(); await focus("#tab-users");
      await named();
      await page.waitForFunction(() => {
        const row = document.querySelector("#admin-table-results tr[id]");
        return row && getComputedStyle(row).opacity === "1" && getComputedStyle(row.parentElement).opacity === "1" && !document.querySelector(".htmx-request");
      });
      assert.equal(await page.locator("#tab-users").evaluate(node => getComputedStyle(node).outlineColor), "rgb(36, 91, 128)");
      await page.screenshot({ path: path.join(evidence, "admin-keyboard-" + width + ".png"), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log("PASS: named controls, native keyboard/HTMX focus, visible focus/reduced motion, safe async focus, bulk/restore/workspace navigation, analytics pages, admin tabs and pagination at 1440/390/320px; " + evidence);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    console.error({ errors, path: page && new URL(page.url()).pathname,
      trace: page && await page.evaluate(() => window.formTrace).catch(() => []) }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
