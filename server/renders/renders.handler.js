const utils = require("../utils");
const query = require("../queries")
const env = require("../env");

/**
 * @type {import("express").Handler}
 */
async function homepage(req, res) {
  const user = req.user;

  const default_domain = env.DEFAULT_DOMAIN;
  const domains = user && await query.domain.get({ user_id: user.id });

  res.render("homepage", {
    title: "Modern open source URL shortener",
    user,
    domains,
    default_domain,
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
async function confirmLinkDelete(req, res) {
  const link = await query.link.find({
    uuid: req.query.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });
  await utils.sleep(500);
  if (!link) {
    return res.render("partials/links/dialog_message", {
      layout: false,
      message: "Could not find the link."
    });
  }
  res.render("partials/links/dialog_delete", {
    layout: false,
    link: utils.getShortURL(link.address, link.domain).link,
    id: link.uuid
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
  console.log(utils.sanitize.link(link));
  await utils.sleep(500);
  // TODO: handle when no link
  // if (!link) {
  //   return res.render("partials/links/dialog_message", {
  //     layout: false,
  //     message: "Could not find the link."
  //   });
  // }
  res.render("partials/links/edit", {
    layout: false,
    ...utils.sanitize.link(link),
  });
}

module.exports = {
  homepage,
  linkEdit,
  login,
  logout,
  confirmLinkDelete,
}