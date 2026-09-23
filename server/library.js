const i18n = require("./i18n");
const { randomUUID } = require("node:crypto");
const knex = require("./knex");
const history = require("./link-history");
const redis = require("./redis");
const env = require("./env");
const { CustomError, sanitize } = require("./utils");

const fail = (message, status = 400) => { throw new CustomError(message, status); };
const uuid = value => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
const kinds = ["tag", "collection"];
const publicLabel = row => ({ id: row.id, name: row.name, kind: row.kind });
const publicFilter = row => ({ id: row.id, name: row.name, filters: parseFilters(JSON.parse(row.filters)) });

function nameFields(input) {
  if (typeof input !== "string") fail(i18n.t("messages.a_name_is_required"));
  const name = input.normalize("NFKC").trim();
  if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) fail(i18n.t("messages.name_must_be_1_to_80_printable_characters"));
  return { name, name_key: name.toLowerCase() };
}

function parseFilters(input = {}) {
  const result = { q: "", tag: "", collection: "", state: "active" };
  if (!input || typeof input !== "object" || Array.isArray(input)) fail(i18n.t("messages.invalid_filters"));
  for (const key of Object.keys(result)) {
    if (input[key] === undefined || input[key] === "") continue;
    if (typeof input[key] !== "string") fail(i18n.t("messages.invalid_filter_value"));
    result[key] = input[key];
  }
  result.q = result.q.trim();
  if (result.q.length > 200 || /[\u0000-\u001f]/.test(result.q)) fail(i18n.t("messages.search_is_too_long_or_invalid"));
  if (!['active', 'paused', 'unpaused', 'trash'].includes(result.state)) fail(i18n.t("messages.invalid_link_state"));
  for (const key of kinds) if (result[key] && !uuid(result[key])) fail(i18n.t("messages.invalid_label"));
  Object.assign(result, require("./list-sort").parse(input));
  return result;
}

async function validateLabels(db, userId, filters) {
  for (const kind of kinds) {
    if (filters[kind] && !await db("library_labels").where({ id: filters[kind], kind, user_id: userId }).first()) {
      fail(i18n.t("messages.label_was_not_found"), 404);
    }
  }
}

function owned(db, userId, domainId) {
  const query = db("links").where({ "links.user_id": userId });
  if (domainId !== undefined) query.where({ "links.domain_id": domainId }).whereNull("links.archived_domain");
  return query;
}

async function list(userId, input, domainId) {
  let filters = parseFilters(input);
  if (input.saved) {
    if (!uuid(input.saved)) fail(i18n.t("messages.invalid_saved_filter"));
    if (domainId !== undefined) fail(i18n.t("messages.saved_filters_require_an_unrestricted_domain_scope"), 403);
    const saved = await knex("library_filters").where({ id: input.saved, user_id: userId }).first();
    if (!saved) fail(i18n.t("messages.saved_filter_was_not_found"), 404);
    filters = parseFilters(JSON.parse(saved.filters));
  }
  await validateLabels(knex, userId, filters);
  const page = input.page === undefined ? 1 : Number(input.page);
  if (typeof input.page === "object" || !Number.isSafeInteger(page) || page < 1 || page > 100000) fail(i18n.t("messages.invalid_page"));
  const limit = 50;
  const query = owned(knex, userId, domainId);
  filters.state === "trash" ? query.whereNotNull("links.deleted_at") : query.whereNull("links.deleted_at");
  if (filters.state === "paused") query.where({ "links.paused": true });
  if (filters.state === "unpaused") query.where({ "links.paused": false });
  if (filters.q) {
    const pattern = "%" + filters.q.toLowerCase().replace(/[!%_]/g, "!$&") + "%";
    query.where(function () {
      for (const field of ["address", "target", "description"]) this.orWhereRaw(`LOWER(links.${field}) LIKE ? ESCAPE '!'`, [pattern]);
    });
  }
  for (const kind of kinds) if (filters[kind]) {
    query.whereIn("links.id", knex("library_link_labels").select("link_id").where({ label_id: filters[kind] }));
  }
  const { n } = await query.clone().count("* as n").first();
  const rows = query.clone().leftJoin("domains", "domains.id", "links.domain_id")
    .select("links.*", knex.raw("coalesce(domains.address, links.archived_domain) as domain"))
    .offset((page - 1) * limit).limit(limit);
  const links = await require("./list-sort").apply(rows, filters);
  const assigned = links.length ? await knex("library_link_labels as rel")
    .join("library_labels as label", "label.id", "rel.label_id")
    .where("label.user_id", userId).whereIn("rel.link_id", links.map(row => row.id))
    .select("rel.link_id", "label.id", "label.name", "label.kind") : [];
  // Labels and filters are private account metadata, not shared via domain-limited tokens.
  const labels = domainId === undefined ? await knex("library_labels").where({ user_id: userId }).orderBy("name_key") : [];
  const saved = domainId === undefined ? await knex("library_filters").where({ user_id: userId }).orderBy("name_key") : [];
  return { filters, page, limit, total: Number(n), labels: labels.map(publicLabel), saved_filters: saved.map(publicFilter),
    data: links.map(row => ({ ...sanitize.link(row), labels: assigned.filter(label => label.link_id === row.id).map(publicLabel) })) };
}

async function saveLabel(userId, input, id) {
  if (!kinds.includes(input.kind)) fail(i18n.t("messages.select_tag_or_collection"));
  const fields = nameFields(input.name);
  return knex.transaction(async db => {
    if (id && !await db("library_labels").where({ id, user_id: userId, kind: input.kind }).first()) fail(i18n.t("messages.label_was_not_found"), 404);
    const duplicate = await db("library_labels").where({ user_id: userId, kind: input.kind, name_key: fields.name_key }).first();
    if (duplicate && duplicate.id !== id) fail(i18n.t("messages.a_label_with_this_name_already_exists"), 409);
    if (!id) {
      const { n } = await db("library_labels").where({ user_id: userId, kind: input.kind }).count("* as n").first();
      if (Number(n) >= 100) fail(i18n.t("messages.limit_of_100_labels_per_kind_reached"), 409);
    }
    const row = { id: id || randomUUID(), user_id: userId, kind: input.kind, ...fields };
    if (id) await db("library_labels").where({ id, user_id: userId }).update(fields);
    else await db("library_labels").insert(row);
    return publicLabel(row);
  });
}

async function removeLabel(userId, id) {
  return knex.transaction(async db => {
    const label = await db("library_labels").where({ id, user_id: userId }).first();
    if (!label) fail(i18n.t("messages.label_was_not_found"), 404);
    // Do not silently widen a saved filter when its referenced label is removed.
    const filters = await db("library_filters").where({ user_id: userId });
    if (filters.some(row => Object.values(JSON.parse(row.filters)).includes(id))) fail(i18n.t("messages.this_label_is_used_by_a_saved_filter_update_or_remove"), 409);
    await db("library_labels").where({ id, user_id: userId }).delete();
  });
}

async function saveFilter(userId, input, id) {
  const fields = nameFields(input.name), filters = parseFilters(input.filters);
  return knex.transaction(async db => {
    await validateLabels(db, userId, filters);
    if (id && !await db("library_filters").where({ id, user_id: userId }).first()) fail(i18n.t("messages.saved_filter_was_not_found"), 404);
    const duplicate = await db("library_filters").where({ user_id: userId, name_key: fields.name_key }).first();
    if (duplicate && duplicate.id !== id) fail(i18n.t("messages.a_filter_with_this_name_already_exists"), 409);
    const { n } = await db("library_filters").where({ user_id: userId }).count("* as n").first();
    if (!id && Number(n) >= 50) fail(i18n.t("messages.limit_of_50_saved_filters_reached"), 409);
    const row = { id: id || randomUUID(), user_id: userId, ...fields, filters: JSON.stringify(filters) };
    if (id) await db("library_filters").where({ id, user_id: userId }).update(row);
    else await db("library_filters").insert(row);
    return publicFilter(row);
  });
}

async function removeFilter(userId, id) {
  if (!await knex("library_filters").where({ id, user_id: userId }).delete()) fail(i18n.t("messages.saved_filter_was_not_found"), 404);
}

async function bulk(userId, input, actor, domainId, request) {
  const { action, label_id: labelId } = input;
  const ids = typeof input.ids === "string" ? [input.ids] : input.ids;
  if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => !uuid(id)) || new Set(ids).size !== ids.length) fail(i18n.t("messages.select_1_to_100_distinct_links"));
  if (!["add_label", "remove_label", "pause", "resume", "trash"].includes(action)) fail(i18n.t("messages.invalid_bulk_action"));
  const links = await knex.transaction(async db => {
    await require("./domain-access").lock(db);
    const rows = await owned(db, userId, domainId).whereIn("links.uuid", ids).whereNull("links.deleted_at").orderBy("links.id");
    if (rows.length !== ids.length) fail(i18n.t("messages.one_or_more_links_are_unavailable_no_links_were_changed"), 404);
    if (rows.some(row => row.banned)) fail(i18n.t("messages.selection_contains_a_banned_link_no_links_were_changed"), 409);
    if (action.endsWith("label")) {
      if (!uuid(labelId) || !await db("library_labels").where({ id: labelId, user_id: userId }).first()) fail(i18n.t("messages.label_was_not_found"), 404);
    }
    for (const row of rows) {
      if (action !== "trash") await require("./domain-access").link(db, row);
      if (request) await require("./domain-access").request(db, request, row.domain_id, action === "trash" ? "links:delete" : "links:update", action === "trash" ? null : row.user_id);
      if (action === "trash") await history.trash(db, row, actor);
      else if (action === "pause" || action === "resume") {
        const paused = action === "pause";
        if (!!row.paused !== paused) {
          await db("links").where({ id: row.id, user_id: userId }).update({ paused });
          await history.record(db, row, "updated", ["paused"], actor);
        }
      } else {
        const match = { link_id: row.id, label_id: labelId };
        const exists = await db("library_link_labels").where(match).first();
        if (action === "add_label" && !exists) {
          await db("library_link_labels").insert(match);
          await history.record(db, row, "organized", ["labels"], actor);
        } else if (action === "remove_label" && exists) {
          await db("library_link_labels").where(match).delete();
          await history.record(db, row, "organized", ["labels"], actor);
        }
      }
    }
    return rows;
  });
  if (env.REDIS_ENABLED) for (const row of links) redis.remove.link(row);
  return { affected: links.length, action };
}

module.exports = { list, saveLabel, removeLabel, saveFilter, removeFilter, bulk, parseFilters };
