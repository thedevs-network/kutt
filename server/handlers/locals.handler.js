const query = require("../queries");
const utils = require("../utils");
const env = require("../env");

function isHTML(req, res, next) {
  const accepts = req.accepts(["json", "html"]);
  req.isHTML = accepts === "html";
  next();
}

function addNoLayoutLocals(req, res, next) {
  res.locals.layout = null;
  next();
}

function viewTemplate(template) {
  return function (req, res, next) {
    req.viewTemplate = template;
    next();
  }
}

function addConfigLocals(req, res, next) {
  res.locals.default_domain = env.DEFAULT_DOMAIN;
  res.locals.site_name = env.SITE_NAME;
  next();
}

async function addUserLocals(req, res, next) {
  const user = req.user;
  res.locals.user = user;
  res.locals.domains = user && (await query.domain.get({ user_id: user.id })).map(utils.sanitize.domain);
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

module.exports = {
  addConfigLocals,
  addNoLayoutLocals,
  addUserLocals,
  createLink,
  editLink,
  isHTML,
  protected,
  viewTemplate,
}