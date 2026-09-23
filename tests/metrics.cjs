const assert = require("node:assert/strict");
const net = require("node:net");
const { randomBytes } = require("node:crypto");
const { writeFileSync, rmSync } = require("node:fs");
const { EventEmitter } = require("node:events");
const path = require("node:path");
const { create, validate, category } = require("../server/metrics");

async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

module.exports = async ({ env, restart, request, session, directory }) => {
  const token = randomBytes(32).toString("hex"), port = await freePort();
  const config = { METRICS_ENABLED: true, METRICS_HOST: "127.0.0.1", METRICS_PORT: port, METRICS_TOKEN: token, NODE_APP_INSTANCE: 0, PORT: 3000 };
  for (const patch of [
    { METRICS_HOST: "localhost" }, { METRICS_HOST: "" }, { METRICS_HOST: "https://example.org" },
    { METRICS_PORT: 0 }, { METRICS_PORT: 80 }, { METRICS_PORT: 65536 }, { METRICS_PORT: 9101.5 },
    { METRICS_TOKEN: "" }, { METRICS_TOKEN: "x".repeat(31) }, { METRICS_TOKEN: "x".repeat(513) },
    { METRICS_TOKEN: "x".repeat(32) + "\n" }, { METRICS_TOKEN: "x".repeat(32) + " " },
    { NODE_APP_INSTANCE: -1 }, { NODE_APP_INSTANCE: 64 }, { NODE_APP_INSTANCE: .5 },
    { METRICS_PORT: 65535, NODE_APP_INSTANCE: 1 }, { PORT: port }
  ]) assert.throws(() => validate({ ...config, ...patch }));
  validate({ ...config, METRICS_HOST: "::1" });
  validate({ ...config, METRICS_HOST: "0.0.0.0" });
  const disabled = create({ METRICS_ENABLED: false });
  let next = false; disabled.middleware({}, {}, () => { next = true; }); assert(next);
  await disabled.start(); await disabled.close();
  assert.equal(category('/api-secret?token=private'), 'redirect');
  assert.equal(category('/api/v2/links/private'), 'api');
  assert.equal(category('/settings/security'), 'management');
  assert.equal(category('/scripts/theme.js'), 'static');
  const metrics = create(config);
  try {
    await metrics.start();
    await assert.rejects(metrics.start(), /already started/);
    const conflict = create(config);
    try { await assert.rejects(conflict.start(), { code: "EADDRINUSE" }); } finally { await conflict.close(); }
    const scrape = (headers = {}, method = "GET", route = "/metrics") => fetch(`http://127.0.0.1:${port}${route}`, { method, headers });
    for (const headers of [{}, { Authorization: "Bearer wrong" }, { Cookie: "token=" + token }, { "X-API-Key": token }, { Authorization: "Basic " + token }, { Authorization: "Bearer " + token + "x" }]) {
      const response = await scrape(headers); assert.equal(response.status, 401); assert.equal(await response.text(), "");
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
    const auth = { Authorization: "Bearer " + token };
    for (const route of ["/", "/metrics/", "/metrics?secret=x", "/api/metrics"]) assert.equal((await scrape(auth, "GET", route)).status, 404);
    for (const method of ["HEAD", "POST", "OPTIONS", "PUT"]) assert.equal((await scrape(auth, method)).status, 404);
    const observe = (url, method, status, aborted = false) => {
      const response = new EventEmitter(); response.statusCode = status; response.writableFinished = !aborted;
      metrics.middleware({ url, method }, response, () => {});
      response.emit(aborted ? "close" : "finish"); response.emit("close");
    };
    for (let index = 0; index < 1000; index++) observe('/private-alias-' + index + '?email=secret@example.invalid&token=' + token, 'GET', 302);
    observe('/api/tokens', 'POST', 401);
    observe('/api/v2/links', 'PUT', 500);
    observe('/settings/security', 'GET', 200);
    observe('/css/styles.css', 'GET', 200);
    observe('/private', 'CUSTOM', 200, true);
    observe('/private', 'DIFFERENT', 999);
    const response = await scrape(auth), body = await response.text();
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^text\/plain; version=0.0.4;/);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.match(body, /kutt_http_requests_total\{route="redirect",method="GET",status="3xx"\} 1000\n/);
    assert.match(body, /kutt_http_requests_total\{route="redirect",method="OTHER",status="aborted"\} 1\n/);
    assert.match(body, /kutt_http_requests_active 0\n/);
    assert.match(body, /kutt_http_request_duration_seconds_bucket\{route="redirect",method="GET",status="3xx",le="\+Inf"\} 1000\n/);
    const buckets = body.split('\n').filter(line => line.startsWith('kutt_http_request_duration_seconds_bucket{route="redirect",method="GET",status="3xx",')).map(line => Number(line.split(' ').at(-1)));
    assert(buckets.every((count, index) => index === 0 || count >= buckets[index - 1]), "Histogram buckets are cumulative");
    assert.equal(body.split('\n').filter(line => line.startsWith('kutt_http_requests_total{')).length, 7);
    assert(!body.includes(token) && !/private-alias|secret@example|\/settings|\/api|NaN|undefined/.test(body));
    for (const line of body.split('\n').filter(line => line && !line.startsWith('#'))) assert(/ [0-9.e+-]+$/.test(line), line);
    assert.equal((await scrape(auth)).status, 200, "Repeated scrapes do not reset counters");
  } finally { await metrics.close(); }
  await assert.rejects(fetch(`http://127.0.0.1:${port}/metrics`));

  // Exercise real middleware placement, separate listener, file precedence and restart.
  const actualPort = await freePort(), secret = path.join(directory, "metrics-token");
  const keys = ["METRICS_ENABLED", "METRICS_HOST", "METRICS_PORT", "METRICS_TOKEN", "METRICS_TOKEN_FILE"];
  const previous = Object.fromEntries(keys.map(key => [key, env[key]]));
  writeFileSync(secret, token + "\n", { mode: 0o600 });
  Object.assign(env, { METRICS_ENABLED: "true", METRICS_HOST: "127.0.0.1", METRICS_PORT: String(actualPort - Number(env.NODE_APP_INSTANCE)), METRICS_TOKEN: "ignored-invalid-value", METRICS_TOKEN_FILE: secret });
  const scrape = headers => fetch(`http://127.0.0.1:${actualPort}/metrics`, { headers });
  try {
    await restart();
    assert.equal((await scrape({ Cookie: "token=" + session })).status, 401);
    assert.equal((await request("GET", "/api/health")).status, 200);
    assert.equal((await request("GET", "/api/links")).status, 401);
    const alias = await request("POST", "/api/links", { customurl: "metrics", target: "https://192.0.2.1/metrics-alias" }, session);
    assert.equal(alias.status, 201);
    const aliasId = (await alias.json()).id;
    try {
      const redirect = await request("GET", "/metrics");
      assert.equal(redirect.status, 302);
      assert.equal(redirect.headers.get("location"), "https://192.0.2.1/metrics-alias");
    } finally { assert([200, 204].includes((await request("DELETE", "/api/links/" + aliasId, undefined, session)).status)); }
    const source = await request("GET", "/metrics", undefined, session, { Authorization: "Bearer " + token });
    assert(!(source.headers.get("content-type") || "").includes('version=0.0.4'), "Public app listener must never serve metrics");
    let body = await (await scrape({ Authorization: "Bearer " + token })).text();
    assert.match(body, /kutt_http_requests_total\{route="api",method="GET",status="2xx"\}/);
    assert.match(body, /kutt_http_requests_total\{route="api",method="GET",status="4xx"\}/);
    assert(!body.includes(session) && !body.includes(token));
    const rotated = randomBytes(32).toString("hex"); writeFileSync(secret, rotated + "\n", { mode: 0o600 });
    await restart();
    assert.equal((await scrape({ Authorization: "Bearer " + token })).status, 401);
    assert.equal((await scrape({ Authorization: "Bearer " + rotated })).status, 200);
  } finally {
    for (const key of keys) { if (previous[key] === undefined) delete env[key]; else env[key] = previous[key]; }
    await restart(); rmSync(secret);
  }
  await assert.rejects(scrape({ Authorization: "Bearer " + token }));
  console.log("PASS: opt-in separate metrics listener, strict configuration, token-file rotation, bounded/private labels, timing counters, restart and public-listener isolation");
};
