const i18n = require("../i18n");
const query = require("../queries");
const utils = require("../utils");
const env = require("../env");

/** 
*
* PAGES
*
**/

async function homepage(req, res) {
  if (env.DISALLOW_ANONYMOUS_LINKS && !req.user) {
    res.redirect("/login");
    return;
  }
  res.render("homepage", {
    title: i18n.t("messages.free_modern_url_shortener"),
  });
}

async function login(req, res) {
  if (req.user) {
    res.redirect("/");
    return;
  }
  
  res.render("login", {
    title: res.locals.login_title
  });
}

function logout(req, res) {
  utils.deleteCurrentToken(res);
  res.set("Cache-Control", "no-store");
  // Replacing the body with another complete layout re-executes its scripts.
  if (req.get("HX-Request") === "true") return res.set("HX-Redirect", "/").status(204).end();
  return res.redirect(303, "/");
}

async function createAdmin(req, res) {
  const isThereAUser = await query.user.findAny();
  if (isThereAUser) {
    res.redirect("/login");
    return;
  }
  res.render("create_admin", {
    title: i18n.t("ui.create_admin_account")
  });
}

function notFound(req, res) {
  res.status(404).render("404", {
    title: i18n.t("messages.404_not_found")
  });
}

async function settings(req, res) {
  res.set("Cache-Control", "no-store");
  await require("./tokens.handler").load(req, res, () => {});
  res.render("settings", {
    title: i18n.t("ui.settings")
  });
}

function admin(req, res) {
  res.render("admin", {
    title: i18n.t("ui.admin")
  });
}

function stats(req, res) {
  res.render("stats", {
    title: i18n.t("messages.stats"),
    stats_id: typeof req.query.id === "string" ? req.query.id : ""
  });
}

async function banned(req, res) {
  res.render("banned", {
    title: i18n.t("messages.banned_link"),
  });
}

async function report(req, res) {
  if (!env.REPORT_EMAIL) {
    res.redirect("/");
    return;
  }
  res.render("report", {
    title: i18n.t("ui.report_abuse"),
  });
}

async function resetPassword(req, res) {
  res.render("reset_password", {
    title: i18n.t("ui.reset_password"),
  });
}

async function resetPasswordSetNewPassword(req, res) {
  const reset_password_token = req.params.resetPasswordToken;
  
  if (reset_password_token) {
    const user = await query.user.find(
      {
        reset_password_token,
        reset_password_expires: [">", utils.dateToUTC(new Date())]
      }
    );
    if (user) {
      res.locals.token_verified = true;
    }
  }

  
  res.render("reset_password_set_new_password", {
    title: i18n.t("ui.reset_password"),
    ...(res.locals.token_verified && { reset_password_token }),
  });
}

async function verifyChangeEmail(req, res) {
  res.render("verify_change_email", {
    title: i18n.t("messages.verifying_email"),
  });
}

async function verify(req, res) {
  res.render("verify", {
    title: i18n.t("messages.verify"),
  });
}

async function terms(req, res) {
  res.render("terms", {
    title: i18n.t("ui.terms_of_service"),
  });
}

/**
*
* PARTIALS
*
**/

async function confirmLinkDelete(req, res) {
  const link = await query.link.find({
    uuid: req.query.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });
  if (!link) {
    return res.render("partials/links/dialog/message", {
      layout: false,
      message: i18n.t("messages.could_not_find_the_link")
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
      message: i18n.t("messages.could_not_find_the_link")
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
      message: i18n.t("messages.could_not_find_the_user")
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
      message: i18n.t("messages.could_not_find_the_user")
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
    throw new utils.CustomError(i18n.t("messages.could_not_find_the_domain"), 400);
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
    throw new utils.CustomError(i18n.t("messages.could_not_find_the_domain"), 400);
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
    throw new utils.CustomError(i18n.t("messages.could_not_find_the_domain"), 400);
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
    throw new utils.CustomError(i18n.t("messages.no_report_email_is_available"), 400);
  }
  res.render("partials/report/email", {
    report_email_address: env.REPORT_EMAIL.replace("@", "[at]")
  });
}

async function getSupportEmail(req, res) {
  if (!env.CONTACT_EMAIL) {
    throw new utils.CustomError(i18n.t("messages.no_support_email_is_available"), 400);
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
    ...(link && utils.sanitize.link_html(link)),
    domain: link.domain || env.DEFAULT_DOMAIN,
  });
}

async function linkEditAdmin(req, res) {
  res.render("partials/admin/links/edit", {
    ...await require("../link-admin-edit").view(req.params.id),
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
  createAdmin,
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
  resetPasswordSetNewPassword,
  settings,
  stats,
  terms,
  verifyChangeEmail,
  verify,
}
