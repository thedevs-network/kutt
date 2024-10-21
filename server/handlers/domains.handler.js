const { Handler } = require("express");

const { CustomError, sanitize } = require("../utils");
const query = require("../queries");
const redis = require("../redis");
const env = require("../env");

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
  const domain = await query.domain.find({
    uuid: req.params.id,
    user_id: req.user.id
  });

  if (!domain) {
    throw new CustomError("Could not delete the domain.", 500);
  }
  
  const [updatedDomain] = await query.domain.update(
    { id: domain.id },
    { user_id: null }
  );

  if (!updatedDomain) {
    throw new CustomError("Could not delete the domain.", 500);
  }

  if (env.REDIS_ENABLED) {
    redis.remove.domain(updatedDomain);
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