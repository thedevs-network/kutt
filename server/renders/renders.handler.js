const utils = require("../utils");
const query = require("../queries")
const env = require("../env");

/**
 * @type {import("express").Handler}
 */
async function homepage(req, res) {
  res.render("homepage", {
    title: "Modern open source URL shortener",
  });
}

/**
 * @type {import("express").Handler}
 */
function login(req, res) {
  if (req.user) {
    return res.redirect("/");
  }
  res.render("login", {
    title: "Log in or sign up"
  });
}

/**
 * @type {import("express").Handler}
 */
function logout(req, res) {
  res.clearCookie("token", { httpOnly: true, secure: env.isProd });
  res.render("logout", {
    title: "Logging out.."
  });
}

/**
 * @type {import("express").Handler}
 */
function settings(req, res) {
  // TODO: make this a middelware function, apply it to where it's necessary
  if (!req.user) {
    return res.redirect("/");
  }
  res.render("settings", {
    title: "Settings"
  });
}


/**
 * @type {import("express").Handler}
 */
async function confirmLinkDelete(req, res) {
  const link = await query.link.find({
    uuid: req.query.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });
  await utils.sleep(500);
  if (!link) {
    return res.render("partials/links/dialog/message", {
      layout: false,
      message: "Could not find the link."
    });
  }
  res.render("partials/links/dialog/delete", {
    layout: false,
    link: utils.getShortURL(link.address, link.domain).link,
    id: link.uuid
  });
}

/**
 * @type {import("express").Handler}
 */
async function confirmLinkBan(req, res) {
  const link = await query.link.find({
    uuid: req.query.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });
  await utils.sleep(500);
  if (!link) {
    return res.render("partials/links/dialog/message", {
      message: "Could not find the link."
    });
  }
  res.render("partials/links/dialog/ban", {
    link: utils.getShortURL(link.address, link.domain).link,
    id: link.uuid
  });
}

/**
 * @type {import("express").Handler}
 */
async function addDomainForm(req, res) {
  await utils.sleep(1000);
  res.render("partials/settings/domain/add_form");
}

/**
 * @type {import("express").Handler}
 */
async function confirmDomainDelete(req, res) {
  const domain = await query.domain.find({
    uuid: req.query.id,
    user_id: req.user.id
  });
  await utils.sleep(500);
  if (!domain) {
    throw new utils.CustomError("Could not find the link", 400);
  }
  res.render("partials/settings/domain/delete", {
    ...utils.sanitize.domain(domain)
  });
}


/**
 * @type {import("express").Handler}
 */
async function linkEdit(req, res) {
  const link = await query.link.find({
    uuid: req.params.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });
  await utils.sleep(500);
  // TODO: handle when no link
  // if (!link) {
  //   return res.render("partials/links/dialog/message", {
  //     layout: false,
  //     message: "Could not find the link."
  //   });
  // }
  res.render("partials/links/edit", {
    ...utils.sanitize.link(link),
  });
}

module.exports = {
  addDomainForm,
  homepage,
  linkEdit,
  login,
  logout,
  confirmDomainDelete,
  confirmLinkBan,
  confirmLinkDelete,
  settings,
}