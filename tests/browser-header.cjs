const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const fixtures = JSON.parse(process.env.KUTT_HEADER_FIXTURES), evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(fixtures.length === 3 && evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true }), measurements = [];
  try {
    for (const { origin, name } of fixtures) {
      assert.equal(new URL(origin).hostname, "127.0.0.1");
      const context = await browser.newContext(), headers = { Accept: "application/json" };
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
        if (ready) break; await new Promise(resolve => setTimeout(resolve, 100));
      }
      assert(ready);
      const password = randomBytes(32).toString("hex");
      const bootstrap = await context.request.post(origin + "/api/auth/create-admin", { headers, data: { email: "header-admin@example.invalid", password } });
      assert.equal(bootstrap.status(), 201, "Refuse initialized fixtures"); const admin = (await bootstrap.json()).token;
      const user = { email: "header-user@example.invalid", password, verified: true };
      assert.equal((await context.request.post(origin + "/api/users/admin", { headers: { ...headers, Cookie: "token=" + admin }, data: user })).status(), 201);
      const login = await context.request.post(origin + "/api/auth/login", { headers, data: user }); assert.equal(login.status(), 200);
      const ordinary = (await login.json()).token, page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => { if (message.type() === "error" && !message.text().includes("401 (Unauthorized)")) errors.push(message.text()); });
      for (const [role, token] of [["anonymous", null], ["user", ordinary], ["admin", admin]]) {
        for (const width of [320, 390, 768, 1440]) {
          await context.clearCookies(); if (token) await context.addCookies([{ name: "token", value: token, url: origin }]);
          await page.setViewportSize({ width, height: 900 });
          await page.goto(origin + (token ? "/settings/security" : "/login")); await page.waitForLoadState("networkidle");
          assert((await page.title()).startsWith(name + " | "));
          const header = page.locator(".site-header"), nav = header.getByRole("navigation", { name: "Account" });
          assert.equal(await header.locator(".site-name").textContent(), name);
          assert.equal(await nav.getByRole("link", { name: "Admin", exact: true }).count(), role === "admin" ? 1 : 0);
          assert.equal(await nav.getByRole("link", { name: "Settings", exact: true }).count(), token ? 1 : 0);
          assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          if (token) {
            const heading = page.locator(".account-security > header"), identity = page.getByRole("heading", { name: "Connected identity", exact: true });
            const headingBox = await heading.boundingBox(), identityBox = await identity.boundingBox();
            assert(identityBox.y >= headingBox.y + headingBox.height + 8, "Account identity stays below the complete page heading");
            const titleBox = await heading.getByRole("heading", { name: "Account security", exact: true }).boundingBox();
            assert(titleBox.y + titleBox.height <= headingBox.y + headingBox.height + 1);
            assert(await heading.getByRole("link", { name: "Settings", exact: true }).evaluate(element => {
              const range = document.createRange(); range.selectNodeContents(element); return range.getClientRects().length === 1;
            }), "Page Settings label does not split mid-word");
          }
          const geometry = await header.evaluate(element => {
            const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
            const logo = element.querySelector(".logo"), nav = element.querySelector("nav"), links = [...nav.querySelectorAll("a")];
            return { header: rect(element), logo: rect(logo), nav: rect(nav), links: links.map(rect),
              unbroken: links.every(link => { const range = document.createRange(); [...link.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(node => range.selectNodeContents(node)); return range.getClientRects().length <= 1; }) };
          });
          const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
          assert(!overlaps(geometry.logo, geometry.nav)); assert(geometry.unbroken, "Account labels stay on one line");
          for (const [i, rect] of geometry.links.entries()) {
            assert(rect.x >= geometry.header.x && rect.right <= geometry.header.right + 1 && rect.bottom <= geometry.header.bottom + 1);
            assert(geometry.links.slice(i + 1).every(other => !overlaps(rect, other)));
          }
          for (const link of await nav.getByRole("link").all()) {
            await link.focus(); assert(await link.evaluate(element => element === document.activeElement && getComputedStyle(element).outlineStyle !== "none"));
          }
          measurements.push({ name, role, width, ...geometry });
          await page.screenshot({ path: path.join(evidence, new URL(origin).port + "-" + role + "-" + width + ".png"), animations: "disabled", fullPage: true });
          if (token) {
            await nav.getByRole("link", { name: "Settings", exact: true }).focus(); await page.keyboard.press("Enter"); await page.waitForURL(origin + "/settings");
            await page.locator(".site-header").getByRole("link", { name: "Log out", exact: true }).click(); await page.waitForLoadState("networkidle");
          }
          assert.equal((await context.request.get(origin + "/api/links", { headers })).status(), 401);
        }
      }
      assert.deepEqual(errors, []); await context.close();
    }
    writeFileSync(path.join(evidence, "header-layout.json"), JSON.stringify(measurements, null, 2));
    console.log("PASS: 36 header layouts across signed-out/user/admin, three configured brands and 320/390/768/1440px; distinct non-overlapping controls, unbroken account labels, keyboard settings/logout, private management and no console/overflow errors");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
