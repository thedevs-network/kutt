const i18n = require("../i18n");
const health = require("../link-health");
const history = require("../link-history");
const knex = require("../knex");
const { getShortURL } = require("../utils");
const { boundary } = require("./routing.handler");
async function get(req, res) { res.json(await health.get(req)); }
async function save(req, res) { res.json(await health.save(req)); }
async function queue(req, res) { res.status(202).json(await health.queue(req)); }
async function list(req, res) { res.json(await health.list(req)); }
async function page(req, res) {
  const link = await health.owned(req);
  res.render("link-health", { title: i18n.t("ui.destination_health"), id: link.uuid,
    short_url: getShortURL(link.address, await history.domainName(knex, link)).url,
    custom_styles: [...(res.locals.custom_styles || []), "link-health.css"] });
}
async function dashboard(req, res) {
  res.render("health-dashboard", { title: i18n.t("ui.destination_monitoring"), custom_styles: [...(res.locals.custom_styles || []), "link-health.css"] });
}
module.exports = { boundary, get, save, queue, list, page, dashboard };
