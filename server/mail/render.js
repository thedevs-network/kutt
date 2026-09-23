const fs = require("node:fs");
const path = require("node:path");
const handlebars = require("hbs").handlebars;
const i18n = require("../i18n");
const templates = new Map();
const kinds = Object.freeze({
  verify: { route: "verify", subject: "messages.verify_your_account", text: "mail.verify_text" },
  "change-email": { route: "verify-email", subject: "messages.verify_your_new_email_address", text: "mail.change_text" },
  reset: { route: "reset-password", subject: "messages.reset_your_password", text: "mail.reset_text" }
});
function render(kind, { domain, site_name, token, origin = `https://${domain}` }, translator = i18n.current()) {
  if (!Object.hasOwn(kinds, kind)) throw new Error("Invalid email template.");
  if (!templates.has(kind)) templates.set(kind, handlebars.compile(fs.readFileSync(path.join(__dirname, "template-" + kind + ".html"), "utf8")));
  const info = kinds[kind];
  const values = { domain, origin, site_name, verification: token, resetpassword: token, locale: translator.locale };
  return {
    subject: translator.t(info.subject),
    text: translator.t(info.text, { site: site_name, url: `${origin}/${info.route}/${token}` }),
    html: templates.get(kind)(values, { helpers: { t: (key, options) => translator.t(key, options.hash) } })
  };
}
module.exports = { render };
