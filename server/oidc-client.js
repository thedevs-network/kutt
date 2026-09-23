const env = require("./env");
const state = { enabled: env.OIDC_ENABLED, ready: false, code: env.OIDC_ENABLED ? "OIDC_STARTING" : "OIDC_DISABLED" };
let promise;
let retryAt = 0;

function client() {
  if (!env.OIDC_ENABLED) return Promise.reject(new Error("OIDC_DISABLED"));
  if (promise) return promise;
  if (Date.now() < retryAt) return Promise.reject(new Error(state.code));
  promise = (async () => {
    if (!env.OIDC_CLIENT_ID || !env.OIDC_CLIENT_SECRET) throw new Error("OIDC_CONFIG_MISSING");
    const { Issuer, custom } = require("openid-client");
    custom.setHttpOptionsDefaults({ timeout: 5000 });
    const url = new URL(env.OIDC_ISSUER);
    if (url.protocol !== "https:" && !(env.isDev && url.hostname === "127.0.0.1")) throw new Error("OIDC_HTTPS_REQUIRED");
    const issuer = await Issuer.discover(env.OIDC_ISSUER);
    if (issuer.issuer !== env.OIDC_ISSUER) throw new Error("OIDC_ISSUER_MISMATCH");
    for (const endpoint of [issuer.authorization_endpoint, issuer.token_endpoint, issuer.userinfo_endpoint, issuer.jwks_uri].filter(Boolean)) {
      const endpointURL = new URL(endpoint);
      if (endpointURL.protocol !== "https:" && !(env.isDev && endpointURL.hostname === "127.0.0.1")) throw new Error("OIDC_HTTPS_REQUIRED");
    }
    const client = new issuer.Client({ client_id: env.OIDC_CLIENT_ID, client_secret: env.OIDC_CLIENT_SECRET,
      id_token_signed_response_alg: env.OIDC_ID_TOKEN_SIGNING_ALG,
      redirect_uris: [require("./utils").getSiteURL() + "/login/oidc"], response_types: ["code"] });
    state.ready = true; state.code = "OIDC_READY"; state.last_ready_at = new Date().toISOString();
    return client;
  })().catch(error => {
    state.ready = false;
    state.code = ["OIDC_HTTPS_REQUIRED", "OIDC_ISSUER_MISMATCH", "OIDC_CONFIG_MISSING"].includes(error.message) ? error.message : "OIDC_PROVIDER_UNAVAILABLE";
    state.last_error_at = new Date().toISOString();
    promise = undefined; retryAt = Date.now() + 10000;
    throw new Error(state.code);
  });
  return promise;
}

let keys;
async function logout(token) {
  if (typeof token !== "string" || token.length > 16384) throw new Error("OIDC_LOGOUT_INVALID");
  const configured = await client();
  const { createRemoteJWKSet, jwtVerify } = await import("jose");
  keys ||= createRemoteJWKSet(new URL(configured.issuer.jwks_uri), { timeoutDuration: 5000, cooldownDuration: 30000 });
  const { payload } = await jwtVerify(token, keys, {
    issuer: configured.issuer.issuer, audience: env.OIDC_CLIENT_ID,
    algorithms: [env.OIDC_ID_TOKEN_SIGNING_ALG], clockTolerance: 15,
    requiredClaims: ["iss", "aud", "iat", "jti", "events"]
  });
  await require("./oidc-security").recordLogout(payload);
}

function failure(code) {
  state.last_auth_error = /^OIDC_[A-Z_]+$/.test(code || "") ? code : "OIDC_AUTHENTICATION_FAILED";
  state.last_auth_error_at = new Date().toISOString();
}

module.exports = { client, logout, failure, status: () => ({ ...state }) };
