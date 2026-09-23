const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Use a fresh loopback fixture");
  const evidence = process.env.KUTT_EVIDENCE_DIR; assert(evidence);
  const account = { email: "origin-browser@example.invalid", password: randomBytes(32).toString("hex") };
  const escape = value => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);
  const attacker = createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(`<title>Cross-site form fixture</title><form method="post" action="${escape(origin)}/api/auth/login"><input name="email" value="${account.email}"><input name="password" type="password" value="${account.password}"><button>Submit foreign login</button></form>`);
  });
  await new Promise(resolve => attacker.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    assert.equal(new URL(origin).protocol, "https:", "Secure cookies require HTTPS acceptance");
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Disposable fixture must be ready");
    assert.equal((await context.request.post(origin + "/api/auth/create-admin", { data: account, headers: { Accept: "application/json" } })).status(), 201, "Refuse initialized fixtures");
    const page = await context.newPage(), errors = [];
    page.on("pageerror", e => errors.push(e.message));
    for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
      await context.clearCookies(); await page.setViewportSize({ width, height });
      // localhost and 127.0.0.1 are distinct browser sites, both loopback-only.
      await page.goto("http://localhost:" + attacker.address().port);
      const submitted = page.waitForResponse(r => r.url() === origin + "/api/auth/login" && r.request().method() === "POST");
      await page.getByRole("button", { name: "Submit foreign login" }).click();
      const blocked = await submitted;
      assert.equal(blocked.status(), 403); assert.equal((await blocked.allHeaders())["set-cookie"], undefined);
      assert(!(await context.cookies(origin)).some(cookie => cookie.name === "token"));
      await page.goto(origin + "/login");
      await page.getByLabel("Email address:", { exact: true }).fill(account.email);
      await page.getByLabel("Password:", { exact: true }).fill(account.password);
      const loginResponse = page.waitForResponse(r => r.url() === origin + "/api/auth/login" && r.request().method() === "POST");
      await page.getByRole("button", { name: "Log in", exact: true }).click();
      const successful = await loginResponse;
      assert.equal(successful.status(), 204);
      assert.equal(successful.headers()["hx-redirect"], "/");
      await successful.finished();
      assert((await successful.allHeaders())["set-cookie"], "Same-origin login must issue a cookie; Accept=" + successful.request().headers().accept + "; content-type=" + successful.headers()["content-type"]);
      await page.waitForURL(origin + "/");
      assert((await context.cookies(origin)).some(cookie => cookie.name === "token"));
      await page.goto(origin + "/settings/security");
      await page.getByRole("heading", { name: "Account security", exact: true }).waitFor();
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(evidence, "login-origin-" + name + ".png"), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/mobile real cross-site form cannot set login cookie; same-origin HTMX login and private settings work");
  } finally {
    await browser.close(); await new Promise(resolve => attacker.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
