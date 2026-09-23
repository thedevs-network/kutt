const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const net = require("node:net");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

module.exports = async ({ request, session, root, directory, env }) => {
  const response = await request("POST", "/api/links", { customurl: "login-copy-" + randomUUID(), target: "https://192.0.2.1/login-copy" }, session);
  assert.equal(response.status, 201);
  const link = await response.json();
  try {
    for (const [name, local, registration, mail, oidc] of [
      ["sso-only", false, false, false, true],
      ["local-only", true, false, false, false],
      ["registration", true, true, true, false],
      ["no-mail", true, true, false, false],
      ["closed", false, false, false, false],
      ["combined", true, true, true, true],
      ["hidden-registration", false, true, true, true],
    ]) {
      const listener = net.createServer();
      await new Promise(resolve => listener.listen(0, "127.0.0.1", resolve));
      const port = listener.address().port;
      await new Promise(resolve => listener.close(resolve));
      const child = spawn(process.execPath, [path.join(root, "server/server.js")], {
        cwd: directory, stdio: "ignore", env: { ...env, PORT: String(port), DEFAULT_DOMAIN: `127.0.0.1:${port}`, DISALLOW_LOGIN_FORM: String(!local),
          DISALLOW_REGISTRATION: String(!registration), MAIL_ENABLED: String(mail), OIDC_ENABLED: String(oidc),
          OIDC_ISSUER: "https://identity.example.invalid/", OIDC_CLIENT_ID: "synthetic", OIDC_CLIENT_SECRET: "synthetic-only" }
      });
      const exited = new Promise(resolve => { child.once("exit", resolve); child.once("error", resolve); });
      const call = (pathname, method = "GET", body) => fetch(`http://127.0.0.1:${port}` + pathname,
        { method, redirect: "manual", signal: AbortSignal.timeout(10000),
          headers: { Accept: method === "GET" ? "text/html" : "application/json", "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body) });
      try {
        let ready = false;
        for (let attempt = 0; attempt < 100; attempt++) {
          try { if ((await call("/api/health")).status === 200) { ready = true; break; } } catch {}
          await delay(100);
        }
        assert(ready, name + " configuration did not start");
        const page = await call("/login"); assert.equal(page.status, 200);
        const html = await page.text(), enabled = local && registration && mail, closed = !local && !oidc;
        const title = closed ? "Login is closed" : enabled ? "Log in or sign up" : "Log in";
        assert(html.includes(` | ${title}</title>`), name + " title");
        const headerMatch = html.match(/<header\b[^>]*>[\s\S]*?<\/header>/);
        assert(headerMatch, name + " site header");
        const header = headerMatch[0];
        assert.equal(/href="\/login"/.test(header), !closed, name + " login entry");
        assert.equal(header.includes("Log in / Sign up"), enabled, name + " header registration copy");
        assert.equal(html.includes('class="secondary signup"'), enabled, name + " registration control");
        assert.equal(html.includes('name="password"'), local, name + " local fields");
        assert.equal(html.includes('href="/login/oidc"'), oidc, name + " SSO entry");
        for (const endpoint of [...(!local ? ["login"] : []), ...(!registration || !mail ? ["signup"] : [])]) {
          const denied = await call("/api/auth/" + endpoint, "POST", {});
          assert.equal(denied.status, 400, "Preserve the existing feature-denial API status");
          assert.equal((await denied.json()).error, "Request is not allowed.");
          assert(!denied.headers.getSetCookie().some(value => value.startsWith("token=")));
        }
        const redirect = await call("/" + link.address);
        assert.equal(redirect.status, 302, name + " public redirect");
        assert.equal(redirect.headers.get("location"), "https://192.0.2.1/login-copy");
      } finally {
        child.kill("SIGTERM");
        if (!await Promise.race([exited.then(() => true), delay(5000).then(() => false)])) {
          child.kill("SIGKILL"); await exited;
        }
      }
    }
  } finally { assert.equal((await request("DELETE", "/api/links/" + link.id, undefined, session)).status, 200); }
  console.log("PASS: sign-in/registration copy matches seven configuration modes, disabled controls retain policy denial, and redirects stay public");
};
