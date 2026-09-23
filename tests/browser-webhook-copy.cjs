const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert(origin && new URL(origin).hostname === "127.0.0.1" && evidence, "Use a fresh loopback fixture and evidence directory");
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true }), results = [];
  try {
    const context = await browser.newContext();
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await context.request.get(origin + "/api/health")).status() === 200; } catch {}
      if (ready) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready, "Fixture health must pass before creating test data");
    const bootstrap = await context.request.post(origin + "/api/auth/create-admin", {
      headers: { Accept: "application/json" },
      data: { email: "webhook-copy@example.invalid", password: randomBytes(32).toString("hex") }
    });
    assert.equal(bootstrap.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    const page = await context.newPage(), errors = [];
    const version = require("../package.json").version;
    // Simulate stale unversioned assets without changing deployment cache policy.
    await page.route("**/scripts/webhooks.js", route => route.fulfill({
      contentType: "application/javascript", body: "window.staleWebhookScript = true;"
    }));
    await page.route("**/css/webhooks.css", route => route.fulfill({
      contentType: "text/css", body: ".integrations-page { display: none; }"
    }));
    page.on("pageerror", error => errors.push(error.message));
    page.on("dialog", dialog => dialog.accept());
    const copy = page.locator("#hook-secret-copy"), notice = page.locator("#hook-secret-status");
    const dismiss = page.getByRole("button", { name: "Dismiss", exact: true });
    const setClipboard = async mode => page.evaluate(mode => {
      window.copyCalls = 0; window.copiedValue = null;
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: mode === "missing" ? undefined : {
        writeText(value) {
          window.copyCalls++; window.copiedValue = value;
          if (mode === "reject") return Promise.reject(new Error("Do not echo synthetic secret: " + value));
          if (mode === "pending") return new Promise(resolve => { window.finishCopy = resolve; });
          return Promise.resolve();
        }
      } });
    }, mode);
    const expectNotice = async text => {
      await page.waitForFunction(expected => document.querySelector("#hook-secret-status")?.textContent === expected, text);
      assert.equal(await notice.getAttribute("role"), "status");
      assert.equal(await notice.getAttribute("aria-live"), "polite");
    };
    const rotate = async () => {
      const response = page.waitForResponse(row => row.url().endsWith("/rotate") && row.request().method() === "POST");
      await page.locator(".hook-row").getByRole("button", { name: "Rotate secret", exact: true }).click();
      assert.equal((await response).status(), 200);
      await page.locator("#integration-status").getByText("Signing secret rotated.", { exact: true }).waitFor();
      await page.waitForFunction(() => !document.querySelector("#hook-secret").hidden &&
        !document.querySelector("#hook-secret-copy").disabled && document.querySelector("#hook-secret-status").textContent === "");
    };
    for (const [mode, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844], ["compact", 320, 720]]) {
      await page.setViewportSize({ width, height }); await page.goto(origin + "/settings/integrations");
      const assets = await page.evaluate(() => ({
        script: [...document.scripts].find(s => new URL(s.src, location.href).pathname === "/scripts/webhooks.js")?.src,
        style: [...document.querySelectorAll('link[rel="stylesheet"]')].find(s => new URL(s.href).pathname === "/css/webhooks.css")?.href
      }));
      assert.equal(new URL(assets.script).searchParams.get("v"), version, "Script must bypass a stale prior-release asset");
      assert.equal(new URL(assets.style).searchParams.get("v"), version, "Styles must match the current release");
      await page.locator("#integration-status").getByText("Integrations loaded.", { exact: true }).waitFor();
      await page.getByRole("button", { name: "New webhook", exact: true }).click();
      await page.getByLabel("Name", { exact: true }).fill("Copy fixture " + mode);
      await page.getByLabel("Receiver URL", { exact: true }).fill("https://hooks.example.com/receiver");
      await page.getByRole("button", { name: "Save webhook", exact: true }).click();
      await page.locator("#integration-status").getByText("Webhook saved.", { exact: true }).waitFor();
      assert.equal(await notice.count(), 1, "Copy feedback must exist beside the signing secret, not only at page top");
      await copy.scrollIntoViewIfNeeded(); await copy.focus();
      const before = await copy.boundingBox();
      await setClipboard("success"); await copy.press("Enter");
      await expectNotice("Signing secret copied.");
      assert.equal((await copy.textContent()).trim(), "Copied");
      assert(await page.evaluate(() => window.copiedValue === document.querySelector("#hook-secret-value").textContent));
      assert.equal(await page.locator("#integration-status").textContent(), "Webhook saved.");
      const after = await copy.boundingBox(), feedback = await notice.boundingBox();
      assert.equal(before.width, after.width, "Copy state must not resize the button");
      assert(feedback.y >= 0 && feedback.y + feedback.height <= height, "Confirmation visible in the same viewport as Copy");
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
      await page.screenshot({ path: path.join(evidence, `webhook-copy-${mode}.png`), mask: [page.locator("#hook-secret-value")] });

      for (const failure of ["reject", "missing"]) {
        await setClipboard(failure); await copy.click();
        await expectNotice("Copy failed. Select the signing secret above to copy it manually.");
        assert.equal((await copy.textContent()).trim(), "Copy");
        assert(await copy.isEnabled());
        assert(!(await notice.textContent()).includes("whsec_"), "Clipboard error must not leak the secret");
      }
      await setClipboard("pending"); await copy.click();
      await expectNotice("Copying..."); assert(await copy.isDisabled()); assert(await dismiss.isEnabled());
      await copy.evaluate(el => el.click()); assert.equal(await page.evaluate(() => window.copyCalls), 1);
      await expectNotice("Copy failed. Select the signing secret above to copy it manually.");
      assert(await copy.isEnabled());
      await page.evaluate(() => window.finishCopy());
      assert.equal((await copy.textContent()).trim(), "Copy", "Late clipboard completion cannot claim success after timeout");

      await setClipboard("pending"); await copy.click(); await expectNotice("Copying...");
      await dismiss.click(); await page.evaluate(() => window.finishCopy());
      assert(await page.locator("#hook-secret").isHidden());
      assert.equal(await notice.textContent(), ""); assert.equal(await page.locator("#hook-secret-value").textContent(), "");
      await rotate(); assert.equal(await notice.textContent(), ""); assert.equal((await copy.textContent()).trim(), "Copy");
      await setClipboard("pending"); await copy.click(); await expectNotice("Copying...");
      await rotate(); await page.evaluate(() => window.finishCopy());
      assert.equal(await notice.textContent(), "", "An old copy cannot announce success for a rotated secret");
      assert.equal((await copy.textContent()).trim(), "Copy");
      await setClipboard("success"); await copy.click(); await expectNotice("Signing secret copied.");
      await dismiss.click();
      const hooks = (await (await context.request.get(origin + "/api/v2/webhooks")).json()).data;
      assert.equal(hooks.length, 1); assert.equal(hooks[0].enabled, false);
      assert.equal((await (await context.request.get(origin + `/api/v2/webhooks/${hooks[0].id}/deliveries`)).json()).data.length, 0);
      assert.equal((await context.request.delete(origin + "/api/v2/webhooks/" + hooks[0].id, { data: { revision: hooks[0].revision } })).status(), 204);
      results.push({ viewport: mode, width, height, status: "PASS" });
    }
    assert.deepEqual(errors, []);
    writeFileSync(path.join(evidence, "webhook-copy-results.json"), JSON.stringify(results, null, 2) + "\n");
    console.log("PASS: webhook copy local feedback, versioned assets with stale-path interception, keyboard success, stable desktop/mobile/compact layout, failure/missing/timeout recovery, duplicate prevention, dismissal/rotation races and disabled fixture cleanup");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
