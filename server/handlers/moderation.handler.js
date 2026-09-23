const i18n = require("../i18n");
const knex = require("../knex");
const moderation = require("../moderation");
const { CustomError } = require("../utils");
const tables = { user: "users", domain: "domains", link: "links", host: "hosts" };

async function data(query) {
  const entity = query.entity || "user", page = query.page || "1";
  if (typeof entity !== "string" || !Object.hasOwn(tables, entity) || typeof page !== "string" || !/^[1-9]\d{0,5}$/.test(page)) {
    throw new CustomError(i18n.t("moderation.invalid_filter"), 400);
  }
  const limit = 25, offset = (Number(page) - 1) * limit;
  const bans = await knex(tables[entity]).where({ banned: true }).orderBy("id", "desc").offset(offset).limit(limit);
  const total = Number((await knex(tables[entity]).where({ banned: true }).count({ total: "id" }).first()).total);
  const events = await knex("moderation_events").orderBy("id", "desc").offset(offset).limit(limit);
  const eventTotal = Number((await knex("moderation_events").count({ total: "id" }).first()).total);
  return {
    entity, page: Number(page), total, event_total: eventTotal, limit,
    previous: Number(page) > 1 ? Number(page) - 1 : null,
    next: offset + limit < Math.max(total, eventTotal) ? Number(page) + 1 : null,
    bans: bans.map(row => ({ id: String(entity === "link" ? row.uuid : row.id), label: entity === "user" ? row.email : row.address, entity })),
    events: events.map(row => ({ ...row, created_at: new Date(Number(row.created_at)).toISOString() }))
  };
}
async function list(req, res) { res.json(await data(req.query)); }
async function page(req, res) {
  res.render("moderation", { ...await data(req.query), title: i18n.t("moderation.title"), custom_styles: [...(res.locals.custom_styles || []), "moderation.css"] });
}
async function confirm(req, res) {
  const { entity, id } = req.params;
  const match = moderation.identity(entity, id);
  const row = await knex(tables[entity]).where(match).first();
  if (!row) throw new CustomError(i18n.t("moderation.not_found"), 404);
  res.render("moderation_confirm", { title: i18n.t("moderation.remove"), entity, id, banned: !!row.banned,
    label: entity === "user" ? row.email : row.address,
    custom_styles: [...(res.locals.custom_styles || []), "moderation.css"] });
}
async function unban(req, res) {
  if (Object.keys(moderation.options(req)).length) throw new CustomError(i18n.t("moderation.extra_fields"), 400);
  await moderation.moderate(req.params.entity, req.params.id, false, req.user);
  if (req.isHTML) return res.redirect(303, "/admin/moderation?entity=" + req.params.entity);
  res.json({ message: i18n.t("moderation.removed") });
}
module.exports = { list, page, confirm, unban };
