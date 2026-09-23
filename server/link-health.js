const i18n = require("./i18n");
const { createHash, randomUUID } = require("node:crypto");
const knex = require("./knex");
const routing = require("./link-routing");
const safe = require("./safe-http");
const { CustomError, getShortURL } = require("./utils");
const history = require("./link-history");
const iso = value => value == null ? null : new Date(Number(value)).toISOString();
const fail = (message, status = 400) => { throw new CustomError(message, status); };
const sensitive = /(?:token|password|secret|signature|credential|api[_-]?key|authorization|^code$|^state$)/i;
const actions = {
  DESTINATION_POLICY_DENIED: "destination_policy.denied",
  OK: "messages.no_action_needed", REDIRECT: "messages.review_the_destination_redirect_its_final_page_was_not_checked",
  ACCESS_RESTRICTED: "messages.check_destination_authentication_or_bot_restrictions_no_credentials_were_sent",
  HEAD_UNSUPPORTED: "messages.the_destination_does_not_support_head_verify_it_manually_no_get",
  HTTP_ERROR: "messages.check_the_destination_service_or_update_the_link_after_verification",
  URL_DENIED: "messages.use_public_https_on_port_443_without_credentials_or_sensitive_query",
  ADDRESS_DENIED: "messages.dns_includes_a_private_or_reserved_address_correct_dns_or_leave",
  DNS_FAILED: "messages.check_public_a_aaaa_resolution_and_retry_after_dns_recovery",
  TIMEOUT: "messages.the_destination_timed_out_verify_its_availability_and_retry_later",
  CONNECTION_FAILED: "messages.check_the_destination_tls_certificate_and_network_availability",
  CHECK_FAILED: "messages.retry_later_inspect_the_application_worker_if_this_persists",
  CONFIGURATION_INVALID: "messages.destination_rules_cannot_be_read_repair_the_saved_configuration_before_checking"
};
function strict(body, keys) {
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !keys.includes(key))) fail(i18n.t("messages.invalid_health_check_fields"));
}
function revision(value) { if (!Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) fail(i18n.t("messages.a_current_integer_revision_is_required")); }
function owned(req, db = knex, write = false) { return routing.owned({ ...req, method: write ? "PUT" : "GET" }, db, write); }
async function targets(link, db = knex) {
  const rules = (await routing.policy(link.id, db)).rules;
  const items = [{ name: "Default destination", target: link.target }, ...rules.map((rule, i) => ({ name: `Rule ${i + 1}: ${rule.name}`, target: rule.target }))];
  return { items, hash: createHash("sha256").update(JSON.stringify(items)).digest("hex") };
}
async function currentTargets(link, db = knex) { try { return await targets(link, db); } catch { return null; } }
function probeURL(value) {
  // Fragments never reach HTTP. Never send embedded credentials or bearer-like
  // query parameters to a background destination request.
  if (!require("./destination-policy").current().allows(value)) throw Object.assign(new Error("DESTINATION_POLICY_DENIED"), { code: "DESTINATION_POLICY_DENIED" });
  if (typeof value !== "string" || /[\s\\\x00-\x1f\x7f]/.test(value)) throw Object.assign(new Error("URL_DENIED"), { code: "URL_DENIED" });
  let url; try { url = new URL(value); } catch { throw Object.assign(new Error("URL_DENIED"), { code: "URL_DENIED" }); }
  if ([...url.searchParams.keys()].some(key => sensitive.test(key))) throw Object.assign(new Error("URL_DENIED"), { code: "URL_DENIED" });
  url.hash = "";
  return safe.parse(url.href).href;
}
function classification(status) {
  if (status >= 200 && status < 300) return "OK";
  if (status >= 300 && status < 400) return "REDIRECT";
  if ([401, 403, 429].includes(status)) return "ACCESS_RESTRICTED";
  if ([405, 501].includes(status)) return "HEAD_UNSUPPORTED";
  return "HTTP_ERROR";
}
async function probe(item) {
  const started = Date.now(); let status = null, code;
  try { status = (await safe.send(probeURL(item.target), { method: "HEAD", headers: { "User-Agent": "Kutt-Destination-Health/1", Accept: "*/*" } })).status; code = classification(status); }
  catch (error) { code = Object.hasOwn(actions, error.code) ? error.code : "CHECK_FAILED"; }
  return { name: item.name, code, http_status: status, duration_ms: Math.max(0, Date.now() - started), action: i18n.run("en", () => i18n.t(actions[code])) };
}
async function eligible(row, db = knex) {
  const link = await db("links").where({ id: row.link_id, user_id: row.user_id }).first();
  const user = link && await db("users").where({ id: row.user_id, verified: true, banned: false }).first();
  if (!user || Number(user.auth_version) !== Number(row.auth_version) || link.banned || link.deleted_at || link.archived_domain) return null;
  if (link.domain_id && !await require("./domain-access").find(db, user.id, { id: link.domain_id })) return null;
  return link;
}
async function view(link, user, db = knex) {
  const row = await db("link_health").where({ link_id: link.id }).first();
  const source = await currentTargets(link, db), now = Date.now();
  if (!row) return { enabled: false, interval_hours: 24, revision: 0, state: "disabled", results: [], checked_at: null, next_at: null, overdue: false, source_changed: false };
  let results, resultsUnavailable = false;
  try {
    results = JSON.parse(row.results);
    if (!Array.isArray(results) || results.length > 21 || results.some(item => !item ||
      typeof item.name !== "string" || item.name.length > 160 || !Object.hasOwn(actions, item.code) ||
      !Number.isSafeInteger(item.duration_ms) || item.duration_ms < 0 ||
      (item.http_status !== null && (!Number.isInteger(item.http_status) || item.http_status < 100 || item.http_status > 599)))) throw new Error();
    results = results.map((item, index) => ({ name: item.name, code: item.code, duration_ms: item.duration_ms, http_status: item.http_status,
      display_name: index === 0 ? i18n.t("ui.default_destination") : i18n.t("health.rule", { count: index, name: item.name.slice(`Rule ${index}: `.length) }),
      action: i18n.t(actions[item.code]) }));
  }
  catch { results = []; resultsUnavailable = true; }
  const authorized = row.user_id === user.id && Number(row.auth_version) === Number(user.auth_version);
  const changed = row.source_hash !== source?.hash;
  let state = !row.enabled ? (row.state === "authorization_required" ? "authorization_required" : "disabled") : !authorized ? "authorization_required" : row.lease && Number(row.lease_until) > now ? "checking" :
    !source ? "configuration_invalid" : resultsUnavailable ? "results_unavailable" : !row.checked_at ? "pending" : changed || now - Number(row.checked_at) > Number(row.interval_hours) * 3600000 + 900000 ? "stale" : row.state;
  return { enabled: !!row.enabled, interval_hours: row.interval_hours, revision: Number(row.revision), state,
    results: authorized && !changed ? results : [], checked_at: iso(row.checked_at), next_at: row.enabled ? iso(row.next_at) : null,
    overdue: !!row.enabled && authorized && Number(row.next_at) < now - 900000 && (!row.lease || Number(row.lease_until) <= now),
    source_changed: changed && row.checked_at != null };
}
async function get(req) { const link = await owned(req); return view(link, req.user); }
async function save(req) {
  strict(req.body, ["enabled", "interval_hours", "revision"]); revision(req.body.revision);
  if (typeof req.body.enabled !== "boolean" || !Number.isInteger(req.body.interval_hours) || req.body.interval_hours < 1 || req.body.interval_hours > 168) fail(i18n.t("messages.choose_enabled_and_an_interval_from_1_to_168_hours"));
  return knex.transaction(async db => {
    const link = await owned(req, db, true), row = await db("link_health").where({ link_id: link.id }).first(), now = Date.now();
    if (Number(row?.revision || 0) !== req.body.revision) fail(i18n.t("messages.monitoring_changed_elsewhere_reload_before_saving"), 409);
    if (req.body.enabled && (!row?.enabled || row.user_id !== req.user.id)) {
      const count = await db("link_health").where({ user_id: req.user.id, enabled: true }).count("* as n").first();
      if (Number(count.n) >= 100) fail(i18n.t("messages.at_most_100_links_may_be_monitored_per_owner"), 409);
    }
    const next = { user_id: req.user.id, enabled: req.body.enabled, interval_hours: req.body.interval_hours,
      revision: req.body.revision + 1, auth_version: req.user.auth_version, next_at: req.body.enabled ? now : null,
      state: req.body.enabled ? (!row?.enabled || row?.state === "authorization_required" ? "pending" : row.state) : "disabled",
      lease: null, lease_until: null,
      ...(row?.state === "authorization_required" && { checked_at: null, results: "[]", source_hash: null }) };
    if (row) await db("link_health").where({ link_id: link.id }).update(next);
    else await db("link_health").insert({ link_id: link.id, results: "[]", ...next });
    await history.record(db, link, "health_configured", ["health_monitoring"], { id: req.user.id, apiToken: req.apiToken });
    return view(link, req.user, db);
  });
}
async function queue(req) {
  strict(req.body, ["revision"]); revision(req.body.revision);
  return knex.transaction(async db => {
    const link = await owned(req, db, true), row = await db("link_health").where({ link_id: link.id }).first(), now = Date.now();
    if (!row?.enabled || Number(row.revision) !== req.body.revision || row.user_id !== req.user.id || Number(row.auth_version) !== Number(req.user.auth_version)) fail(i18n.t("messages.reload_and_enable_current_monitoring_before_checking"), 409);
    if (row.lease && Number(row.lease_until) > now || row.requested_at && now - Number(row.requested_at) < 60000) fail(i18n.t("messages.a_check_is_running_or_was_requested_less_than_one_minute"), 429);
    await db("link_health").where({ link_id: link.id }).update({ next_at: now, requested_at: now });
    return { queued: true, ...await view(link, req.user, db) };
  });
}
async function list(req) {
  // Listing uses exactly the same owner/domain authorization as per-link reads.
  const before = req.query.before;
  if (before !== undefined && (typeof before !== "string" || !/^[1-9]\d{0,14}$/.test(before))) fail(i18n.t("messages.invalid_monitoring_cursor"));
  const rows = await knex("links as l").join("link_health as h", "l.id", "h.link_id").where("l.user_id", req.user.id)
    .whereNull("l.deleted_at").whereNull("l.archived_domain").where("l.banned", false)
    .modify(q => { if (before) q.where("l.id", "<", Number(before)); if (req.apiTokenDomain !== undefined) q.where("l.domain_id", req.apiTokenDomain); })
    .select("l.*").orderBy("l.id", "desc").limit(50);
  const data = [];
  for (const row of rows) {
    try {
      const link = await owned({ ...req, params: { id: row.uuid } });
      data.push({ id: link.uuid, address: link.address, link: getShortURL(link.address, await history.domainName(knex, link)).url, ...await view(link, req.user) });
    } catch (error) { if (![404, 410].includes(error.statusCode)) throw error; }
  }
  return { data, next: rows.length === 50 ? String(rows.at(-1).id) : null };
}
async function claim(now = Date.now()) {
  return knex.transaction(async db => {
    // One cycle per minute across processes; each cycle has at most 21 HEADs.
    // Conditional updates and a ten-minute lease allow crash recovery.
    const gate = await db("health_worker").where({ id: 1 }).where("next_claim_at", "<=", now).update({ next_claim_at: now + 60000 });
    if (!gate) return null;
    const row = await db("link_health").where({ enabled: true }).where("next_at", "<=", now)
      .where(q => q.whereNull("lease").orWhere("lease_until", "<=", now)).orderBy("next_at").first();
    if (!row) return null;
    const lease = randomUUID();
    const changed = await db("link_health").where({ link_id: row.link_id, revision: row.revision, enabled: true })
      .where(q => q.whereNull("lease").orWhere("lease_until", "<=", now)).update({ lease, lease_until: now + 600000 });
    return changed ? { ...row, lease } : null;
  });
}
async function run(row) {
  const match = { link_id: row.link_id, revision: row.revision, lease: row.lease, enabled: true };
  let link = await eligible(row);
  if (!link) {
    // Retired or reassigned links must not leave invisible, forever-retrying
    // schedules. A current owner must explicitly opt in again after recovery.
    await knex("link_health").where(match).update({ enabled: false, revision: Number(row.revision) + 1, state: "authorization_required", next_at: null, lease: null, lease_until: null }); return;
  }
  const source = await currentTargets(link);
  if (!source) { await knex("link_health").where(match).update({ state: "configuration_invalid", results: "[]", source_hash: null, checked_at: null, next_at: Date.now() + 3600000, lease: null, lease_until: null }); return; }
  const results = [], seen = new Map();
  for (const item of source.items) {
    await knex("health_worker").where({ id: 1 }).update({ heartbeat_at: Date.now() });
    link = await eligible(row);
    const current = await knex("link_health").where(match).first();
    if (!link || !current || (await currentTargets(link))?.hash !== source.hash) break;
    const result = seen.get(item.target) || await probe(item);
    seen.set(item.target, result); results.push({ ...result, name: item.name });
  }
  await knex.transaction(async db => {
    await require("./domain-access").lock(db);
    const current = await db("link_health").where(match).first();
    if (!current) return;
    link = await eligible(row, db);
    if (!link || results.length !== source.items.length || (await currentTargets(link, db))?.hash !== source.hash) {
      await db("link_health").where(match).update({ lease: null, lease_until: null, next_at: Date.now() + 60000 }); return;
    }
    const state = results.every(result => result.code === "OK") ? "healthy" : "attention", now = Date.now();
    await db("link_health").where(match).update({ state, results: JSON.stringify(results), source_hash: source.hash,
      checked_at: now, next_at: now + Number(row.interval_hours) * 3600000, lease: null, lease_until: null });
    if (state !== current.state || source.hash !== current.source_hash) await require("./webhooks").record(db, link, "health_changed", ["health_status"]);
  });
}
let running = false;
async function tick() {
  if (running) return;
  running = true;
  try { await knex("health_worker").where({ id: 1 }).update({ heartbeat_at: Date.now() }); const row = await claim(); if (row) await run(row); }
  catch { console.error("Destination health worker failed; retrying on next interval."); }
  finally { running = false; }
}
function start() { const timer = setInterval(tick, 10000); timer.unref(); void tick(); }
module.exports = { actions, targets, probeURL, classification, probe, eligible, owned, view, get, save, queue, list, claim, run, tick, start };
