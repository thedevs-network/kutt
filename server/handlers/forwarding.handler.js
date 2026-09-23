const i18n = require("../i18n");
const forwarding = require("../link-forwarding");
const routing = require("../link-routing");
const { CustomError, getShortURL } = require("../utils");
const history = require("../link-history");
const knex = require("../knex");
const { boundary } = require("./routing.handler");
async function get(req, res) {
  const link = await routing.owned(req);
  res.json({ ...await forwarding.policy(link.id), fallback: link.target });
}
async function save(req, res) { res.json(await forwarding.save(req)); }
async function preview(req, res) {
  const link = await routing.owned(req), body = req.body;
  if (!body || Array.isArray(body) || Object.keys(body).some(key => !["policy", "context", "path"].includes(key))) throw new CustomError(i18n.t("messages.invalid_preview_field"), 400);
  const config = body.policy === undefined ? await forwarding.policy(link.id) : forwarding.normalize(body.policy);
  const context = routing.previewContext(body.context || {});
  const result = routing.choose((await routing.policy(link.id)).rules, context, link.target);
  res.json({ ...result, target: forwarding.apply(config, result.target, context.query, body.path ?? ""), preview: true });
}
async function page(req, res) {
  const link = await routing.owned(req);
  res.render("forwarding", { title: i18n.t("ui.path_and_query_forwarding"), id: link.uuid,
    short_url: getShortURL(link.address, await history.domainName(knex, link)).url, target: link.target,
    custom_styles: [...(res.locals.custom_styles || []), "forwarding.css"] });
}
module.exports = { boundary, get, save, preview, page };
