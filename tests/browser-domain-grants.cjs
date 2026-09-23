const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { mkdirSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR, container = process.env.KUTT_BROWSER_CONTAINER;
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1"); assert(evidence);
  assert(/^[a-f0-9]{64}$/.test(container));
  assert.equal(new URL(origin).hostname, "localhost"); assert.equal(new URL(origin).protocol, "http:");
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: [
    `--host-resolver-rules=MAP browser-grants.example.invalid 127.0.0.1:${new URL(origin).port}, MAP www.browser-grants.example.invalid 127.0.0.1:${new URL(origin).port}`
  ] });
  let activePage;
  try {
    const fixture = await browser.newContext(), password = randomBytes(32).toString("hex");
    const json = { Accept: "application/json" };
    const bootstrap = await fixture.request.post(origin + "/api/auth/create-admin", { headers: json, data: { email: "browser-admin@example.invalid", password } });
    assert.equal(bootstrap.status(), 201, "Refuse initialized fixture");
    await fixture.addCookies([{ name: "token", value: (await bootstrap.json()).token, url: origin }]);
    const accounts = {};
    for (const role of ["owner", "recipient"]) {
      const email = role + ".long-localized-account@example.invalid";
      const created = await fixture.request.post(origin + "/api/users/admin", { headers: json, data: { email, password, role: "USER", verified: true } });
      assert.equal(created.status(), 201);
      const login = await fixture.request.post(origin + "/api/auth/login", { headers: json, data: { email, password } });
      assert.equal(login.status(), 200); accounts[role] = { email, token: (await login.json()).token };
    }
    const shortOrigin = origin.replace("localhost", "127.0.0.1"), target = "https://192.0.2.1/public-grants-fixture";
    const claim = { address: "browser-grants.example.invalid" }, headers = { ...json, Cookie: "token=" + accounts.owner.token };
    const challenge = await fixture.request.post(origin + "/api/domains", { headers, data: claim });
    assert.equal(challenge.status(), 409);
    const proof = (await challenge.json()).verification;
    const claimed = await fixture.request.post(origin + "/api/domains", { headers, data: { ...claim, proof: proof.proof || proof.token } });
    assert.equal(claimed.status(), 200, await claimed.text()); const domain = await claimed.json();
    const longAddress = "a".repeat(48) + ".example.invalid";
    assert.equal(longAddress.length, 64, "Current custom-domain API limit");
    const longChallenge = await fixture.request.post(origin + "/api/domains", { headers, data: { address: longAddress } });
    assert.equal(longChallenge.status(), 409); const longProof = (await longChallenge.json()).verification;
    const longClaim = await fixture.request.post(origin + "/api/domains", { headers, data: { address: longAddress, proof: longProof.proof || longProof.token } });
    assert.equal(longClaim.status(), 200); const longDomain = await longClaim.json();
    assert.equal((await fixture.request.post(origin + "/api/domains/" + longDomain.id + "/grants", { headers, data: { email: accounts.recipient.email } })).status(), 201);
    const recipientHeaders = { ...json, Cookie: "token=" + accounts.recipient.token }, tags = [];
    for (const name of ["Quarterly campaign", ("Campaign <img src=x> internacional " + "long-label-".repeat(8)).slice(0, 80)]) {
      const response = await fixture.request.post(origin + "/api/library/labels", { headers: recipientHeaders, data: { kind: "tag", name } });
      assert.equal(response.status(), 201); tags.push(await response.json());
    }
    // Seed only the wrapper-owned disposable database, with distinct creator totals.
    const seedVisits = (id, total) => execFileSync("docker", ["exec", container, "node", "-e", `
      const assert = require("node:assert/strict");
      assert.equal(process.env.DB_FILENAME, "/tmp/kutt-smoke-domain-grants.sqlite");
      const db = new (require("better-sqlite3"))(process.env.DB_FILENAME);
      const link = db.prepare("SELECT * FROM links WHERE uuid=?").get(process.argv[1]);
      assert(link.address.startsWith("analytics-"));
      db.prepare("INSERT INTO visits(link_id,user_id,created_at,total,countries,referrers) VALUES(?,?,?,?,?,?)")
        .run(link.id, link.user_id, "2024-01-01 12:00:00", Number(process.argv[2]), JSON.stringify({FR:Number(process.argv[2])}), "{}");
      db.close();`, id, String(total)], { stdio: "pipe" });
    for (const locale of ["en", "fr", "es"]) for (const theme of ["light", "dark"]) {
      const catalog = require("../locales/" + locale + ".json"), t = key => catalog[key];
      const protectedResponse = await fixture.request.post(origin + "/api/links", {
        headers: { ...json, Cookie: "token=" + accounts.owner.token },
        data: { customurl: `protected-${locale}-${theme}`, target, password: "synthetic-link-password" }
      });
      assert.equal(protectedResponse.status(), 201);
      const protectedLink = await protectedResponse.json();
      const customProtectedResponse = await fixture.request.post(origin + "/api/links", {
        headers: { ...json, Cookie: "token=" + accounts.owner.token },
        data: { customurl: `protected-${locale}-${theme}`, domain: domain.address, target, password: "synthetic-link-password" }
      });
      assert.equal(customProtectedResponse.status(), 201);
      const customProtected = await customProtectedResponse.json();
      const publicLinks = [{ origin: shortOrigin, ...protectedLink },
        { origin: "http://" + domain.address, ...customProtected }, { origin: "http://www." + domain.address, ...customProtected }];
      const context = await browser.newContext({ locale, colorScheme: theme });
      await context.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      await context.addCookies([{ name: "token", value: accounts.owner.token, url: origin }]);
      const page = await context.newPage(), errors = [], violations = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.addInitScript(() => { window.cspViolations = []; document.addEventListener("securitypolicyviolation", event => window.cspViolations.push(event.violatedDirective)); });
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto(origin + "/settings/domain-sharing/" + domain.id);
      await page.getByLabel(t("domain_grants.recipient"), { exact: true }).fill(accounts.recipient.email);
      await page.getByRole("button", { name: t("domain_grants.grant"), exact: true }).focus();
      await Promise.all([page.waitForNavigation(), page.keyboard.press("Enter")]);
      assert.equal(await page.locator(".grant-list li").count(), 1);
      assert((await page.locator(".grant-list").innerText()).includes(accounts.recipient.email));
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 }); await page.reload();
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
        assert(await page.getByRole("heading", { name: t("domain_grants.title"), exact: true }).isVisible());
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const heading = await page.locator(".domain-grants header").boundingBox(), nav = await page.locator(".domain-grants > nav").boundingBox();
        const domainHeading = await page.locator(".domain-grants h2").boundingBox(), form = await page.locator(".grant-form").boundingBox();
        assert(nav.y >= heading.y + heading.height - 1 && domainHeading.y >= nav.y + nav.height - 1 && form.y >= domainHeading.y + domainHeading.height - 1, "Heading, navigation and form must not overlap");
        assert(form.height < 180, "No inherited shortener flex basis gap");
        const boxes = await page.locator(".domain-grants h1, .domain-grants h2, .domain-grants input[type=email], .domain-grants button").evaluateAll(nodes => nodes.map(node => {
          const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height, scroll: node.scrollWidth, client: node.clientWidth };
        }));
        for (const box of boxes) { assert(box.left >= 0 && box.right <= width + 1); assert(box.scroll <= box.client + 1); }
        assert.equal(await page.locator(".grant-list form").count(), 1);
        const label = await page.locator(".grant-list li > div").boundingBox(), button = await page.locator(".grant-list button").boundingBox();
        assert(label.y + label.height <= button.y + 1 || label.x + label.width <= button.x + 1, "Recipient and revoke button must not overlap");
        violations.push(...await page.evaluate(() => window.cspViolations));
        await page.screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}.png`), fullPage: true });
      }
      const recipient = await browser.newContext({ locale, colorScheme: theme });
      await recipient.route("**/*", route => {
        const url = route.request().url();
        if (url === target) return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Synthetic landing</title>Fixture" });
        return [origin, ...publicLinks.map(link => link.origin)].includes(new URL(url).origin) ? route.continue() : route.abort();
      });
      await recipient.addCookies([{ name: "token", value: accounts.recipient.token, url: origin }]);
      const recipientPage = await recipient.newPage();
      recipientPage.on("pageerror", error => errors.push(error.message));
      recipientPage.on("console", message => { if (["error", "warning"].includes(message.type())) errors.push(message.text()); });
      await recipientPage.addInitScript(() => { window.cspViolations = []; document.addEventListener("securitypolicyviolation", event => window.cspViolations.push(event.violatedDirective)); });
      await recipientPage.goto(origin + "/settings/domain-sharing");
      assert((await recipientPage.locator("main").innerText()).includes(domain.address));
      assert.equal(await recipientPage.locator(".grant-list form").count(), 0);
      await recipientPage.goto(origin + "/");
      assert.equal(await recipientPage.locator('#domain option[value="' + domain.address + '"]').count(), 1);
      const recipientLink = await recipient.request.post(origin + "/api/links", { headers: json,
        data: { customurl: `analytics-${locale}-${theme}-recipient`, domain: domain.address, target } });
      assert.equal(recipientLink.status(), 201);
      const recipientRecord = await recipientLink.json(); seedVisits(recipientRecord.id, 7);
      const ownerResponse = await fixture.request.post(origin + "/api/links", { headers,
        data: { customurl: `analytics-${locale}-${theme}-owner`, domain: domain.address, target } });
      assert.equal(ownerResponse.status(), 201); const ownerRecord = await ownerResponse.json(); seedVisits(ownerRecord.id, 11);
      const longResponse = await recipient.request.post(origin + "/api/links", { headers: json,
        data: { customurl: `analytics-${locale}-${theme}-long`, domain: longAddress, target } });
      assert.equal(longResponse.status(), 201); const longRecord = await longResponse.json(); seedVisits(longRecord.id, 3);
      for (const tag of tags) assert.equal((await recipient.request.post(origin + "/api/library/bulk", { headers: json,
        data: { action: "add_label", label_id: tag.id, ids: [recipientRecord.id, longRecord.id] } })).status(), 200);
      const analytics = async (reportPage, phase, expected, record) => {
        activePage = reportPage;
        const query = new URLSearchParams({ start: "2024-01-01", end: "2024-01-01", q: `analytics-${locale}-${theme}`, domain: domain.id });
        const ready = () => reportPage.waitForFunction(() => !document.querySelector("#analytics-report").hidden && !document.querySelector('#analytics-filters button[type="submit"]').disabled);
        const checkReport = async pending => {
          const response = await pending; assert.equal(response.status(), 200);
          const data = await response.json(); assert.equal(data.total, expected); assert.equal(data.matched_links, 1);
          assert.equal(data.visited_links, 1); assert(data.available_filters.domains.some(row => row.id === domain.id));
          await ready(); assert.equal(await reportPage.locator("#analytics-total").textContent(), String(expected));
          return data;
        };
        const waitReport = () => reportPage.waitForResponse(response => new URL(response.url()).pathname === "/api/analytics");
        for (const width of [1440, 390, 320]) {
          await reportPage.setViewportSize({ width, height: 1000 });
          const initial = waitReport(); await reportPage.goto(origin + "/settings/analytics?" + query); await checkReport(initial);
          await reportPage.evaluate(() => document.fonts.ready);
          assert.equal(await reportPage.locator("html").getAttribute("lang"), locale);
          assert.equal(await reportPage.locator("html").getAttribute("data-theme"), theme);
          assert((await reportPage.title()).includes(t("ui.analytics")));
          const select = reportPage.getByRole("combobox", { name: t("ui.domain"), exact: true });
          assert.equal(await select.inputValue(), domain.id);
          const fit = await select.evaluate(node => {
            const css = getComputedStyle(node), canvas = document.createElement("canvas").getContext("2d"); canvas.font = css.font;
            return { text: canvas.measureText(node.selectedOptions[0].textContent).width,
              available: node.clientWidth - parseFloat(css.paddingLeft) - Math.max(32, parseFloat(css.paddingRight)), font: parseFloat(css.fontSize) };
          });
          assert(fit.text <= fit.available, `Common hostname must fit the native selector (${locale}/${theme}/${width}): ${JSON.stringify(fit)}`);
          assert(fit.font >= 14, "Readable filter type size");
          assert(await reportPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
          violations.push(...await reportPage.evaluate(() => window.cspViolations));
          await reportPage.screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}-analytics-${phase}.png`), fullPage: true });
          await select.focus(); await reportPage.keyboard.type(t("ui.all_domains")); await reportPage.keyboard.press("Tab");
          assert.equal(await select.inputValue(), "");
          assert.equal(await reportPage.locator("#analytics-domain-value").textContent(), "", "Keyboard clearing removes stale selected text");
          assert(await reportPage.locator("#analytics-domain-value").isHidden());
          await select.selectOption(domain.id);
          const applied = waitReport(); await reportPage.locator('#analytics-filters button[type="submit"]').focus(); await reportPage.keyboard.press("Enter"); await checkReport(applied);
          const reloaded = waitReport(); await reportPage.reload(); await checkReport(reloaded);
          if (record) {
            assert.equal((await recipient.request.get(origin + "/api/analytics?" + query + "&link=" + ownerRecord.id)).status(), 404, "Recipient must not read the domain owner's link");
          } else {
            assert.equal((await fixture.request.get(origin + "/api/analytics?" + query + "&link=" + recipientRecord.id, { headers })).status(), 404, "Domain owner must not read a recipient's link");
          }
        }
      };
      await analytics(recipientPage, "recipient-before", 7, recipientRecord);
      await analytics(page, "owner-before", 11);
      // Long values are real API records, not options injected into a mocked report.
      for (const width of [1440, 390, 320]) {
        activePage = recipientPage; await recipientPage.setViewportSize({ width, height: 1000 });
        await recipientPage.locator('select[name="domain"]').selectOption(longDomain.id);
        const tagSelect = recipientPage.getByRole("combobox", { name: t("ui.tag"), exact: true });
        await tagSelect.selectOption(tags[0].id); await tagSelect.focus(); await recipientPage.keyboard.type("Campaign");
        await recipientPage.keyboard.press("Tab");
        assert.equal(await tagSelect.inputValue(), tags[1].id, "Long tag remains natively keyboard-selectable");
        for (const [name, value] of [["domain", longAddress], ["tag", tags[1].name]]) {
          const detail = recipientPage.locator("#analytics-" + name + "-value"), select = recipientPage.locator('select[name="' + name + '"]');
          assert.equal(await detail.innerText(), value); assert(await detail.isVisible());
          assert.equal(await select.getAttribute("aria-describedby"), "analytics-" + name + "-value");
          const box = await detail.evaluate(node => {
            const bounds = node.getBoundingClientRect(), range = document.createRange(); range.selectNodeContents(node);
            return { scroll: node.scrollWidth, client: node.clientWidth, height: node.clientHeight,
              lineHeight: parseFloat(getComputedStyle(node).lineHeight), size: parseFloat(getComputedStyle(node).fontSize), children: node.children.length,
              fits: [...range.getClientRects()].every(rect => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 && rect.bottom <= bounds.bottom + 1) };
          });
          assert(box.scroll <= box.client + 1 && box.fits && box.size >= 14 && box.children === 0, "Full selected text must fit safely, without HTML or small fonts: " + JSON.stringify(box));
          if (width < 640) assert(box.height >= box.lineHeight * 2, "Long values wrap on mobile");
        }
        const applied = recipientPage.waitForResponse(response => new URL(response.url()).pathname === "/api/analytics");
        await recipientPage.locator('#analytics-filters button[type="submit"]').focus(); await recipientPage.keyboard.press("Enter");
        const response = await applied; assert.equal(response.status(), 200); const data = await response.json();
        assert.equal(data.total, 3); assert.equal(data.matched_links, 1); assert.equal(data.filters.tag, tags[1].id);
        await recipientPage.waitForFunction(() => !document.querySelector("#analytics-report").hidden);
        assert(await recipientPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await recipientPage.locator("#analytics-filters img").count(), 0);
        violations.push(...await recipientPage.evaluate(() => window.cspViolations));
        await recipientPage.screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}-analytics-long.png`), fullPage: true });
      }
      const cleared = recipientPage.waitForResponse(response => new URL(response.url()).pathname === "/api/analytics");
      await recipientPage.getByRole("link", { name: t("ui.clear"), exact: true }).focus(); await recipientPage.keyboard.press("Enter");
      assert.equal((await cleared).status(), 200);
      await recipientPage.waitForFunction(() => !document.querySelector("#analytics-report").hidden);
      for (const name of ["domain", "tag"]) {
        assert.equal(await recipientPage.locator('select[name="' + name + '"]').inputValue(), "");
        assert.equal(await recipientPage.locator("#analytics-" + name + "-value").textContent(), "");
        assert(await recipientPage.locator("#analytics-" + name + "-value").isHidden());
      }
      await page.goto(origin + "/settings/domain-sharing/" + domain.id);
      const scopedResponse = await recipient.request.post(origin + "/api/tokens", { headers: json,
        data: { name: `Confirmation ${locale} ${theme}`, scopes: ["links:read"], domain_scope: domain.id } });
      assert.equal(scopedResponse.status(), 201); const scoped = await scopedResponse.json();
      const tokenStatus = async () => (await fixture.request.get(origin + "/api/links", {
        headers: { ...json, Cookie: "", "X-API-Key": scoped.token }
      })).status();
      const openConfirmation = async () => {
        await page.getByRole("button", { name: t("domain_grants.revoke_for").replace("{{email}}", accounts.recipient.email), exact: true }).focus();
        await Promise.all([page.waitForNavigation(), page.keyboard.press("Enter")]);
        assert(await page.getByRole("heading", { name: t("domain_grants.confirm_title"), exact: true }).isVisible());
      };
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 1000 }); await openConfirmation();
        assert.equal(await page.locator("html").getAttribute("lang"), locale);
        assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
        const content = await page.locator("main").innerText();
        assert(content.includes(accounts.recipient.email) && content.includes(domain.address));
        for (const key of ["confirm_tokens", "confirm_health", "confirm_redirects"]) assert(content.includes(t("domain_grants." + key)));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        for (const box of await page.locator(".domain-grants h1, .grant-confirm-actions > a, .grant-confirm-actions > button").evaluateAll(nodes => nodes.map(node => {
          const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, scroll: node.scrollWidth, client: node.clientWidth };
        }))) { assert(box.left >= 0 && box.right <= width + 1); assert(box.scroll <= box.client + 1); }
        const consequences = await page.locator(".grant-consequences").boundingBox(), actions = await page.locator(".grant-confirm-actions").boundingBox();
        assert(actions.y >= consequences.y + consequences.height - 1 && actions.height < 180, "Confirmation actions must follow the warning without inherited gaps");
        violations.push(...await page.evaluate(() => window.cspViolations));
        await page.screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}-confirm.png`), fullPage: true });
        await page.getByRole("link", { name: t("ui.cancel"), exact: true }).focus();
        await Promise.all([page.waitForNavigation(), page.keyboard.press("Enter")]);
        assert.equal(await page.locator(".grant-list li").count(), 1);
        assert.equal(await tokenStatus(), 200, "Cancel must not revoke the recipient's domain-scoped token");
      }
      await openConfirmation();
      await page.getByRole("button", { name: t("domain_grants.revoke"), exact: true }).focus();
      const confirmationPath = new URL(page.url()).pathname;
      const confirmationPost = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname === confirmationPath);
      await Promise.all([page.waitForNavigation(), page.keyboard.press("Enter")]);
      const confirmed = await confirmationPost;
      assert.equal(confirmed.status(), 303); assert.equal(confirmed.request().headers().origin, origin);
      assert((await page.locator(".grant-list").innerText()).includes(t("domain_grants.empty")));
      assert.equal(await tokenStatus(), 401, "Only the confirmed POST revokes the scoped token");
      await recipientPage.goto(origin + "/");
      assert.equal(await recipientPage.locator('#domain option[value="' + domain.address + '"]').count(), 0);
      await analytics(recipientPage, "recipient-after", 7, recipientRecord);
      await analytics(page, "owner-after", 11);
      violations.push(...await recipientPage.evaluate(() => window.cspViolations));
      assert(!(await recipient.cookies(origin.replace("localhost", "127.0.0.1"))).some(cookie => cookie.name === "token"));
      const publicPage = await recipient.newPage();
      publicPage.on("pageerror", error => errors.push(error.message));
      await publicPage.addInitScript(() => { window.cspViolations = []; document.addEventListener("securitypolicyviolation", event => window.cspViolations.push(event.violatedDirective)); });
      for (const publicLink of publicLinks) for (const width of [320, 390, 1440]) {
        await publicPage.setViewportSize({ width, height: 1000 });
        await publicPage.goto(publicLink.origin + "/" + publicLink.address);
        await publicPage.evaluate(() => document.fonts.ready);
        assert.equal(await publicPage.evaluate(() => typeof window.htmx?.ajax), "function", "Short-host HTMX assets must load");
        assert.equal(await publicPage.locator('a[href="/login"]').count(), 0);
        assert(await publicPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        violations.push(...await publicPage.evaluate(() => window.cspViolations));
        await publicPage.screenshot({ path: path.join(evidence, `${locale}-${theme}-${width}-protected-${new URL(publicLink.origin).hostname}.png`), fullPage: true });
        await publicPage.locator('#protected-link-password').fill("synthetic-link-password");
        const submitted = publicPage.waitForResponse(response => response.url() === publicLink.origin + "/api/links/" + publicLink.id + "/protected");
        await publicPage.locator('#protected-link-password').press("Enter");
        const response = await submitted;
        assert.equal(response.status(), 200); assert.equal(response.request().headers().origin, publicLink.origin);
        assert(!response.request().headers().cookie?.includes("token="));
        await publicPage.waitForURL(target);
      }
      assert.deepEqual(errors, []); assert.deepEqual(violations, []);
      await recipient.close(); await context.close();
      console.log("PASS: grants native keyboard confirm/cancel, scoped-token revocation, creator-only analytics before/after revoke, common/long domain+tag text fit, keyboard filters/apply/reload/clear, ownership selectors, host-only cookies, public protected forms and enforced CSP " + locale + "/" + theme + " 320/390/1440");
    }
    const noScriptGrant = await fixture.request.post(origin + "/api/domains/" + domain.id + "/grants", { headers, data: { email: accounts.recipient.email } });
    assert.equal(noScriptGrant.status(), 201); const grantId = (await noScriptGrant.json()).id;
    const noScript = await browser.newContext({ javaScriptEnabled: false, locale: "en", viewport: { width: 390, height: 1000 } });
    await noScript.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await noScript.addCookies([{ name: "token", value: accounts.owner.token, url: origin }]);
    const nativePage = await noScript.newPage(), catalog = require("../locales/en.json");
    await nativePage.goto(origin + "/settings/domain-sharing/" + domain.id);
    const openNative = async () => {
      await nativePage.getByRole("button", { name: catalog["domain_grants.revoke_for"].replace("{{email}}", accounts.recipient.email), exact: true }).focus();
      await Promise.all([nativePage.waitForNavigation(), nativePage.keyboard.press("Enter")]);
      assert(await nativePage.getByRole("heading", { name: catalog["domain_grants.confirm_title"], exact: true }).isVisible());
    };
    await openNative();
    await nativePage.getByRole("link", { name: catalog["ui.cancel"], exact: true }).focus();
    await Promise.all([nativePage.waitForNavigation(), nativePage.keyboard.press("Enter")]);
    const retained = await fixture.request.get(origin + "/api/domains/" + domain.id + "/grants", { headers });
    assert((await retained.json()).data.some(row => row.id === grantId));
    await openNative();
    await nativePage.getByRole("button", { name: catalog["domain_grants.revoke"], exact: true }).focus();
    await Promise.all([nativePage.waitForNavigation(), nativePage.keyboard.press("Enter")]);
    assert((await nativePage.locator(".grant-list").innerText()).includes(catalog["domain_grants.empty"]));
    const stale = await nativePage.goto(origin + "/settings/domain-sharing/" + domain.id + "/revoke/" + grantId);
    assert.equal(stale.status(), 404); assert.equal(await nativePage.locator('input[name="confirm"]').count(), 0);
    await noScript.close();
    console.log("PASS: JavaScript-disabled native keyboard cancellation, confirmation and stale-grant page");
  } catch (error) {
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true });
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
