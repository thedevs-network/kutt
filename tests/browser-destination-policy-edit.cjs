const assert = require("node:assert/strict");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, "127.0.0.1"); assert(evidence); mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const contexts = {}, errors = [], external = [];
    const call = async (context, method, endpoint, data, status = 200) => {
      // Chromium accepts Secure cookies on loopback; Playwright's API client
      // does not. Reuse this disposable UI login explicitly for API assertions.
      const token = (await context.cookies()).find(cookie => cookie.name === "token"); assert(token);
      const response = await context.request.fetch(origin + endpoint, { method, data,
        headers: { Accept: "application/json", Cookie: "token=" + token.value }, maxRedirects: 0 });
      assert.equal(response.status(), status, await response.text());
      return status === 204 ? undefined : response.json();
    };
    for (const name of ["owner", "admin"]) {
      const context = await browser.newContext({ locale: "en" }); contexts[name] = context;
      page = await context.newPage(); page.setDefaultTimeout(15000);
      page.on("pageerror", error => errors.push(error.message));
      page.on("console", message => {
        if (message.type() === "error" && !/Failed to load resource.*(?:400|404|409)/.test(message.text())) errors.push(message.text());
      });
      page.on("request", request => { if (!request.url().startsWith(origin + "/") && !request.url().startsWith("data:")) external.push(request.url()); });
      await page.goto(origin + "/login");
      await page.locator('[name="email"]').fill("policy-" + name + "@example.invalid");
      await page.locator('[name="password"]').fill("Disposable-policy-edit-42!");
      await page.getByRole("button", { name: "Log in", exact: true }).click();
      await page.waitForURL(origin + "/");
      contexts[name + "Page"] = page;
    }
    const links = (await call(contexts.owner, "GET", "/api/links?limit=100")).data;
    const state = async link => (await call(contexts.owner, "GET", "/api/links?limit=100")).data.find(item => item.id === link.id);
    for (const width of [1440, 390, 320]) {
      for (const kind of ["personal", "admin", "shared"]) {
        page = contexts[kind === "admin" ? "adminPage" : "ownerPage"];
        await page.setViewportSize({ width, height: 900 });
        const link = links.find(item => item.address === "policy-" + kind + "-" + width); assert(link);
        let form, pageURL, submit;
        if (kind === "shared") {
          const workspace = await call(contexts.owner, "POST", "/api/workspaces", { name: "Policy native " + width }, 201);
          await call(contexts.owner, "POST", "/api/workspaces/" + workspace.id + "/shares", { link_id: link.id }, 204);
          pageURL = origin + "/settings/workspaces/" + workspace.id;
          await page.goto(pageURL);
          await page.locator("#workspace-edit-" + link.id + " > summary").click();
          form = page.locator("#workspace-edit-" + link.id + " form");
          submit = async status => {
            const response = page.waitForResponse(r => r.url().startsWith(pageURL) && r.request().method() === "POST");
            await form.locator('button[type="submit"]').click();
            const received = await response; assert.equal(received.status(), status);
            assert.equal(received.request().headers().origin, origin, "Native form must retain same-origin Origin");
            await page.waitForLoadState("networkidle");
          };
        } else {
          pageURL = origin + (kind === "admin" ? "/admin" : "/");
          await page.goto(pageURL);
          await page.locator("#tr-" + link.id + " button.edit").click();
          form = page.locator("#edit-form-" + link.id); await form.waitFor();
          submit = async () => {
            const response = page.waitForResponse(r => r.url().includes("/links/") && r.request().method() === "PATCH");
            await form.locator('button[type="submit"]').click(); assert.equal((await response).status(), 200);
          };
        }
        await form.locator('[name="description"]').fill("Metadata accepted " + kind + width);
        await submit(kind === "shared" ? 303 : 200);
        if (kind !== "shared") await form.getByText("Link has been updated.", { exact: true }).waitFor();
        assert.equal((await state(link)).description, "Metadata accepted " + kind + width);
        assert.equal((await state(link)).target, "https://198.51.100.2/original");
        if (kind === "shared") await page.locator("#workspace-edit-" + link.id + " > summary").click();
        await form.locator('[name="target"]').fill("https://203.0.113.2/must-not-save");
        await form.locator('[name="description"]').fill("Retained rejected draft");
        await submit(kind === "shared" ? 400 : 200);
        await page.getByText("This destination is not permitted by the server's destination policy.", { exact: true }).waitFor();
        assert.equal((await state(link)).target, "https://198.51.100.2/original");
        assert.equal(await form.locator('[name="description"]').inputValue(), "Retained rejected draft");
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await page.screenshot({ path: path.join(evidence, kind + "-" + width + "-denied-change.png"), fullPage: true });
        await (kind === "shared" ? page.locator("#workspace-edit-" + link.id) : form).screenshot({
          path: path.join(evidence, kind + "-" + width + "-editor.png") });
        await form.locator('[name="target"]').fill("https://192.0.2.1/repaired");
        await submit(kind === "shared" ? 303 : 200);
        if (kind !== "shared") await form.getByText("Link has been updated.", { exact: true }).waitFor();
        assert.equal((await state(link)).target, "https://192.0.2.1/repaired");
        const redirect = await contexts.owner.request.get(origin + "/" + link.address, { maxRedirects: 0 });
        assert.equal(redirect.status(), 302); assert.equal(redirect.headers().location, "https://192.0.2.1/repaired");
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    console.log("PASS: nine real personal/admin/native workspace form flows at 1440/390/320px under enforced CSP; unchanged denied target metadata, denied changes/drafts, allowed repair, Origin, no overflow/errors/external traffic");
  } catch (error) {
    if (page && !page.isClosed()) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
