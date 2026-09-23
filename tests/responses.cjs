const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

module.exports = async ({ root, request, session }) => {
  const context = vm.createContext({ window: { KuttI18n: require("../server/i18n").current() } });
  vm.runInContext(readFileSync(path.join(root, "static/scripts/responses.js"), "utf8"), context);
  const { read, ...schemas } = context.window.KuttResponses;
  const response = (data, overrides = {}) => ({ ok: true, status: 200, redirected: false,
    headers: { get: () => "application/json; charset=utf-8" }, json: async () => data, ...overrides });
  const call = async (method, route, body, status = 200) => {
    const result = await request(method, route, body, session); assert.equal(result.status, status);
    return result.json();
  };
  const link = await call("POST", "/api/links", { target: "https://192.0.2.1/response-contract", customurl: "response-contract", paused: true }, 201);
  const api = "/api/links/" + link.id;
  const samples = {
    forwarding: await call("GET", api + "/forwarding"), routing: await call("GET", api + "/routing"),
    preview: await call("POST", api + "/routing/preview", { rules: [], context: {} }),
    health: await call("GET", api + "/health"), healthList: await call("GET", "/api/links/health"),
    analytics: await call("GET", "/api/analytics"), tracking: await call("GET", api + "/tracking"),
    retention: await call("GET", "/api/analytics/retention"),
    hookList: await call("GET", "/api/v2/webhooks"), events: await call("GET", "/api/v2/events")
  };
  samples.retentionPreview = await call("POST", "/api/analytics/retention/preview", { days: 0, revision: samples.retention.revision });
  for (const [name, sample] of Object.entries(samples)) {
    const validate = schemas[name]; assert(validate(sample), name + " must accept real server data");
    assert.equal(await read(response(sample), validate), sample);
    assert(validate({ ...sample, future_field: true }), "Additive server fields remain compatible");
    for (const bad of [null, [], "ok", 42, true, {}]) {
      await assert.rejects(read(response(bad), validate), /Unexpected server response/, name);
    }
    for (const field of Object.keys(sample).filter(key => !["fallback", "timezone", "bot_filter", "referrer_basis", "tag_basis"].includes(key))) {
      const missing = { ...sample }; delete missing[field];
      // Only fields consumed by the renderer belong to this client contract.
      if (validate(missing)) continue;
      await assert.rejects(read(response(missing), validate), /Unexpected server response/, name + "." + field);
    }
    for (const override of [
      { redirected: true }, { headers: { get: () => "text/html" } }, { headers: { get: () => null } },
      { headers: { get: () => "application/json-fake" } }, { json: async () => { throw new SyntaxError("PRIVATE_PARSER_DETAIL"); } }
    ]) await assert.rejects(read(response(sample, override), validate), error => /Unexpected server response/.test(error.message) && !error.message.includes("PRIVATE"));
  }
  assert(schemas.preview(await call("POST", api + "/forwarding/preview", { policy: { query_keys: [], path_prefixes: [] }, context: {}, path: "" })));
  const routing = { revision: 1, rules: [{ name: "Mobile", target: "https://example.org/mobile", conditions: { devices: ["mobile"], query: [{ key: "a", op: "equals", value: "b" }] } }] };
  assert(schemas.routing(routing)); assert(!schemas.routing({ ...routing, rules: [{ ...routing.rules[0], conditions: { query: [{}] } }] }));
  assert(!schemas.routing({ ...routing, rules: [null] }));
  assert(!schemas.forwarding({ ...samples.forwarding, query_keys: [null] }));
  const health = { ...samples.health, results: [{ name: "Default", code: "OK", action: "No action needed.", http_status: 204, duration_ms: 1 }] };
  assert(schemas.health(health)); assert(!schemas.health({ ...health, results: [{}] }));
  assert(!schemas.health({ ...health, enabled: "false" })); assert(!schemas.health({ ...health, checked_at: "invalid" }));
  assert(schemas.healthList({ data: [{ ...health, id: link.id, link: link.link }], next: "1" }));
  assert(!schemas.healthList({ data: [null], next: null }));
  assert(!schemas.analytics({ ...samples.analytics, stats: { ...samples.analytics.stats, os: [{}] } }));
  assert(!schemas.analytics({ ...samples.analytics, available_filters: { tags: [], domains: [null] } }));
  assert(!schemas.tracking({ enabled: "false", revision: 0 }));
  assert(!schemas.retention({ ...samples.retention, deleted_buckets: "0" }));
  assert(!schemas.retentionPreview({ ...samples.retentionPreview, confirmation: "private-invalid" }));
  const hook = { id: "synthetic-hook", name: "Test", url: "https://example.org/hook", events: ["link.created"], enabled: false,
    authorization_required: false, revision: 1, created_at: "2026-09-17T00:00:00.000Z", updated_at: "2026-09-17T00:00:00.000Z" };
  assert(schemas.hook(hook)); assert(!schemas.hook({ ...hook, events: [null] }));
  assert(schemas.hookSecret({ ...hook, secret: "whsec_synthetic" })); assert(!schemas.hookSecret(hook));
  assert(!schemas.hookList({ data: [null], event_types: [] }));
  assert(!schemas.events({ data: [{}], cursor: "1" }));
  const omitted = { id: "moderation-event", type: "link.updated", sequence: "1", occurred_at: new Date().toISOString(), data: {}, delivery: { status: "not_queued", reason: "CAPACITY_LIMIT" } };
  assert(schemas.event(omitted));
  assert(!schemas.event({ ...omitted, delivery: { status: "not_queued", reason: "arbitrary-value" } }));
  assert(!schemas.event({ ...omitted, delivery: null }));
  const delivery = { id: "synthetic-delivery", type: "webhook.test", state: "failed", total_attempts: 1, revision: 1,
    created_at: hook.created_at, next_at: null, error: null, http_status: 503 };
  assert(schemas.deliveries({ data: [delivery], next: null })); assert(!schemas.deliveries({ data: [{ ...delivery, total_attempts: "1" }], next: null }));
  await schemas.acknowledgement(response(undefined, { status: 204 }), 204);
  await schemas.acknowledgement(response(undefined, { status: 202, headers: { get: () => "text/plain; charset=utf-8" }, text: async () => "Accepted" }), 202, "Accepted");
  await assert.rejects(schemas.acknowledgement(response({}), 204), /Unexpected server response/);
  await assert.rejects(schemas.acknowledgement(response(undefined, { status: 204, redirected: true }), 204), /Unexpected server response/);
  await assert.rejects(schemas.acknowledgement(response(undefined, { status: 202, text: async () => "<h1>Sign in</h1>" }), 202, "Accepted"), /Unexpected server response/);
  for (const count of [-1, 1.5, NaN, Infinity, "0"]) assert(!schemas.analytics({ ...samples.analytics, total: count }));
  await assert.rejects(read(response({ error: "Not allowed." }, { ok: false, status: 403 }), schemas.health), /Not allowed/);
  await assert.rejects(read(response({ error: { private: "detail" } }, { ok: false, status: 503 }), schemas.health), /Request failed \(503\)/);
  await assert.rejects(read(response({}, { ok: false, status: 409 }), schemas.health, "Reload saved monitoring."), /Reload saved monitoring/);
  console.log("PASS: real editor/analytics/privacy/integration response contracts; malformed JSON, media types, redirects, missing/wrong/nested fields, counts, revisions, additive fields, strict acknowledgements and safe API errors");
};
