const i18n = require("../i18n");
const bcrypt = require("bcryptjs");

const query = require("../queries");
const utils = require("../utils");
const mail = require("../mail");
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
    utils.deleteCurrentToken(res);
    res.setHeader("HX-Trigger-After-Swap", "redirectToHomepage");
    res.render("partials/settings/delete_account", {
      success: i18n.t("messages.account_has_been_deleted_logging_out")
    });
    return;
  }
  
  return res.status(200).send("OK");
};

async function removeByAdmin(req, res) {
  const user = await query.user.find({ id: req.params.id });

  if (!user) {
    const message = i18n.t("messages.could_not_find_the_user");
    if (req.isHTML) {
      return res.render("partials/admin/dialog/message", {
        layout: false,
        message
      });
    } else {
      return res.status(400).send({ message });
    }
  }
  
  await query.user.remove(user, req.user, true);

  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/delete_user_success", {
      email: user.email,
    });
    return;
  }
  
  return res.status(200).send({ message: i18n.t("messages.user_has_been_deleted_successfully") });
};

async function getAdmin(req, res) {
  const { limit, skip, all } = req.context;
  const { role, search } = req.query;
  const userId = req.user.id;
  const verified = utils.parseBooleanQuery(req.query.verified);
  const banned = utils.parseBooleanQuery(req.query.banned);
  const domains = utils.parseBooleanQuery(req.query.domains);
  const links = utils.parseBooleanQuery(req.query.links);

  const match = {
    ...(role && { role }),
    ...(verified !== undefined && { verified }),
    ...(banned !== undefined && { banned }),
  };

  const [data, total] = await Promise.all([
    query.user.getAdmin(match, { limit, search, domains, links, skip, ...require("../list-sort").parse(req.query, "users") }),
    query.user.totalAdmin(match, { search, domains, links })
  ]);

  const users = data.map(utils.sanitize.user_admin);
    
  if (req.isHTML) {
    res.render("partials/admin/users/table", {
      total,
      total_formatted: i18n.number(total),
      limit,
      skip,
      users,
    })
    return;
  }

  return res.send({
    total,
    limit,
    skip,
    data: users,
  });
};

async function ban(req, res) {
  const moderation = require("../moderation");
  const user = await moderation.moderate("user", req.params.id, true, req.user, moderation.options(req));

  // Send the response only after the complete transaction commits.
  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/ban_user_success", {
      email: user.email,
    });
    return;
  }

  return res.status(200).send({ message: i18n.t("messages.banned_user_successfully") });
}

async function create(req, res) {
  const salt = await bcrypt.genSalt(12);
  req.body.password = await bcrypt.hash(req.body.password, salt);

  const user = await query.user.create(req.body, req.user);

  if (req.body.verification_email && !user.banned && !user.verified) {
    await mail.verification(user);
  }

  if (req.isHTML) {
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/create_user_success", {
      email: user.email,
    });
    return;
  }

  return res.status(201).send({ message: i18n.t("messages.the_user_has_been_created_successfully") });
}

module.exports = {
  ban,
  create,
  get,
  getAdmin,
  remove,
  removeByAdmin,
}
