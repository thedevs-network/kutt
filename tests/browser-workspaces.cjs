const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  const origin = process.env.KUTT_TEST_URL;
  assert(origin && new URL(origin).hostname === "127.0.0.1", "Use a fresh loopback-only instance");
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), "kutt-workspaces-ui-"));
  const browser = await chromium.launch({ headless: true });
  let page;
  try {
    const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
    const headers = { Accept: "application/json" };
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await context.request.get(origin + "/api/health")).status() === 200) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert(ready);
    const account = { email: "browser-workspaces@example.invalid", password: randomBytes(32).toString("hex") };
    const setup = await context.request.post(origin + "/api/auth/create-admin", { data: account, headers });
    assert.equal(setup.status(), 201, "Refuse initialized instances");
    await context.addCookies([{ name: "token", value: (await setup.json()).token, url: origin }]);
    page = await context.newPage();
    const errors = [];
    const track = p => { p.on("pageerror", e => errors.push(e.message)); p.on("dialog", d => d.accept()); };
    track(page);
    const roles = {};
    for (const role of ["editor", "viewer"]) {
      const email = `${role}-browser@example.invalid`;
      const created = await context.request.post(origin + "/api/users/admin", { data: { email, password: account.password, verified: true }, headers });
      assert.equal(created.status(), 201);
      const member = await browser.newContext();
      const login = await member.request.post(origin + "/api/auth/login", { data: { email, password: account.password }, headers });
      assert.equal(login.status(), 200);
      await member.addCookies([{ name: "token", value: (await login.json()).token, url: origin }]);
      roles[role] = { context: member, page: await member.newPage(), email };
      track(roles[role].page);
    }
    const submit = async (p, button) => {
      const response = p.waitForResponse(r => r.url().includes("/settings/workspaces") && r.request().method() === "POST");
      await button.click();
      const r = await response;
      if (r.status() !== 303) assert.fail(`Workspace form returned ${r.status()}: ${await r.text()}`);
      await p.waitForLoadState("networkidle");
    };
    const manage = async p => { await p.locator("summary").filter({ hasText: /^Workspace and members$/ }).click(); };
    for (const [label, viewport] of [["desktop", { width: 1440, height: 1000 }], ["mobile", { width: 390, height: 844 }]]) {
      for (const p of [page, roles.editor.page, roles.viewer.page]) await p.setViewportSize(viewport);
      const name = "Family " + label;
      await page.goto(origin + "/settings/workspaces");
      const create = page.getByRole("form", { name: "Create workspace", exact: true });
      await create.getByLabel("Workspace name").fill(name);
      await submit(page, create.getByRole("button", { name: "Create workspace" }));
      const spaceURL = page.url(), id = new URL(spaceURL).pathname.split("/").pop();
      await manage(page);
      let rename = page.getByRole("form", { name: "Rename workspace" });
      await rename.getByLabel("Name", { exact: true }).fill(name + " links");
      await submit(page, rename.getByRole("button", { name: "Save workspace name" }));
      for (const role of ["editor", "viewer"]) {
        await manage(page);
        const invite = page.getByRole("form", { name: "Invite member" });
        await invite.getByLabel("Account email").fill(roles[role].email);
        await invite.getByLabel("Role", { exact: true }).selectOption(role);
        await submit(page, invite.getByRole("button", { name: "Invite", exact: true }));
        const p = roles[role].page;
        await p.goto(origin + "/settings/workspaces");
        await submit(p, p.getByRole("form", { name: "Invitation to " + name + " links" }).getByRole("button", { name: "Accept", exact: true }));
        assert.equal(p.url(), spaceURL);
      }
      const personalResponse = await context.request.post(origin + "/api/links", { data: { target: "https://192.0.2.1/personal", customurl: "browser-personal-" + label }, headers });
      assert.equal(personalResponse.status(), 201); const personal = await personalResponse.json();
      await page.goto(spaceURL); await manage(page);
      const share = page.getByRole("form", { name: "Share existing link" });
      await share.getByLabel("Personal link", { exact: true }).selectOption(personal.id);
      await submit(page, share.getByRole("button", { name: "Share link", exact: true }));
      const ep = roles.editor.page;
      await ep.reload(); await ep.getByText("Create shared link", { exact: true }).click();
      const linkForm = ep.getByRole("form", { name: "Create shared link" });
      await linkForm.getByLabel("Destination", { exact: true }).fill("https://192.0.2.1/" + label + "/" + "longsegment".repeat(18));
      await linkForm.getByLabel("Alias", { exact: true }).fill("workspace-browser-" + label);
      await linkForm.getByLabel("Description", { exact: true }).fill("Shared reading list");
      await submit(ep, linkForm.getByRole("button", { name: "Create link", exact: true }));
      const link = (await (await roles.editor.context.request.get(origin + "/api/workspaces/" + id, { headers })).json()).data.find(l => l.address === "workspace-browser-" + label);
      assert(link);
      let row = ep.locator(".workspace-links > li").filter({ has: ep.getByRole("link", { name: link.link, exact: true }) });
      await row.getByText("Edit link", { exact: true }).click();
      let edit = ep.getByRole("form", { name: "Edit " + link.address });
      await edit.getByLabel("Description", { exact: true }).fill("Updated shared reading list");
      await edit.getByLabel("Paused", { exact: true }).check();
      await edit.getByLabel("Maximum redirects", { exact: true }).fill("20");
      await ep.screenshot({ path: path.join(evidence, `${label}-editor.png`), fullPage: true });
      assert(await ep.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: edit form overflow`);
      await submit(ep, edit.getByRole("button", { name: "Save link", exact: true }));
      const vp = roles.viewer.page;
      await vp.reload();
      assert.equal(await vp.getByRole("button", { name: "Save link" }).count(), 0);
      assert.equal(await vp.getByText("Create shared link", { exact: true }).count(), 0);
      assert.equal(await vp.getByText("Workspace and members", { exact: true }).count(), 0);
      assert(await vp.getByText("Updated shared reading list", { exact: true }).isVisible());
      await vp.screenshot({ path: path.join(evidence, `${label}-viewer.png`), fullPage: true });
      await page.reload(); await manage(page);
      const member = page.getByRole("form", { name: "Member " + roles.editor.email });
      await member.getByLabel("Role", { exact: true }).selectOption("viewer");
      await submit(page, member.getByRole("button", { name: "Save role", exact: true }));
      await ep.reload(); assert.equal(await ep.getByText("Edit link", { exact: true }).count(), 0);
      await manage(page);
      const memberAgain = page.getByRole("form", { name: "Member " + roles.editor.email });
      await memberAgain.getByLabel("Role", { exact: true }).selectOption("editor");
      await submit(page, memberAgain.getByRole("button", { name: "Save role", exact: true }));
      await ep.reload();
      row = ep.locator(".workspace-links > li").filter({ has: ep.getByRole("link", { name: link.link, exact: true }) });
      await row.getByText("Edit link", { exact: true }).click();
      edit = ep.getByRole("form", { name: "Edit " + link.address });
      await edit.getByLabel("Paused", { exact: true }).uncheck();
      await submit(ep, edit.getByRole("button", { name: "Save link", exact: true }));
      row = ep.locator(".workspace-links > li").filter({ has: ep.getByRole("link", { name: link.link, exact: true }) });
      await submit(ep, row.getByRole("button", { name: "Move to trash", exact: true }));
      await ep.getByRole("form", { name: "Filter shared links" }).getByLabel("State").selectOption("trash");
      await ep.getByRole("form", { name: "Filter shared links" }).getByRole("button", { name: "Filter" }).click();
      await submit(ep, ep.getByRole("button", { name: "Restore", exact: true }));
      await page.reload(); await manage(page);
      await page.screenshot({ path: path.join(evidence, `${label}-owner.png`), fullPage: true });
      for (const p of [page, ep, vp]) {
        assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${label}: horizontal overflow`);
      }
      const copy = page.locator(".workspace-links > li").filter({ has: page.getByRole("link", { name: link.link, exact: true }) }).getByRole("button", { name: "Copy short link", exact: true });
      await copy.click(); assert.equal(await page.evaluate(() => navigator.clipboard.readText()), link.link);
      await submit(page, page.getByRole("form", { name: "Member " + roles.viewer.email }).getByRole("button", { name: "Remove member or invitation" }));
      await vp.goto(origin + "/settings/workspaces");
      assert.equal(await vp.getByRole("link", { name: name + " links", exact: true }).count(), 0);
      await page.goto(spaceURL); await manage(page);
      await submit(page, page.getByRole("button", { name: "Close workspace", exact: true }));
      const redirect = await context.request.get(origin + "/" + link.address, { maxRedirects: 0 });
      assert.equal(redirect.status(), 302, "Closing must preserve public links");
    }
    assert.deepEqual(errors, []);
    console.log("PASS: desktop/mobile workspace create/rename/invite/accept/share/editor/viewer/role change/trash/restore/copy/revoke/close, public redirect preservation; " + evidence);
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(evidence, "failure.png"), fullPage: true }).catch(() => {});
    console.error("Browser evidence: " + evidence); throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
