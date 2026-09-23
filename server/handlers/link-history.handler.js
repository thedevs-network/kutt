const i18n = require("../i18n");
const knex = require("../knex");
const query = require("../queries");
const history = require("../link-history");
const redis = require("../redis");
const env = require("../env");
const { CustomError, sanitize } = require("../utils");

function sameOrigin(req) {
  require("../management-origin").sameOrigin(req);
}

function page(req) {
  const number = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (typeof value !== "string" || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
      throw new CustomError(i18n.t("messages.invalid_pagination"), 400);
    }
    return Number(value);
  };
  return { limit: Math.max(1, number(req.query.limit, 25, 50)), skip: number(req.query.skip, 0, 1000000) };
}

async function trash(req, res) {
  res.set("Cache-Control", "no-store");
  const { limit, skip } = page(req);
  const sorting = require("../list-sort").parse(req.query);
  const pageURL = offset => "/settings/trash?" + new URLSearchParams({ ...sorting, skip: offset, limit });
  const match = { user_id: req.user.id,
    ...(req.apiTokenDomain !== undefined && { domain_id: req.apiTokenDomain, archived_domain: null }) };
  const [links, total] = await Promise.all([
    query.link.get(match, { limit, skip, trash: true, ...sorting }), query.link.total(match, { trash: true })
  ]);
  if (!req.isHTML) return res.json({ total, limit, skip, data: links.map(sanitize.link) });
  return res.render("trash", { title: i18n.t("ui.trash"), links: links.map(sanitize.link_html), total, sorting, limit,
    previous: skip > 0 ? pageURL(Math.max(0, skip - limit)) : null,
    next: skip + limit < total ? pageURL(skip + limit) : null });
}

async function list(req, res) {
  res.set("Cache-Control", "no-store");
  const link = await query.link.find({ uuid: req.params.id, user_id: req.user.id }, { fresh: true, includeTrash: true });
  if (!link) throw new CustomError(i18n.t("messages.link_was_not_found"), 404);
  const { limit, skip } = page(req);
  const match = { link_id: link.id };
  const rows = await knex("link_history").where(match).orderBy("id", "desc").offset(skip).limit(limit);
  const { count } = await knex("link_history").where(match).count("* as count").first();
  const data = rows.map(row => ({
    id: row.id, action: row.action, fields: JSON.parse(row.fields),
    actor: row.actor_id === req.user.id ? i18n.t("messages.you") : row.actor_id ? i18n.t("messages.administrator") : i18n.t("messages.system_or_deleted_account"),
    source: row.source, created_at: new Date(Number(row.created_at)).toISOString()
  }));
  if (!req.isHTML) return res.json({ total: Number(count), limit, skip, data });
  return res.render("link_history", { title: i18n.t("ui.link_history"), link: sanitize.link_html(link),
    entries: data.map(row => ({ ...row, changed: row.fields.map(field => i18n.label("field", field)).join(", ") })),
    previous: skip > 0 ? `/link/history/${link.uuid}?skip=${Math.max(0, skip - limit)}&limit=${limit}` : null,
    next: skip + limit < Number(count) ? `/link/history/${link.uuid}?skip=${skip + limit}&limit=${limit}` : null });
}

async function restore(req, res) {
  sameOrigin(req);
  res.set("Cache-Control", "no-store");
  res.locals.id = req.params.id;
  const old = await history.restore(req.params.id, req.user.id, { id: req.user.id, apiToken: req.apiToken }, req.apiTokenDomain, req);
  if (env.REDIS_ENABLED) redis.remove.link(old);
  const link = await query.link.find({ uuid: req.params.id, user_id: req.user.id }, { fresh: true });
  if (!req.isHTML) return res.json(sanitize.link(link));
  return res.render("partials/links/trash_item", { ...sanitize.link_html(link), restored: true });
}

module.exports = { sameOrigin, trash, list, restore };
