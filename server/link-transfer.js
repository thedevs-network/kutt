const i18n = require("./i18n");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const { createHmac, randomUUID, timingSafeEqual } = require("node:crypto");
const bcrypt = require("bcryptjs");
const knex = require("./knex");
const env = require("./env");
const query = require("./queries");
const utils = require("./utils");
const history = require("./link-history");
const lifecycle = require("./link-lifecycle");
const validators = require("./handlers/validators.handler");

const TTL = 20 * 60 * 1000, RETENTION = 24 * 60 * 60 * 1000;
const MAX_ROWS = 100, MAX_BYTES = 900000;
const fields = ["address", "target", "domain", "description", "paused", "starts_at", "ends_at", "max_visits", "redirect_count", "expires_at", "deleted_at", "password_required", "tags", "collections", "routing_rules", "tracking_enabled", "forwarding"];
const fail = (message, status = 400) => { throw new utils.CustomError(message, status); };
const digest = value => createHmac("sha256", env.JWT_SECRET).update("kutt-transfer-v1\0" + JSON.stringify(value)).digest("hex");
const scope = req => req.apiTokenDomain === undefined ? "all" : req.apiTokenDomain === null ? "default" : req.apiTokenDomain;
const labelsFor = row => [...row.tags.map(name => ({ kind: "tag", name })), ...row.collections.map(name => ({ kind: "collection", name }))];
const formulaStart = /^[\s=+\-@']/;
const encodeCell = value => typeof value === "string" && formulaStart.test(value) ? "'" + value : value;
const decodeCell = value => typeof value === "string" && value.startsWith("'") && formulaStart.test(value.slice(1)) ? value.slice(1) : value;

function read(input) {
  if (!input || !["csv", "json"].includes(input.format) || !["abort", "skip", "rename"].includes(input.conflict)) fail(i18n.t("messages.choose_csv_json_and_abort_skip_or_rename_conflicts"));
  if (typeof input.content !== "string" || !input.content || Buffer.byteLength(input.content) > MAX_BYTES) fail(i18n.t("messages.provide_a_utf_8_file_smaller_than_900_kb"));
  let rows;
  try {
    if (input.format === "json") {
      const parsed = JSON.parse(input.content);
      if (!Array.isArray(parsed) && (!parsed || typeof parsed !== "object" || parsed.schema_version !== 1))
        fail(i18n.t("messages.unsupported_json_schema_use_schema_version_1_links_or_an_array"));
      rows = Array.isArray(parsed) ? parsed : parsed.links;
    } else {
      rows = parse(input.content, { bom: true, skip_empty_lines: true, max_record_size: 100000,
        columns: header => {
          if (new Set(header).size !== header.length) fail(i18n.t("messages.duplicate_csv_headers"));
          if (!["address", "target"].every(field => header.includes(field))) fail(i18n.t("messages.csv_needs_address_and_target_column_headers_start_with_the_csv"));
          return header;
        } });
      for (const [index, row] of rows.entries()) {
        const fieldError = (field, message) => fail(i18n.t("messages.row_value_value_value", {value1: index + 1, value2: field, value3: message}));
        if (row.cell_encoding && row.cell_encoding !== "apostrophe-v1") fieldError("cell_encoding", i18n.t("messages.unsupported_csv_cell_encoding"));
        if (row.cell_encoding) for (const key of Object.keys(row)) row[key] = decodeCell(row[key]);
        delete row.cell_encoding;
        for (const key of ["paused", "password_required", "banned", "tracking_enabled"]) {
          if (row[key] === undefined || row[key] === "") delete row[key];
          else if (["true", "false"].includes(row[key])) row[key] = row[key] === "true";
          else fieldError(key, i18n.t("messages.use_true_or_false_or_leave_the_cell_empty"));
        }
        for (const key of ["max_visits", "redirect_count"]) {
          if (row[key] === undefined || row[key] === "") row[key] = null;
          else if (/^\d+$/.test(row[key])) row[key] = Number(row[key]);
          else fieldError(key, i18n.t("messages.use_a_nonnegative_integer_or_leave_the_cell_empty"));
        }
        for (const key of ["tags", "collections", "routing_rules", "forwarding"]) {
          try { row[key] = row[key] ? JSON.parse(row[key]) : key === "forwarding" ? {} : []; }
          catch { fieldError(key, i18n.t("messages.invalid_json_in_this_csv_cell_quote_the_cell_and_double")); }
        }
        for (const key of ["starts_at", "ends_at", "expires_at", "deleted_at"]) if (row[key] === "") row[key] = null;
      }
    }
  } catch (error) {
    if (error instanceof utils.CustomError) throw error;
    if (input.format === "csv") {
      const line = Number.isSafeInteger(error.lines) && error.lines > 0 ? i18n.t("messages.near_line_value", {value1: error.lines}) : "";
      fail(i18n.t("messages.malformed_csv_value_check_quotation_marks_and_that_every_row_matches", {value1: line}));
    }
    fail(i18n.t("messages.malformed_json_check_commas_and_double_quotation_marks_start_with_the"));
  }
  if (!Array.isArray(rows) || !rows.length || rows.length > MAX_ROWS) fail(i18n.t("messages.import_1_to_100_links_per_batch"));
  return rows;
}

function timestamp(value, field) {
  if (value == null || value === "") return null;
  const result = lifecycle.parse({ starts_at: value }).starts_at;
  if (!Number.isSafeInteger(result)) fail(i18n.t("transfer.invalid_field", { field }));
  return result;
}

function normalized(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail(i18n.t("messages.each_link_must_be_an_object"));
  const allowed = [...fields, "id", "banned", "password"];
  if (Object.keys(input).some(key => !allowed.includes(key))) fail(i18n.t("messages.unknown_link_field_refusing_to_silently_discard_it"));
  if (input.banned !== undefined && typeof input.banned !== "boolean") fail(i18n.t("messages.banned_must_be_boolean"));
  if (input.banned) fail(i18n.t("messages.banned_links_cannot_be_imported"));
  if (!require("./link-alias").valid(input.address)) fail(i18n.t("messages.invalid_or_reserved_alias"));
  if (typeof input.target !== "string" || !/^https?:\/\//i.test(input.target) || input.target.length > 2040 || /[\u0000-\u0020]/.test(input.target)) fail(i18n.t("messages.invalid_target"));
  let url;
  try { url = new URL(input.target); } catch { fail(i18n.t("messages.target_must_be_an_absolute_http_s_url")); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || utils.removeWww(url.host) === env.DEFAULT_DOMAIN) fail(i18n.t("messages.target_must_be_an_external_http_s_url_without_embedded_credentials"));
  if (input.description != null && (typeof input.description !== "string" || input.description.length > 2040 || /[\u0000-\u0008\u000b\u000c]/.test(input.description))) fail(i18n.t("messages.invalid_description"));
  const domain = input.domain == null || input.domain === "" ? env.DEFAULT_DOMAIN : input.domain;
  if (typeof domain !== "string" || domain.length > 253 || domain !== domain.trim()) fail(i18n.t("messages.invalid_domain"));
  if (input.password_required !== undefined && typeof input.password_required !== "boolean") fail(i18n.t("messages.password_required_must_be_boolean"));
  if (input.tracking_enabled !== undefined && typeof input.tracking_enabled !== "boolean") fail(i18n.t("messages.tracking_enabled_must_be_boolean"));
  if (input.password_required && !input.password) fail(i18n.t("messages.protected_link_requires_an_explicit_replacement_password"));
  if (input.password != null && input.password !== "" && (typeof input.password !== "string" || input.password.length < 3 || input.password.length > 64)) fail(i18n.t("messages.password_must_be_3_to_64_characters"));
  const policy = lifecycle.parse(input);
  const count = input.redirect_count == null ? 0 : input.redirect_count;
  if (!Number.isSafeInteger(count) || count < 0 || count > 2147483647) fail(i18n.t("messages.invalid_redirect_count"));
  const row = { address: input.address, target: input.target, domain: domain.toLowerCase(), description: input.description || null,
    paused: policy.paused || false, starts_at: policy.starts_at ?? null, ends_at: policy.ends_at ?? null,
    max_visits: policy.max_visits ?? null, redirect_count: count, tracking_enabled: input.tracking_enabled ?? true,
    expires_at: timestamp(input.expires_at, "expires_at"), deleted_at: timestamp(input.deleted_at, "deleted_at"), password: input.password || null };
  for (const field of ["tags", "collections"]) {
    const names = input[field] == null ? [] : input[field];
    if (!Array.isArray(names) || names.length > 20) fail(i18n.t("messages.use_at_most_20_labels_per_kind_on_a_link"));
    row[field] = names.map(value => {
      if (typeof value !== "string") fail(i18n.t("messages.label_names_must_be_strings"));
      const name = value.normalize("NFKC").trim();
      if (!name || name.length > 80 || /[\u0000-\u001f\u007f]/.test(name)) fail(i18n.t("messages.invalid_label_name"));
      return name;
    });
    if (new Set(row[field].map(value => value.toLowerCase())).size !== row[field].length) fail(i18n.t("messages.duplicate_label_on_a_link"));
  }
  row.routing_rules = require("./link-routing").normalize(input.routing_rules === undefined ? [] : input.routing_rules);
  row.forwarding = require("./link-forwarding").normalize(input.forwarding);
  return row;
}

async function plan(db, req, input, id, fixedAliases) {
  const raw = read(input), rows = [], used = new Set(), newLabels = new Map();
  const labels = await db("library_labels").where({ user_id: req.user.id });
  const token = req.apiToken ? await db("api_tokens").where({ id: req.apiToken }).first() : null;
  for (let index = 0; index < raw.length; index++) {
    try {
      const row = normalized(raw[index]);
      for (const target of [row.target, ...row.routing_rules.map(rule => rule.target)]) require("./destination-policy").requireAllowed(target);
      let domainId = null;
      if (row.domain !== env.DEFAULT_DOMAIN.toLowerCase()) {
        const domain = await require("./domain-access").find(db, req.user.id, { address: row.domain });
        if (!domain) fail(i18n.t("messages.domain_is_unavailable_to_this_account"), 403);
        domainId = domain.id;
      }
      if (req.apiTokenDomain !== undefined && domainId !== req.apiTokenDomain) fail(i18n.t("messages.token_does_not_permit_this_domain"), 403);
      if (row.routing_rules.length && token && !JSON.parse(token.scopes).includes("links:update")) fail(i18n.t("messages.routing_rules_require_links_update_permission"), 403);
      if ((row.forwarding.query_keys.length || row.forwarding.path_prefixes.length) && token && !JSON.parse(token.scopes).includes("links:update")) fail(i18n.t("messages.forwarding_requires_links_update_permission"), 403);
      if (!row.tracking_enabled && token && !JSON.parse(token.scopes).includes("links:update")) fail(i18n.t("messages.tracking_opt_outs_require_links_update_permission"), 403);
      for (const label of labelsFor(row)) {
        if (token && !JSON.parse(token.scopes).includes("links:update")) fail(i18n.t("messages.organization_requires_links_update_permission"), 403);
        if (req.apiTokenDomain !== undefined && !labels.some(item => item.kind === label.kind && item.name_key === label.name.toLowerCase())) fail(i18n.t("messages.a_domain_limited_token_cannot_create_account_labels"), 403);
      }
      let address = fixedAliases?.[index] || row.address;
      const busy = async alias => used.has(history.key(row.domain, alias)) || !!await db("link_alias_claims").where({ key: history.key(row.domain, alias) }).first();
      let action = "create";
      if (await busy(address)) {
        if (input.conflict === "skip") action = "skip";
        else if (input.conflict === "rename" && !fixedAliases) {
          address = row.address.slice(0, 55) + "-" + digest([id, index]).slice(0, 8);
          if (await busy(address)) fail(i18n.t("messages.generated_alias_is_unavailable_run_a_new_preview"), 409);
        } else fail(i18n.t("messages.alias_is_unavailable_no_existing_link_will_be_overwritten"), 409);
      }
      if (action === "create") {
        if (!require("./link-alias").valid(address)) fail(i18n.t("messages.invalid_or_reserved_alias"));
        used.add(history.key(row.domain, address));
        for (const label of labelsFor(row)) newLabels.set(label.kind + ":" + label.name.toLowerCase(), label);
      }
      rows.push({ row: index + 1, action, address, domain: row.domain, value: { ...row, address, domain_id: domainId } });
    } catch (error) {
      if (!(error instanceof utils.CustomError)) throw error;
      rows.push({ row: index + 1, action: "error", message: error.message });
    }
  }
  for (const kind of ["tag", "collection"]) {
    const count = labels.filter(row => row.kind === kind).length + [...newLabels.values()].filter(label => label.kind === kind && !labels.some(row => row.kind === kind && row.name_key === label.name.toLowerCase())).length;
    if (count > 100) fail(i18n.t("messages.import_would_exceed_the_account_label_limit"), 409);
  }
  return rows;
}

const summary = rows => rows.map(({ value, ...row }) => row);
const inputHash = input => digest({ format: input.format, conflict: input.conflict, content: input.content });
function sign(payload) {
  const value = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return value + "." + digest(value);
}
function verify(value) {
  if (typeof value !== "string" || value.length > 20000) fail(i18n.t("messages.a_valid_dry_run_token_is_required"));
  const parts = value.split(".");
  if (parts.length !== 2 || !/^[a-z0-9_-]+$/i.test(parts[0]) || !/^[a-f0-9]{64}$/.test(parts[1]) || !timingSafeEqual(Buffer.from(parts[1]), Buffer.from(digest(parts[0])))) fail(i18n.t("messages.invalid_dry_run_token"), 403);
  try { return JSON.parse(Buffer.from(parts[0], "base64url")); } catch { fail(i18n.t("messages.invalid_dry_run_token"), 403); }
}

async function preview(req) {
  const id = randomUUID(), rows = await knex.transaction(db => plan(db, req, req.body, id));
  const hosts = new Map();
  for (let index = 0; index < rows.length; index++) {
    if (rows[index].action !== "create") continue;
    for (const target of [rows[index].value.target, ...rows[index].value.routing_rules.map(rule => rule.target)]) {
      const hostname = utils.removeWww(new URL(target).hostname);
      if (!hosts.has(hostname)) {
        if (hosts.size >= 100) fail(i18n.t("messages.use_at_most_100_distinct_destination_hosts_per_import_batch"));
        try { await validators.bannedDomain(hostname); await validators.bannedHost(hostname); hosts.set(hostname, null); }
        catch (error) { if (!(error instanceof utils.CustomError)) throw error; hosts.set(hostname, error.message); }
      }
      if (hosts.get(hostname)) { rows[index] = { row: index + 1, action: "error", message: hosts.get(hostname) }; break; }
    }
  }
  const result = summary(rows), valid = !rows.some(row => row.action === "error");
  return { valid, rows: result, expires_in: TTL / 1000, preview_token: valid ? sign({ id, uid: req.user.id, scope: scope(req), token: req.apiToken || null,
    input: inputHash(req.body), plan: digest(result), expires: Date.now() + TTL, aliases: rows.map(row => row.address) }) : null };
}

async function commit(req) {
  const input = req.body, receipt = verify(input.preview_token);
  if (receipt.uid !== req.user.id || receipt.scope !== scope(req) || receipt.token !== (req.apiToken || null) || receipt.input !== inputHash(input)) fail(i18n.t("messages.preview_no_longer_matches_this_request_or_credential_run_a_new"), 409);
  const replay = await knex("link_imports").where({ id: receipt.id, user_id: req.user.id }).first();
  if (!replay && receipt.expires < Date.now()) fail(i18n.t("messages.preview_expired_run_a_new_dry_run"), 409);
  const rows = read(input).map(normalized);
  // Perform expensive password hashing and host checks before acquiring a write transaction.
  const passwords = new Map(), hosts = new Set();
  if (!replay) for (const row of rows) {
    if (row.password && !passwords.has(row.password)) passwords.set(row.password, await bcrypt.hash(row.password, 12));
    for (const target of [row.target, ...row.routing_rules.map(rule => rule.target)]) {
      const hostname = utils.removeWww(new URL(target).hostname);
      if (!hosts.has(hostname)) {
        if (hosts.size >= 100) fail(i18n.t("messages.use_at_most_100_distinct_destination_hosts_per_import_batch"));
        await validators.bannedDomain(hostname); await validators.bannedHost(hostname); hosts.add(hostname);
      }
    }
  }
  return knex.transaction(async db => {
    await require("./domain-access").lock(db);
    const user = await db("users").where({ id: req.user.id }).first();
    if (!user || user.banned || !user.verified || Number(user.auth_version || 0) !== Number(req.user.auth_version || 0)) fail(i18n.t("messages.account_authorization_changed_sign_in_again"), 401);
    if (req.apiToken) {
      const token = await db("api_tokens").where({ id: req.apiToken, user_id: user.id }).first();
      if (!token || token.revoked_at != null || (token.expires_at != null && Number(token.expires_at) <= Date.now()) || !JSON.parse(token.scopes).includes("links:create")) fail(i18n.t("messages.import_token_is_no_longer_authorized"), 403);
      let currentScope = token.domain_scope;
      if (!["all", "default"].includes(currentScope)) {
        const domain = await require("./domain-access").find(db, user.id, { uuid: currentScope });
        currentScope = domain?.id;
      }
      if (currentScope !== scope(req)) fail(i18n.t("messages.token_domain_authorization_changed"), 403);
    }
    const old = await db("link_imports").where({ id: receipt.id, user_id: req.user.id }).first();
    if (old) {
      if (old.input_hash !== receipt.input || Number(old.created_at) < Date.now() - RETENTION) fail(i18n.t("messages.import_replay_has_expired"), 409);
      const result = JSON.parse(old.result);
      for (const row of result.created) {
        const link = await db("links").where({ uuid: row.id, user_id: req.user.id }).first();
        if (!link || link.banned || (link.deleted_at != null && !row.trashed) || (req.apiTokenDomain !== undefined && (link.archived_domain || link.domain_id !== req.apiTokenDomain))) fail(i18n.t("messages.previously_imported_link_is_no_longer_available"), 409);
        await require("./domain-access").link(db, link);
      }
      return { ...result, replayed: true };
    }
    if (replay) fail(i18n.t("messages.import_receipt_is_no_longer_available_run_a_new_dry_run"), 409);
    const planned = await plan(db, req, input, receipt.id, receipt.aliases);
    if (planned.some(row => row.action === "error") || digest(summary(planned)) !== receipt.plan) fail(i18n.t("messages.availability_or_permissions_changed_after_preview_run_a_new_dry_run"), 409);
    await db("link_imports").where({ user_id: req.user.id }).where("created_at", "<", Date.now() - RETENTION).delete();
    const { n } = await db("link_imports").where({ user_id: req.user.id }).count("* as n").first();
    if (Number(n) >= 100) fail(i18n.t("messages.daily_import_batch_limit_reached"), 429);
    const result = { created: [], skipped: planned.filter(row => row.action === "skip").length, replayed: false };
    for (const item of planned.filter(row => row.action === "create")) {
      const row = item.value;
      const link = await query.link.create({ ...row, user_id: req.user.id, password: null,
        expire_in: row.expires_at == null ? null : utils.dateToUTC(new Date(row.expires_at)) }, db, { id: req.user.id, apiToken: req.apiToken });
      await db("links").where({ id: link.id }).update({ password: row.password ? passwords.get(row.password) : null,
        redirect_count: row.redirect_count, deleted_at: row.deleted_at });
      if (row.routing_rules.length) await db("link_routing").insert({ link_id: link.id, rules: JSON.stringify(row.routing_rules), revision: 1 });
      if (row.forwarding.query_keys.length || row.forwarding.path_prefixes.length) await db("link_forwarding").insert({ link_id: link.id, policy: JSON.stringify(row.forwarding), revision: 1 });
      if (!row.tracking_enabled) await db("link_tracking").insert({ link_id: link.id, enabled: false, revision: 1 });
      for (const label of labelsFor(row)) {
        const match = { user_id: req.user.id, kind: label.kind, name_key: label.name.toLowerCase() };
        let existing = await db("library_labels").where(match).first();
        if (!existing) { existing = { id: randomUUID(), ...match, name: label.name }; await db("library_labels").insert(existing); }
        await db("library_link_labels").insert({ link_id: link.id, label_id: existing.id });
      }
      await history.record(db, link, "imported", [], { id: req.user.id, apiToken: req.apiToken });
      result.created.push({ id: link.uuid, address: link.address, domain: row.domain, trashed: row.deleted_at != null });
    }
    await db("link_imports").insert({ id: receipt.id, user_id: req.user.id, input_hash: receipt.input, created_at: Date.now(), result: JSON.stringify(result) });
    return result;
  });
}

async function exportLinks(req) {
  const format = req.query.format || "json", state = req.query.state || "active", search = req.query.q || "";
  if (!["json", "csv"].includes(format) || !["active", "trash", "all"].includes(state) || typeof search !== "string" || search.length > 200) fail(i18n.t("messages.invalid_export_format_state_or_search"));
  const source = knex("links").where({ "links.user_id": req.user.id });
  if (req.apiTokenDomain !== undefined) source.where({ "links.domain_id": req.apiTokenDomain }).whereNull("links.archived_domain");
  if (state !== "all") source[state === "trash" ? "whereNotNull" : "whereNull"]("links.deleted_at");
  if (search) {
    const match = "%" + search.toLowerCase().replace(/[!%_]/g, "!$&") + "%";
    source.where(builder => builder.whereRaw("LOWER(links.address) LIKE ? ESCAPE '!'", [match]).orWhereRaw("LOWER(links.target) LIKE ? ESCAPE '!'", [match]));
  }
  const links = await source.leftJoin("domains", "links.domain_id", "domains.id").select("links.*", knex.raw("coalesce(domains.address, links.archived_domain) as domain")).orderBy("links.id").limit(1001);
  if (links.length > 1000) fail(i18n.t("messages.export_exceeds_1000_links_narrow_the_search_before_exporting"), 413);
  const assigned = links.length ? await knex("library_link_labels as rel").join("library_labels as label", "rel.label_id", "label.id")
    .where("label.user_id", req.user.id).whereIn("rel.link_id", links.map(row => row.id)).select("rel.link_id", "label.kind", "label.name").orderBy("label.name_key") : [];
  const routing = require("./link-routing"), policies = new Map();
  const stored = links.length ? await knex("link_routing").whereIn("link_id", links.map(row => row.id)) : [];
  for (const row of stored) policies.set(row.link_id, routing.storedPolicy(row).rules);
  const forwarding = new Map();
  for (const row of links.length ? await knex("link_forwarding").whereIn("link_id", links.map(link => link.id)) : []) {
    const { revision, ...config } = require("./link-forwarding").stored(row);
    forwarding.set(row.link_id, config);
  }
  const tracking = new Map();
  for (const row of links.length ? await knex("link_tracking").whereIn("link_id", links.map(row => row.id)) : []) {
    tracking.set(row.link_id, require("./analytics-privacy").trackingValue(row).enabled);
  }
  const rows = links.map(row => {
    const policy = lifecycle.describe(row);
    return { id: row.uuid, address: row.address, target: row.target, domain: row.domain || env.DEFAULT_DOMAIN,
      description: row.description || "", paused: !!row.paused, starts_at: policy.starts_at, ends_at: policy.ends_at,
      max_visits: policy.max_visits, redirect_count: policy.redirect_count, expires_at: row.expire_in ? utils.parseDatetime(row.expire_in).toISOString() : null,
      deleted_at: policy.deleted_at, password_required: !!row.password, banned: !!row.banned, routing_rules: policies.get(row.id) || [], tracking_enabled: tracking.get(row.id) ?? true,
      forwarding: forwarding.get(row.id) || { query_keys: [], path_prefixes: [] },
      tags: assigned.filter(label => label.link_id === row.id && label.kind === "tag").map(label => label.name),
      collections: assigned.filter(label => label.link_id === row.id && label.kind === "collection").map(label => label.name) };
  });
  if (format === "json") return { format, body: JSON.stringify({ schema_version: 1, exported_at: new Date().toISOString(), links: rows }, null, 2) };
  const columns = ["cell_encoding", "id", ...fields, "banned"];
  return { format, body: stringify(rows.map(row => Object.fromEntries(columns.map(key => [key, key === "cell_encoding" ? "apostrophe-v1" : encodeCell(row[key] !== null && typeof row[key] === "object" ? JSON.stringify(row[key]) : row[key] == null ? "" : String(row[key]))]))), { header: true, columns }) };
}

function template(format = "json") {
  if (!["json", "csv"].includes(format)) fail(i18n.t("messages.choose_json_or_csv_for_the_template"));
  const rows = [{ address: "example-link", target: "https://example.org/page", description: i18n.t("messages.example_link"), paused: true }];
  return { format, body: format === "json" ? JSON.stringify({ schema_version: 1, links: rows }, null, 2) :
    stringify(rows.map(row => ({ ...row, paused: "true" })), { header: true, columns: ["address", "target", "description", "paused"] }) };
}

module.exports = { preview, commit, exportLinks, template, read, normalized, MAX_BYTES };
