const i18n = require("../i18n");
const knex = require("../knex");
const env = require("../env");
const oidc = require("../oidc-client");
const security = require("../oidc-security");
const utils = require("../utils");

async function status(req, res) {
  res.set("Cache-Control", "no-store");
  const identities = await knex("oidc_identities").where({ user_id: req.user.id }).select("issuer", "created_at");
  const result = { identities: identities.map(row => ({ issuer: row.issuer, created_at: new Date(Number(row.created_at)).toISOString() })),
    oidc_session_max_seconds: env.OIDC_SESSION_MAX_SECONDS,
    ...(req.user.admin && { provider: oidc.status(), role_mapping: await require("../oidc-roles").status() }) };
  if (!req.isHTML) return res.json(result);
  res.render("security", { title: i18n.t("ui.account_security"), ...result });
}

async function revoke(req, res) {
  await security.revoke(req.user.id);
  utils.deleteCurrentToken(res);
  res.set("Cache-Control", "no-store");
  if (req.isHTML) {
    res.set("HX-Redirect", "/login");
    return res.send(i18n.t("messages.sessions_revoked"));
  }
  return res.status(204).end();
}

async function backchannel(req, res) {
  res.set("Cache-Control", "no-store");
  if (!env.OIDC_ENABLED) return res.status(404).end();
  try {
    await oidc.logout(req.body?.logout_token);
    return res.status(200).end();
  } catch {
    return res.status(400).json({ error: i18n.t("messages.invalid_logout_notification") });
  }
}

module.exports = { status, revoke, backchannel };
