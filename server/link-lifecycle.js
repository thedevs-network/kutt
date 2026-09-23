const i18n = require("./i18n");
const knex = require("./knex");

function parse(body, current = {}, html = false) {
  const { CustomError } = require("./utils");
  const fail = (message, field) => {
    const error = new CustomError(message, 400);
    if (field) error.field = field;
    throw error;
  };
  const result = {};
  if (body.paused !== undefined || html) {
    if (html) result.paused = body.paused === "on" || body.paused === "true";
    else if (typeof body.paused === "boolean") result.paused = body.paused;
    else fail(i18n.t("messages.paused_must_be_a_boolean"));
  }
  for (const field of ["starts_at", "ends_at"]) {
    if (body[field] === undefined) continue;
    if (body[field] === null || (html && body[field] === "")) { result[field] = null; continue; }
    let value = body[field];
    if (html && typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?$/.test(value)) value += "Z";
    if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d{1,3})?)?(Z|[+-]\d\d:\d\d)$/.test(value)) {
      fail(i18n.t("messages.value_must_be_an_iso_8601_timestamp_with_a_timezone_or", {value1: field}), field);
    }
    const time = Date.parse(value);
    const day = value.slice(0, 10);
    if (!Number.isFinite(time) || time < 0 || new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day) {
      fail(i18n.t("messages.value_is_not_a_valid_date", {value1: field}), field);
    }
    result[field] = time;
  }
  if (body.max_visits !== undefined) {
    let value = body.max_visits;
    if (value === null || (html && value === "")) result.max_visits = null;
    else {
      if (html && typeof value === "string" && /^\d+$/.test(value)) value = Number(value);
      if (!Number.isSafeInteger(value) || value < 1 || value > 2147483647) fail(i18n.t("messages.max_visits_must_be_an_integer_from_1_to_2147483647_or"));
      result.max_visits = value;
    }
  }
  if (body.expire_in === null || (html && body.clear_expiry === "on")) result.expire_in = null;
  const combined = { ...current, ...result };
  if (combined.starts_at != null && combined.ends_at != null && Number(combined.ends_at) <= Number(combined.starts_at)) {
    fail(i18n.t("messages.end_must_be_after_start"), "ends_at");
  }
  return result;
}

function describe(link, now = Date.now()) {
  const iso = value => value == null ? null : new Date(Number(value)).toISOString();
  const expires = link.expire_in ? require("./utils").parseDatetime(link.expire_in).getTime() : null;
  const state = describeStatus(link, now, expires);
  const stateKeys = { Active: "messages.active", Trashed: "messages.trashed", Banned: "ui.banned", Paused: "ui.paused",
    Expired: "messages.expired", Scheduled: "messages.scheduled", "Visit limit reached": "messages.visit_limit_reached" };
  return {
    deleted_at: iso(link.deleted_at), paused: !!link.paused, starts_at: iso(link.starts_at), ends_at: iso(link.ends_at),
    max_visits: link.max_visits == null ? null : Number(link.max_visits),
    redirect_count: Number(link.redirect_count || 0), lifecycle_label: i18n.t(stateKeys[state]), lifecycle_status: state,
    starts_at_input: iso(link.starts_at)?.slice(0, 19), ends_at_input: iso(link.ends_at)?.slice(0, 19)
  };
}

function describeStatus(link, now, expires) {
  if (link.deleted_at != null) return "Trashed";
  if (link.banned) return "Banned";
  if (link.paused) return "Paused";
  if ((expires != null && expires <= now) || (link.ends_at != null && Number(link.ends_at) <= now)) return "Expired";
  if (link.starts_at != null && Number(link.starts_at) > now) return "Scheduled";
  if (link.max_visits != null && Number(link.redirect_count) >= Number(link.max_visits)) return "Visit limit reached";
  return "Active";
}

async function allow(link, consume = false) {
  const now = Date.now();
  const query = knex("links").where({ id: link.id, uuid: link.uuid, address: link.address, domain_id: link.domain_id, banned: false, paused: false,
    target: link.target, password: link.password || null })
    .whereNull("deleted_at").whereNull("archived_domain")
    .where(builder => builder.whereNull("starts_at").orWhere("starts_at", "<=", now))
    .where(builder => builder.whereNull("ends_at").orWhere("ends_at", ">", now))
    .where(builder => builder.whereNull("expire_in").orWhere("expire_in", ">", require("./utils").dateToUTC(new Date(now))))
    .where(builder => builder.whereNull("max_visits").orWhereColumn("redirect_count", "<", "max_visits"));
  // The predicate and counter update are one database statement: simultaneous
  // redirects cannot overshoot the limit, and cached link data cannot bypass it.
  return consume ? (await query.increment("redirect_count", 1)) > 0 : !!(await query.first("id"));
}

module.exports = { parse, describe, allow };
