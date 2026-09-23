const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Fresh loopback-only instance required");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-forwarding-ui-"));
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
    const setup = await context.request.post(origin + "/api/auth/create-admin", { data: { email: "forwarding-browser@example.invalid", password: randomBytes(32).toString("hex") }, headers });
    assert.equal(setup.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await setup.json()).token, url: origin }]);
    page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    const action = async (name, method, status = 200) => {
      const pending = page.waitForResponse(response => response.url().includes("/forwarding") && response.request().method() === method);
      await page.getByRole("button", { name, exact: true }).click(); const response = await pending;
      assert.equal(response.status(), status, await response.text());
      await page.waitForTimeout(100);
    };
    for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
      await page.setViewportSize(viewport);
      // Exercise the existing creation UI with a nested alias, not only the API.
      await page.goto(origin + "/");
      const form = page.locator("#shortener-form");
      await form.locator('[name="target"]').fill("https://192.0.2.1/base?fixed=owner");
      const custom = form.locator('[name="customurl"]');
      if (!await custom.isVisible()) {
        await form.getByRole("checkbox", { name: "Show advanced options" }).check();
      }
      await custom.fill("ui/" + label + "/guide");
      const creation = page.waitForResponse(response => /\/api\/(v2\/)?links$/.test(response.url()) && response.request().method() === "POST");
      await form.locator('button.submit').click();
      assert([200, 201].includes((await creation).status()));
      const listing = await context.request.get(origin + "/api/links?search=" + encodeURIComponent("ui/" + label + "/guide"), { headers });
      const body = await listing.json(); const link = body.data.find(row => row.address === "ui/" + label + "/guide"); assert(link);
      const url = origin + "/link/forwarding/" + link.id, endpoint = origin + "/api/v2/links/" + link.id + "/forwarding";
      await page.goto(origin + "/settings/library");
      await page.locator(".library-links>li").filter({ hasText: link.address }).getByRole("link", { name: "Path and query forwarding", exact: true }).click();
      assert.equal(page.url(), url); await page.getByText("Saved allowlists loaded.", { exact: true }).waitFor();
      await page.getByLabel("Allowed query keys", { exact: true }).fill("utm_source\nfixed");
      await page.getByLabel("Allowed path prefixes", { exact: true }).fill("docs\nproducts/manuals");
      await page.getByLabel("Path suffix", { exact: true }).fill("docs/start");
      await page.getByLabel("Query string", { exact: true }).fill("utm_source=book&fixed=attacker&unknown=no");
      await action("Preview", "POST");
      assert.equal(await page.locator("#forwarding-result").textContent(), "Default destination: https://192.0.2.1/base/docs/start?fixed=owner&utm_source=book");
      await action("Save allowlists", "PUT");
      await page.reload(); await page.getByText("Saved allowlists loaded.", { exact: true }).waitFor();
      await page.waitForFunction(() => !document.querySelector("#forwarding-save").disabled);
      assert.equal(await page.getByLabel("Allowed path prefixes", { exact: true }).inputValue(), "docs\nproducts/manuals");
      assert(await page.evaluate(() => {
        const heading = document.querySelector(".archive-heading"), following = heading.nextElementSibling.getBoundingClientRect();
        return [...heading.children].every(child => child.getBoundingClientRect().bottom <= following.top);
      }), label + " heading overlaps the short URL");
      await page.screenshot({ path: path.join(evidence, label + "-allowlists.png"), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      const current = await (await context.request.get(endpoint, { headers })).json();
      assert.equal((await context.request.put(endpoint, { headers, data: { query_keys: current.query_keys, path_prefixes: current.path_prefixes, revision: current.revision } })).status(), 200);
      await page.getByLabel("Allowed query keys", { exact: true }).fill("stale");
      await action("Save allowlists", "PUT", 409);
      assert.match(await page.locator("#forwarding-status").textContent(), /Changed elsewhere/);
      assert.equal(await page.getByLabel("Allowed query keys", { exact: true }).inputValue(), "stale", "Conflict preserves draft");
      await action("Reload saved allowlists", "GET");
      assert.equal(await page.getByLabel("Allowed query keys", { exact: true }).inputValue(), "utm_source\nfixed");
      await page.route(endpoint, route => route.request().method() === "GET" ? route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Temporary outage"}' }) : route.continue());
      await action("Reload saved allowlists", "GET", 503); assert.match(await page.locator("#forwarding-status").textContent(), /Temporary outage/);
      await page.unroute(endpoint); await action("Reload saved allowlists", "GET");
      assert.equal((await context.request.patch(origin + "/api/links/" + link.id, { headers, data: { password: "browser-forwarding-password" } })).status(), 200);
      const destination = "https://192.0.2.1/base/docs/start?fixed=owner&utm_source=book";
      await page.route(destination, route => route.fulfill({ status: 200, contentType: "text/plain", body: "Forwarded destination" }));
      await page.goto(origin + "/" + link.address + "/docs/start?utm_source=book");
      assert.equal(await page.locator('input[name="suffix_path"]').inputValue(), "docs/start");
      await page.getByLabel("Password:", { exact: true }).fill("wrong-password");
      await page.getByRole("button", { name: "Unlock & Go", exact: true }).click();
      await page.getByText("Password is not correct.", { exact: true }).waitFor();
      assert.equal(await page.locator('input[name="suffix_path"]').inputValue(), "docs/start");
      await page.getByLabel("Password:", { exact: true }).fill("browser-forwarding-password");
      await page.getByRole("button", { name: "Unlock & Go", exact: true }).click();
      await page.waitForURL(destination); assert.equal(await page.textContent("body"), "Forwarded destination");
      await page.goto(url); await page.getByText("Saved allowlists loaded.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Clear allowlists", exact: true }).click();
      await action("Save allowlists", "PUT");
      await page.getByLabel("Path suffix", { exact: true }).fill("docs/start"); await action("Preview", "POST", 404);
      assert.match(await page.locator("#forwarding-result").textContent(), /not enabled/);
      await page.getByLabel("Path suffix", { exact: true }).fill(""); await action("Preview", "POST");
      await page.screenshot({ path: path.join(evidence, label + "-cleared.png"), fullPage: true });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    assert.deepEqual(errors, []); console.log("PASS: desktop/mobile nested alias creation, navigation, draft preview, save/reload, conflict and outage recovery, password retry forwarding and clear; " + evidence);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    console.error({ errors, evidence }); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
