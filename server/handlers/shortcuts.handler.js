const i18n = require("../i18n");
const path = require("node:path");
const env = require("../env");
const tokens = require("../api-tokens");
const { CustomError } = require("../utils");

function endpoint() {
  const management = require("../management-origin").configured();
  if (management) return management.origin + "/api/v2/links";
  // Never derive the credential destination from Host/Forwarded headers.
  const host = env.DEFAULT_DOMAIN;
  let url;
  try { url = new URL("https://" + host); } catch {}
  if (!url || url.username || url.password || url.host !== host || url.pathname !== "/" || url.search || url.hash) {
    throw new CustomError(i18n.t("messages.configure_a_valid_https_default_domain_before_creating_a_shortcut"), 503);
  }
  return url.origin + "/api/v2/links";
}
function recipe(req, res) {
  res.json({ endpoint: endpoint(), method: "POST", header: "X-API-Key",
    token_policy: { scopes: ["links:create"], domain_scope: "default", expires_in_days: 30 },
    body: { target: i18n.t("messages.selected_url"), reuse: true }, result: "link",
    template: "/api/v2/shortcuts/template", guide: "/api/v2/shortcuts/guide" });
}
async function create(req, res) {
  endpoint();
  if (!req.body || Array.isArray(req.body) || typeof req.body !== "object" ||
      Object.keys(req.body).some(key => key !== "name")) {
    throw new CustomError(i18n.t("messages.only_the_shortcut_name_is_accepted_permissions_and_expiry_are_fixed"), 400);
  }
  res.status(201).json(await tokens.create(req.user.id, {
    name: req.body.name, scopes: ["links:create"], domain_scope: "default", expires_in_days: 30
  }, req.user.auth_version));
}
function template(req, res) {
  res.set("X-Content-Type-Options", "nosniff");
  res.download(path.join(__dirname, "../../examples/Kutt-Shorten-URL.shortcut"), "Kutt-Shorten-URL.shortcut");
}
function guide(req, res) {
  const localized = path.join(__dirname, "../../locales", i18n.current().locale, "IOS-SHORTCUT.md");
  res.type("text/plain").sendFile(require("node:fs").existsSync(localized) ? localized : path.join(__dirname, "../../examples/IOS-SHORTCUT.md"));
}
function page(req, res) {
  res.render("shortcuts", { title: i18n.t("ui.ios_shortcut"), endpoint: endpoint(),
    custom_styles: [...(res.locals.custom_styles || []), "shortcuts.css"] });
}
module.exports = { endpoint, recipe, create, template, guide, page };
