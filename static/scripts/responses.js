(() => {
  "use strict";
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const text = value => typeof value === "string";
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const bool = value => typeof value === "boolean";
  const list = (value, check) => Array.isArray(value) && value.every(check);
  const timestamp = value => text(value) && Number.isFinite(Date.parse(value));
  const nullable = check => value => value === null || check(value);
  const policy = value => object(value) && count(value.revision);
  const forwarding = value => policy(value) && list(value.query_keys, text) && list(value.path_prefixes, text);
  const conditions = value => object(value) && Object.keys(value).length > 0 && Object.entries(value).every(([kind, rows]) =>
    ["devices", "languages", "countries"].includes(kind) ? list(rows, text) : kind === "query" && list(rows, row => object(row) &&
      text(row.key) && ["present", "absent", "equals"].includes(row.op) && (row.op !== "equals" || text(row.value))));
  const routing = value => policy(value) && list(value.rules, rule => object(rule) && text(rule.name) && text(rule.target) && conditions(rule.conditions));
  const preview = value => object(value) && value.preview === true && text(value.target) && nullable(count)(value.rule_index) &&
    (value.rule_index === null ? value.rule_name === null : text(value.rule_name));
  const health = value => policy(value) && bool(value.enabled) && count(value.interval_hours) && value.interval_hours >= 1 && value.interval_hours <= 168 &&
    text(value.state) && nullable(timestamp)(value.checked_at) && nullable(timestamp)(value.next_at) && bool(value.overdue) && bool(value.source_changed) &&
    list(value.results, item => object(item) && text(item.name) && text(item.code) && text(item.action) && count(item.duration_ms) &&
      (item.http_status === null || Number.isInteger(item.http_status) && item.http_status >= 100 && item.http_status <= 599));
  const healthList = value => object(value) && (value.next === null || text(value.next) && /^[1-9]\d*$/.test(value.next)) &&
    list(value.data, item => health(item) && text(item.id) && text(item.link));
  const dimensions = ["browser", "os", "country", "referrer"];
  const visits = row => object(row) && text(row.name) && count(row.visits);
  const option = row => object(row) && text(row.name) && text(row.id);
  const analytics = value => object(value) && count(value.total) && count(value.visited_links) && count(value.matched_links) &&
    nullable(text)(value.selected_link) && timestamp(value.generated_at) && object(value.filters) &&
    ["start", "end", "link", "domain", "tag", "q"].every(key => text(value.filters[key])) &&
    object(value.available_filters) && ["tags", "domains"].every(key => list(value.available_filters[key], option)) &&
    list(value.by_day, row => object(row) && text(row.date) && count(row.visits)) && list(value.tags, visits) &&
    object(value.stats) && dimensions.every(key => list(value.stats[key], visits));
  const tracking = value => policy(value) && bool(value.enabled);
  const days = value => count(value) && value <= 36500;
  const retention = value => policy(value) && days(value.days) && nullable(timestamp)(value.last_run) &&
    count(value.deleted_buckets) && nullable(text)(value.last_error);
  const retentionPreview = value => policy(value) && days(value.days) && count(value.eligible_buckets) &&
    (value.days === 0 ? value.cutoff === null : timestamp(value.cutoff)) && text(value.confirmation) &&
    /^[A-Za-z0-9_-]+\.[a-f0-9]{64}$/.test(value.confirmation) && value.confirmation.length <= 1000;
  const cursor = value => text(value) && /^(0|[1-9]\d*)$/.test(value) && count(Number(value));
  const hook = value => policy(value) && text(value.id) && text(value.name) && text(value.url) &&
    bool(value.enabled) && bool(value.authorization_required) && list(value.events, text) &&
    timestamp(value.created_at) && timestamp(value.updated_at);
  const hookList = value => object(value) && list(value.data, hook) && list(value.event_types, text);
  const event = value => object(value) && text(value.id) && text(value.type) && timestamp(value.occurred_at) &&
    cursor(value.sequence) && object(value.data) && (value.data.link_id === undefined || text(value.data.link_id)) &&
    (value.delivery === undefined || object(value.delivery) && value.delivery.status === "not_queued" && value.delivery.reason === "CAPACITY_LIMIT");
  const events = value => object(value) && list(value.data, event) && cursor(value.cursor);
  const deliveries = value => object(value) && nullable(cursor)(value.next) && list(value.data, item =>
    policy(item) && text(item.id) && text(item.type) && text(item.state) && count(item.total_attempts) &&
    timestamp(item.created_at) && nullable(timestamp)(item.next_at) && nullable(text)(item.error) &&
    (item.http_status === null || Number.isInteger(item.http_status) && item.http_status >= 100 && item.http_status <= 599));
  const hookSecret = value => hook(value) && text(value.secret) && /^whsec_[A-Za-z0-9_-]+$/.test(value.secret);
  const deliveryQueued = value => object(value) && text(value.delivery_id) && text(value.event_id);
  const unexpected = () => new Error(window.KuttI18n.t("ui.unexpected_server_response_your_changes_were_not_confirmed_check_your_session"));
  async function read(response, validate, conflict) {
    if (response.redirected || !/^application\/json(?:\s*;|$)/i.test(response.headers.get("content-type") || "")) throw unexpected();
    let data;
    try { data = await response.json(); } catch { throw unexpected(); }
    if (!response.ok) {
      const message = response.status === 409 && conflict ? conflict :
        object(data) && text(data.error) && data.error.length <= 500 ? data.error : window.KuttI18n.t("common.response_failed", { status: response.status });
      throw Object.assign(new Error(message), { status: response.status });
    }
    if (!validate(data)) throw unexpected();
    return data;
  }
  // Some existing endpoints intentionally acknowledge with an empty/text body.
  async function acknowledgement(response, status, body) {
    if (response.ok) {
      if (response.redirected || response.status !== status || (body !== undefined &&
        (!/^text\/plain(?:\s*;|$)/i.test(response.headers.get("content-type") || "") || await response.text() !== body))) throw unexpected();
      return;
    }
    return read(response, () => false);
  }
  window.KuttResponses = { read, acknowledgement, unexpected, forwarding, routing, preview, health, healthList, analytics,
    dimensions, tracking, retention, retentionPreview, hook, hookList, hookSecret, deliveries, deliveryQueued, event, events };
})();
