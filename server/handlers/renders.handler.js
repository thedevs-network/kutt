const utils = require("../utils");
const query = require("../queries")
const env = require("../env");

async function homepage(req, res) {
  res.render("homepage", {
    title: "Modern open source URL shortener",
  });
}

function login(req, res) {
  if (req.user) {
    return res.redirect("/");
  }
  res.render("login", {
    title: "Log in or sign up"
  });
}

function logout(req, res) {
  res.clearCookie("token", { httpOnly: true, secure: env.isProd });
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
  // TODO: make this a middelware function, apply it to where it's necessary
  if (!req.user) {
    return res.redirect("/");
  }
  res.render("settings", {
    title: "Settings"
  });
}

function stats(req, res) {
  // TODO: make this a middelware function, apply it to where it's necessary
  if (!req.user) {
    return res.redirect("/");
  }
  const id = req.query.id;
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

async function addDomainForm(req, res) {
  res.render("partials/settings/domain/add_form");
}

async function confirmDomainDelete(req, res) {
  const domain = await query.domain.find({
    uuid: req.query.id,
    user_id: req.user.id
  });
  if (!domain) {
    throw new utils.CustomError("Could not find the link", 400);
  }
  res.render("partials/settings/domain/delete", {
    ...utils.sanitize.domain(domain)
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


async function linkEdit(req, res) {
  const link = await query.link.find({
    uuid: req.params.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });
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
  banned,
  confirmDomainDelete,
  confirmLinkBan,
  confirmLinkDelete,
  getReportEmail,
  homepage,
  linkEdit,
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