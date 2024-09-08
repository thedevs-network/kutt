const { Handler } = require("express");

const { CustomError, sanitize, sleep } = require("../utils");
const query = require("../queries");
const redis = require("../redis");

async function add(req, res) {
  const { address, homepage } = req.body;

  const domain = await query.domain.add({
    address,
    homepage,
    user_id: req.user.id
  });

  if (req.isHTML) {
    const domains = (await query.domain.get({ user_id: req.user.id })).map(sanitize.domain);
    res.setHeader("HX-Reswap", "none");
    res.render("partials/settings/domain/table", {
      domains
    });
    return;
  }
  
  return res.status(200).send(sanitize.domain(domain));
};

async function remove(req, res) {
  const [domain] = await query.domain.update(
    {
      uuid: req.params.id,
      user_id: req.user.id
    },
    { user_id: null }
  );

  redis.remove.domain(domain);

  if (!domain) {
    throw new CustomError("Could not delete the domain.", 500);
  }

  if (req.isHTML) {
    const domains = (await query.domain.get({ user_id: req.user.id })).map(sanitize.domain);
    res.setHeader("HX-Reswap", "outerHTML");
    res.render("partials/settings/domain/delete_success", {
      domains,
      address: domain.address,
    });
    return;
  }

  return res.status(200).send({ message: "Domain deleted successfully" });
};

module.exports = {
  add,
  remove,
}