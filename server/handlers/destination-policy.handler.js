const policy = require("../destination-policy");
const i18n = require("../i18n");
function get(req, res) { res.set("Cache-Control", "private, no-store").json(policy.status()); }
function page(req, res) {
  res.set("Cache-Control", "private, no-store").render("destination_policy", {
    title: i18n.t("destination_policy.title"), ...policy.status()
  });
}
module.exports = { get, page };
