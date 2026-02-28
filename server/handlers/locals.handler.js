const query = require("../queries");
const utils = require("../utils");
const env = require("../env");

function isHTML(req, res, next) {
  const accepts = req.accepts(["json", "html"]);
  req.isHTML = accepts === "html";
  next();
}

function noLayout(req, res, next) {
  res.locals.layout = null;
  next();
}

function viewTemplate(template) {
  return function (req, res, next) {
    req.viewTemplate = template;
    next();
  }
}

function config(req, res, next) {
  res.locals.default_domain = env.DEFAULT_DOMAIN;
  res.locals.admin_domain = utils.getAdminDomain();
  res.locals.site_name = env.SITE_NAME;
  res.locals.contact_email = env.CONTACT_EMAIL;
  res.locals.server_ip_address = env.SERVER_IP_ADDRESS;
  res.locals.server_cname_address = env.SERVER_CNAME_ADDRESS;
  res.locals.disallow_registration = env.DISALLOW_REGISTRATION;
  res.locals.disallow_login_form = env.DISALLOW_LOGIN_FORM;
  res.locals.login_disabled = env.DISALLOW_LOGIN_FORM && !env.OIDC_ENABLED;
  res.locals.oidc_enabled = env.OIDC_ENABLED;
  res.locals.mail_enabled = env.MAIL_ENABLED;
  res.locals.report_email = env.REPORT_EMAIL;
  res.locals.custom_styles = utils.getCustomCSSFileNames();
  next();
}

async function user(req, res, next) {
  const user = req.user;
  let userDomains = [];
  if (user) {
    userDomains = await query.domain.get({ user_id: user.id });
    userDomains = userDomains.map(utils.sanitize.domain);
  }

  const defaultDomain = env.DEFAULT_DOMAIN;
  const globalDomainRecords = await query.domain.get({ is_global: true });
  const globalDomains = globalDomainRecords.map(d => d.address).filter(d => d !== defaultDomain);

  const filteredUserDomains = userDomains.filter(
    d => d.address !== defaultDomain && !globalDomains.includes(d.address)
  );

  res.locals.default_domain = defaultDomain;
  res.locals.other_global_domains = globalDomains;
  res.locals.user_domains = filteredUserDomains;
  res.locals.user = user;
  next();
}

function newPassword(req, res, next) {
  res.locals.reset_password_token = req.body.reset_password_token;
  next();
}

function createLink(req, res, next) {
  res.locals.show_advanced = !!req.body.show_advanced;
  next();
}

function editLink(req, res, next) {
  res.locals.id = req.params.id;
  res.locals.class = "no-animation";
  next();
}

function protected(req, res, next) {
  res.locals.id = req.params.id;
  next();
}

function adminTable(req, res, next) {
  res.locals.query = {
    anonymous: req.query.anonymous,
    domain: req.query.domain,
    domains: req.query.domains,
    links: req.query.links,
    role: req.query.role,
    search: req.query.search,
    user: req.query.user,
    verified: req.query.verified,
  };
  next();
}

module.exports = {
  adminTable,
  config,
  createLink,
  editLink,
  isHTML,
  newPassword,
  noLayout,
  protected,
  user,
  viewTemplate,
}
