const { createHash } = require("node:crypto");

function parse(env) {
  const enabled = env.OIDC_ADMIN_MAPPING_ENABLED;
  const invalid = () => { throw new Error("OIDC administrator mapping configuration is invalid."); };
  if (typeof enabled !== "boolean") invalid();
  if (!enabled) return Object.freeze({ enabled: false, fingerprint: "disabled" });
  const claim = env.OIDC_ADMIN_CLAIM;
  try {
    const issuer = new URL(env.OIDC_ISSUER);
    if (issuer.username || issuer.password || /[\s?#]/.test(env.OIDC_ISSUER) ||
        (issuer.protocol !== "https:" && !(env.isDev && issuer.protocol === "http:" && issuer.hostname === "127.0.0.1"))) invalid();
  } catch { invalid(); }
  const reserved = new Set(["email", "email_verified", "sub", "iss", "aud", "iat", "exp", "nbf", "nonce", "sid", "jti", "at_hash", "c_hash", "s_hash", "auth_time", "acr", "amr"]);
  if (!env.OIDC_ENABLED || env.DISALLOW_LOGIN_FORM || !env.OIDC_ISSUER || !env.OIDC_CLIENT_ID ||
      !env.OIDC_CLIENT_SECRET || typeof claim !== "string" || claim.trim() !== claim || !/^[A-Za-z][A-Za-z0-9_:/.-]{0,127}$/.test(claim) || reserved.has(claim.toLowerCase()) || claim === env.OIDC_EMAIL_CLAIM ||
      !/^[1-9][0-9]{0,9}$/.test(env.OIDC_BREAK_GLASS_USER_ID) || String(Number(env.OIDC_BREAK_GLASS_USER_ID)) !== env.OIDC_BREAK_GLASS_USER_ID || Number(env.OIDC_BREAK_GLASS_USER_ID) > 2147483647 ||
      ![300, 900, 1800, 3600].includes(env.OIDC_ADMIN_MAX_AGE_SECONDS)) invalid();
  let values;
  try {
    if (env.OIDC_ADMIN_VALUES.length > 8192) invalid();
    values = JSON.parse(env.OIDC_ADMIN_VALUES);
  } catch { invalid(); }
  if (!Array.isArray(values) || !values.length || values.length > 32 ||
      values.some(value => !validValue(value)) || new Set(values).size !== values.length) invalid();
  values.sort();
  const policy = { enabled, claim, values: Object.freeze(values), protectedId: Number(env.OIDC_BREAK_GLASS_USER_ID),
    maxAge: env.OIDC_ADMIN_MAX_AGE_SECONDS };
  const fingerprint = createHash("sha256").update(JSON.stringify([env.OIDC_ISSUER, env.OIDC_CLIENT_ID,
    env.OIDC_ID_TOKEN_SIGNING_ALG, policy])).digest("hex");
  return Object.freeze({ ...policy, fingerprint });
}

function validValue(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\x00-\x1f\x7f]/.test(value);
}

function decision(policy, claims) {
  if (!Object.hasOwn(claims, policy.claim)) return "USER";
  const value = claims[policy.claim];
  const values = Array.isArray(value) ? value : [value];
  if (values.length > 64 || values.some(item => !validValue(item))) return null;
  return values.some(item => policy.values.includes(item)) ? "ADMIN" : "USER";
}

module.exports = { parse, decision };
