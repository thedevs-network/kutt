const i18n = require("../i18n");
const { Handler } = require("express");

const { CustomError, sanitize } = require("../utils");
const query = require("../queries");
const redis = require("../redis");
const utils = require("../utils");
const env = require("../env");

async function add(req, res) {
  const address = req.body.address.toLowerCase(), homepage = req.body.homepage;
  const verification = require("../domain-verification");
  if (!await verification.verify(address, req.user, req.body.proof)) {
    const proof = verification.pending(address, req.user, req.body.proof) || verification.challenge(address, req.user);
    const message = i18n.t("messages.publish_this_dns_txt_record_then_verify_ownership_existing_domains_are");
    if (req.isHTML) return res.render("partials/settings/domain/add_form", { domain_verification: proof, verification_notice: message });
    return res.status(409).json({ error: message, verification: proof });
  }

  const domain = await query.domain.claim({
    address,
    homepage,
    user: req.user
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

async function addAdmin(req, res) {
  const { address, banned, homepage } = req.body;

  const domain = await require("../moderation").addDomain({ address, homepage, banned }, req.user);

  if (req.isHTML) {
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/add_domain_success", {
      address: domain.address,
    });
    return;
  }
  
  return res.status(200).send({ message: i18n.t("messages.the_domain_has_been_added_successfully") });
};

async function remove(req, res) {
  const domain = await query.domain.find({
    uuid: req.params.id,
    user_id: req.user.id
  });

  if (!domain) {
    throw new CustomError(i18n.t("messages.could_not_delete_the_domain"), 400);
  }
  
  const updatedDomain = await query.domain.release(domain.id, req.user.id, req.user);

  if (!updatedDomain) {
    throw new CustomError(i18n.t("messages.could_not_delete_the_domain"), 500);
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

  return res.status(200).send({ message: i18n.t("messages.domain_deleted_successfully") });
};

async function removeAdmin(req, res) {
  const id = req.params.id;
  const links = req.query.links;

  const domain = await query.domain.find({ id });

  if (!domain) {
    throw new CustomError(i18n.t("messages.could_not_find_the_domain"), 400);
  }

  await query.domain.remove(domain, { trashLinks: links === true, actor: req.user });

  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/delete_domain_success", {
      address: domain.address,
    });
    return;
  }

  return res.status(200).send({ message: i18n.t("messages.domain_deleted_successfully") });
}

async function getAdmin(req, res) {
  const { limit, skip } = req.context;
  const search = req.query.search;
  const user = req.query.user;
  const banned = utils.parseBooleanQuery(req.query.banned);
  const owner = utils.parseBooleanQuery(req.query.owner);
  const links = utils.parseBooleanQuery(req.query.links);

  const match = {
    ...(banned !== undefined && { banned }),
    ...(owner !== undefined && { user_id: [owner ? "is not" : "is", null] }),
  };

  const [data, total] = await Promise.all([
    query.domain.getAdmin(match, { limit, search, user, links, skip, ...require("../list-sort").parse(req.query, "domains") }),
    query.domain.totalAdmin(match, { search, user, links })
  ]);

  const domains = data.map(utils.sanitize.domain_admin);

  if (req.isHTML) {
    res.render("partials/admin/domains/table", {
      total,
      total_formatted: i18n.number(total),
      limit,
      skip,
      table_domains: domains,
    })
    return;
  }

  return res.send({
    total,
    limit,
    skip,
    data: domains,
  });
}

async function ban(req, res) {
  const moderation = require("../moderation");
  const domain = await moderation.moderate("domain", req.params.id, true, req.user, moderation.options(req));

  // Send the response only after the complete transaction commits.
  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/ban_domain_success", {
      address: domain.address,
    });
    return;
  }

  return res.status(200).send({ message: i18n.t("messages.banned_domain_successfully") });
}

module.exports = {
  add,
  addAdmin,
  ban,
  getAdmin,
  remove,
  removeAdmin,
}
