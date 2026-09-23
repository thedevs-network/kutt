// Synthetic outage/cancellation fixture. Never run against production identity data.
const assert = require("node:assert/strict");
const http = require("node:http");
assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
const issuer = new URL(process.env.KUTT_TEST_PROVIDER_URL);
const app = new URL(process.env.KUTT_TEST_URL);
for (const url of [issuer, app]) {
  assert.equal(url.hostname, "127.0.0.1");
  assert.equal(url.protocol, "http:");
}
let ready = false;
http.createServer((req, res) => {
  const url = new URL(req.url, issuer);
  if (req.method === "POST" && url.pathname === "/fixture-ready") { ready = true; return res.writeHead(204).end(); }
  if (!ready) return res.writeHead(503).end();
  if (url.pathname === "/.well-known/openid-configuration") {
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ issuer: issuer.origin, authorization_endpoint: issuer.origin + "/authorize",
      token_endpoint: issuer.origin + "/token", jwks_uri: issuer.origin + "/jwks", response_types_supported: ["code"],
      subject_types_supported: ["public"], id_token_signing_alg_values_supported: ["RS256"],
      token_endpoint_auth_methods_supported: ["client_secret_basic"], code_challenge_methods_supported: ["S256"] }));
  }
  if (url.pathname === "/authorize" && url.searchParams.get("redirect_uri") === app.origin + "/login/oidc") {
    const callback = new URL(url.searchParams.get("redirect_uri"));
    callback.searchParams.set("error", "access_denied"); callback.searchParams.set("state", url.searchParams.get("state"));
    return res.writeHead(302, { Location: callback.href }).end();
  }
  res.writeHead(404).end();
}).listen(Number(issuer.port), "0.0.0.0");
