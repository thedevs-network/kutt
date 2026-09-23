const http = require("node:http");
const net = require("node:net");
const { createHash, timingSafeEqual } = require("node:crypto");
const { monitorEventLoopDelay } = require("node:perf_hooks");

const bounds = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const methods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]);
const hash = value => createHash("sha256").update(value).digest();

function validate(env) {
  if (!env.METRICS_ENABLED) return;
  if (!net.isIP(env.METRICS_HOST)) throw new Error("METRICS_HOST must be an IP bind address.");
  if (!Number.isInteger(env.METRICS_PORT) || env.METRICS_PORT < 1024 || env.METRICS_PORT > 65535) throw new Error("METRICS_PORT must be an unprivileged TCP port.");
  if (!Number.isInteger(env.NODE_APP_INSTANCE) || env.NODE_APP_INSTANCE < 0 || env.NODE_APP_INSTANCE > 63 || env.METRICS_PORT + env.NODE_APP_INSTANCE > 65535) throw new Error("Metrics require a unique worker index from 0 to 63 within the port range.");
  if (env.METRICS_PORT + env.NODE_APP_INSTANCE === env.PORT) throw new Error("Metrics must use a separate listener from the application.");
  if (typeof env.METRICS_TOKEN !== "string" || !/^[!-~]{32,512}$/.test(env.METRICS_TOKEN)) throw new Error("METRICS_TOKEN must contain 32 to 512 non-space ASCII characters.");
}

// These fixed categories intentionally never include Express paths or user input.
function category(url) {
  const pathname = String(url || "").split("?", 1)[0];
  if (/^\/api(?:\/|$)/i.test(pathname)) return "api";
  if (/^\/(?:admin|settings|login|register|reset-password|verify|link)(?:\/|$)/i.test(pathname) || pathname === "/") return "management";
  if (/^\/(?:scripts|css|images)(?:\/|$)/i.test(pathname)) return "static";
  return "redirect";
}

function create(env) {
  validate(env);
  if (!env.METRICS_ENABLED) return { middleware: (req, res, next) => next(), start: async () => {}, close: async () => {} };
  const expected = hash(env.METRICS_TOKEN), samples = new Map();
  const delay = monitorEventLoopDelay({ resolution: 20 });
  let active = 0, listener;
  const middleware = (req, res, next) => {
    const start = process.hrtime.bigint(), route = category(req.url);
    const method = methods.has(req.method) ? req.method : "OTHER";
    let recorded = false;
    active++;
    const record = aborted => {
      if (recorded) return;
      recorded = true; active--;
      const code = Math.floor(res.statusCode / 100);
      const status = aborted ? "aborted" : code >= 1 && code <= 5 ? code + "xx" : "other";
      const key = `route="${route}",method="${method}",status="${status}"`;
      const row = samples.get(key) || { count: 0, sum: 0, buckets: bounds.map(() => 0) };
      const seconds = Number(process.hrtime.bigint() - start) / 1e9;
      row.count++; row.sum += seconds;
      bounds.forEach((bound, index) => { if (seconds <= bound) row.buckets[index]++; });
      samples.set(key, row);
    };
    res.once("finish", () => record(false));
    res.once("close", () => record(!res.writableFinished));
    next();
  };
  const render = () => {
    const lines = [
      "# HELP kutt_http_requests_total Finished or aborted application requests.",
      "# TYPE kutt_http_requests_total counter",
      ...[...samples].map(([key, row]) => `kutt_http_requests_total{${key}} ${row.count}`),
      "# HELP kutt_http_request_duration_seconds Application request duration including aborted requests.",
      "# TYPE kutt_http_request_duration_seconds histogram"
    ];
    for (const [key, row] of samples) {
      bounds.forEach((bound, index) => lines.push(`kutt_http_request_duration_seconds_bucket{${key},le="${bound}"} ${row.buckets[index]}`));
      lines.push(`kutt_http_request_duration_seconds_bucket{${key},le="+Inf"} ${row.count}`,
        `kutt_http_request_duration_seconds_sum{${key}} ${row.sum}`, `kutt_http_request_duration_seconds_count{${key}} ${row.count}`);
    }
    const memory = process.memoryUsage(), cpu = process.cpuUsage();
    const metric = (name, type, value, help) => lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, `${name} ${Number.isFinite(value) ? value : 0}`);
    metric("kutt_http_requests_active", "gauge", active, "Currently active application requests.");
    metric("kutt_process_uptime_seconds", "gauge", process.uptime(), "Uptime of this application worker.");
    metric("kutt_process_resident_memory_bytes", "gauge", memory.rss, "Resident memory of this application worker.");
    metric("kutt_process_heap_used_bytes", "gauge", memory.heapUsed, "JavaScript heap used by this application worker.");
    metric("kutt_process_cpu_user_seconds_total", "counter", cpu.user / 1e6, "User CPU seconds of this application worker.");
    metric("kutt_process_cpu_system_seconds_total", "counter", cpu.system / 1e6, "System CPU seconds of this application worker.");
    metric("kutt_event_loop_delay_mean_seconds", "gauge", delay.mean / 1e9, "Mean event loop delay since the metrics listener started.");
    metric("kutt_event_loop_delay_max_seconds", "gauge", delay.max / 1e9, "Maximum event loop delay since the metrics listener started.");
    return lines.join("\n") + "\n";
  };
  const start = async () => {
    if (listener) throw new Error("Metrics listener already started.");
    listener = http.createServer({ maxHeaderSize: 4096 }, (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (req.method !== "GET" || req.url !== "/metrics") { res.writeHead(404); res.end(); return; }
      const authorization = req.headers.authorization;
      if (typeof authorization !== "string" || !authorization.startsWith("Bearer ") || !timingSafeEqual(hash(authorization.slice(7)), expected)) {
        res.setHeader("WWW-Authenticate", 'Bearer realm="kutt-metrics"');
        res.writeHead(401); res.end(); return;
      }
      res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
      res.end(render());
    });
    listener.requestTimeout = 5000; listener.headersTimeout = 5000;
    listener.keepAliveTimeout = 1000; listener.maxRequestsPerSocket = 10;
    await new Promise((resolve, reject) => {
      listener.once("error", reject);
      listener.listen(env.METRICS_PORT + env.NODE_APP_INSTANCE, env.METRICS_HOST, () => { listener.removeListener("error", reject); resolve(); });
    });
    delay.enable();
  };
  const close = async () => {
    delay.disable();
    if (listener) { listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)); listener = undefined; }
  };
  return { middleware, start, close };
}

module.exports = { validate, create, category };
