const i18n = require("../i18n");
const routing = require("../link-routing");
const { sameOrigin } = require("./link-history.handler");
const { getShortURL, CustomError } = require("../utils");
const history = require("../link-history");
const knex = require("../knex");
function boundary(req, res, next) {
  res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "same-origin" });
  if (!["GET", "HEAD"].includes(req.method)) sameOrigin(req);
  next();
}
async function get(req, res) {
  const link = await routing.owned(req);
  res.json({ ...await routing.policy(link.id), fallback: link.target });
}
async function save(req, res) { res.json(await routing.save(req)); }
async function preview(req, res) {
  const link = await routing.owned(req);
  if (!req.body || Object.keys(req.body).some(key => !["rules", "context"].includes(key))) throw new CustomError(i18n.t("messages.invalid_preview_field"), 400);
  const rules = req.body.rules === undefined ? (await routing.policy(link.id)).rules : routing.normalize(req.body.rules);
  const selected = routing.choose(rules, routing.previewContext(req.body.context), link.target);
  require("../destination-policy").requireAllowed(selected.target);
  res.json({ ...selected, preview: true });
}
async function page(req, res) {
  const link = await routing.owned(req);
  const domain = await history.domainName(knex, link);
  res.render("routing", { title: i18n.t("ui.redirect_rules"), id: link.uuid, short_url: getShortURL(link.address, domain).url, target: link.target });
}
module.exports = { boundary, get, save, preview, page };
