const query = require("../queries");
const utils = require("../utils");
const env = require("../env");

async function homepage(req, res) {
  res.render("homepage", {
    title: "Modern open source URL shortener",
  });
}

function login(req, res) {
  if (req.user) {
    res.redirect("/");
    return;
  }
  res.render("login", {
    title: "Log in or sign up"
  });
}

function logout(req, res) {
  utils.deleteCurrentToken(res);
  res.render("logout", {
    title: "Logging out.."
  });
}

function notFound(req, res) {
  res.render("404", {
    title: "404 - Not found"
  });
}

function settings(req, res) {
  res.render("settings", {
    title: "Settings"
  });
}

function admin(req, res) {
  res.render("admin", {
    title: "Admin"
  });
}

function stats(req, res) {
  res.render("stats", {
    title: "Stats"
  });
}

async function banned(req, res) {
  res.render("banned", {
    title: "Banned link",
  });
}

async function report(req, res) {
  res.render("report", {
    title: "Report abuse",
  });
}

async function resetPassword(req, res) {
  res.render("reset_password", {
    title: "Reset password",
  });
}

async function resetPasswordResult(req, res) {
  res.render("reset_password_result", {
    title: "Reset password",
  });
}

async function verifyChangeEmail(req, res) {
  res.render("verify_change_email", {
    title: "Verifying email",
  });
}

async function verify(req, res) {
  res.render("verify", {
    title: "Verify",
  });
}

async function terms(req, res) {
  res.render("terms", {
    title: "Terms of Service",
  });
}

async function confirmLinkDelete(req, res) {
  const link = await query.link.find({
    uuid: req.query.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });
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

async function confirmLinkBan(req, res) {
  const link = await query.link.find({
    uuid: req.query.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });
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

async function confirmUserDelete(req, res) {
  const user = await query.user.find({ id: req.query.id });
  if (!user) {
    return res.render("partials/admin/dialog/message", {
      layout: false,
      message: "Could not find the user."
    });
  }
  res.render("partials/admin/dialog/delete_user", {
    layout: false,
    email: user.email,
    id: user.id
  });
}

async function confirmUserBan(req, res) {
  const user = await query.user.find({ id: req.query.id });
  if (!user) {
    return res.render("partials/admin/dialog/message", {
      layout: false,
      message: "Could not find the user."
    });
  }
  res.render("partials/admin/dialog/ban_user", {
    layout: false,
    email: user.email,
    id: user.id
  });
}

async function createUser(req, res) {
  res.render("partials/admin/dialog/create_user", {
    layout: false,
  });
}

async function addDomainAdmin(req, res) {
  res.render("partials/admin/dialog/add_domain", {
    layout: false,
  });
}

async function addDomainForm(req, res) {
  res.render("partials/settings/domain/add_form");
}

async function confirmDomainDelete(req, res) {
  const domain = await query.domain.find({
    uuid: req.query.id,
    user_id: req.user.id
  });
  if (!domain) {
    throw new utils.CustomError("Could not find the domain.", 400);
  }
  res.render("partials/settings/domain/delete", {
    ...utils.sanitize.domain(domain)
  });
}

async function confirmDomainBan(req, res) {
  const domain = await query.domain.find({
    id: req.query.id
  });
  if (!domain) {
    throw new utils.CustomError("Could not find the domain.", 400);
  }
  const hasUser = !!domain.user_id;
  const hasLink = await query.link.find({ domain_id: domain.id });
  res.render("partials/admin/dialog/ban_domain", {
    id: domain.id,
    address: domain.address,
    hasUser,
    hasLink,
  });
}

async function confirmDomainDeleteAdmin(req, res) {
  const domain = await query.domain.find({
    id: req.query.id
  });
  if (!domain) {
    throw new utils.CustomError("Could not find the domain.", 400);
  }
  const hasLink = await query.link.find({ domain_id: domain.id });
  res.render("partials/admin/dialog/delete_domain", {
    id: domain.id,
    address: domain.address,
    hasLink,
  });
}

async function getReportEmail(req, res) {
  if (!env.REPORT_EMAIL) {
    throw new utils.CustomError("No report email is available.", 400);
  }
  res.render("partials/report/email", {
    report_email: env.REPORT_EMAIL.replace("@", "[at]")
  });
}

async function getSupportEmail(req, res) {
  if (!env.CONTACT_EMAIL) {
    throw new utils.CustomError("No support email is available.", 400);
  }
  await utils.sleep(500);
  res.render("partials/support_email", {
    email: env.CONTACT_EMAIL,
  });
}

async function linkEdit(req, res) {
  const link = await query.link.find({
    uuid: req.params.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });
  res.render("partials/links/edit", {
    ...(link && utils.sanitize.link(link)),
  });
}

async function linkEditAdmin(req, res) {
  const link = await query.link.find({
    uuid: req.params.id,
  });
  res.render("partials/admin/links/edit", {
    ...(link && utils.sanitize.link(link)),
  });
}

module.exports = {
  addDomainAdmin,
  addDomainForm,
  admin,
  banned,
  confirmDomainBan,
  confirmDomainDelete,
  confirmDomainDeleteAdmin,
  confirmLinkBan,
  confirmLinkDelete,
  confirmUserBan,
  confirmUserDelete,
  createUser,
  getReportEmail,
  getSupportEmail,
  homepage,
  linkEdit,
  linkEditAdmin,
  login,
  logout,
  notFound,
  report,
  resetPassword,
  resetPasswordResult,
  settings,
  stats,
  terms,
  verifyChangeEmail,
  verify,
}