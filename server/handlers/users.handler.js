const query = require("../queries");
const utils = require("../utils");
const env = require("../env");

async function get(req, res) {
  const domains = await query.domain.get({ user_id: req.user.id });

  const data = {
    apikey: req.user.apikey,
    email: req.user.email,
    domains: domains.map(utils.sanitize.domain)
  };

  return res.status(200).send(data);
};

async function remove(req, res) {
  await query.user.remove(req.user);

  if (req.isHTML) {
    res.clearCookie("token", { httpOnly: true, secure: env.isProd });
    res.setHeader("HX-Trigger-After-Swap", "redirectToHomepage");
    res.render("partials/settings/delete_account", {
      success: "Account has been deleted. Logging out..."
    });
    return;
  }
  
  return res.status(200).send("OK");
};

module.exports = {
  get,
  remove,
}