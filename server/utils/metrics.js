const { performance } = require("node:perf_hooks");

const latencyBucketsMs = [
  5,
  10,
  25,
  50,
  100,
  250,
  500,
  1000,
  2500,
  5000,
  10000,
];
const latencyBucketsSeconds = latencyBucketsMs.map((value) => value / 1000);

const state = {
  processStartMs: Date.now(),
  inFlight: 0,
  totalRequests: 0,
  totalDurationMs: 0,
  minDurationMs: null,
  maxDurationMs: 0,
  lastDurationMs: 0,
  statusCounts: new Map(),
  bucketCounts: new Array(latencyBucketsMs.length + 1).fill(0),
  successCount: 0,
  errorCount: 0,
};

function observe(durationMs, statusCode) {
  state.totalRequests += 1;
  state.totalDurationMs += durationMs;
  state.lastDurationMs = durationMs;

  if (state.minDurationMs === null || durationMs < state.minDurationMs) {
    state.minDurationMs = durationMs;
  }

  if (durationMs > state.maxDurationMs) {
    state.maxDurationMs = durationMs;
  }

  if (statusCode >= 100 && statusCode < 400) {
    state.successCount += 1;
  } else if (statusCode >= 400) {
    state.errorCount += 1;
  }

  const codeKey = String(statusCode || 0);
  const current = state.statusCounts.get(codeKey) || {
    count: 0,
    totalDurationMs: 0,
    minDurationMs: null,
    maxDurationMs: 0,
  };

  current.count += 1;
  current.totalDurationMs += durationMs;
  if (current.minDurationMs === null || durationMs < current.minDurationMs) {
    current.minDurationMs = durationMs;
  }
  if (durationMs > current.maxDurationMs) {
    current.maxDurationMs = durationMs;
  }
  state.statusCounts.set(codeKey, current);

  let bucketIndex = latencyBucketsMs.findIndex((limit) => durationMs <= limit);
  if (bucketIndex === -1) {
    bucketIndex = latencyBucketsMs.length;
  }
  state.bucketCounts[bucketIndex] += 1;
}

function percentileFromBuckets(percentile) {
  if (state.totalRequests === 0) return 0;
  const target = state.totalRequests * percentile;
  let cumulative = 0;
  for (let i = 0; i < state.bucketCounts.length; i += 1) {
    cumulative += state.bucketCounts[i];
    if (cumulative >= target) {
      if (i >= latencyBucketsMs.length) {
        return latencyBucketsMs[latencyBucketsMs.length - 1];
      }
      return latencyBucketsMs[i];
    }
  }
  return latencyBucketsMs[latencyBucketsMs.length - 1];
}

function snapshot() {
  const now = Date.now();
  const uptimeSeconds = (now - state.processStartMs) / 1000;
  const totalRequests = state.totalRequests;
  const avgDurationMs = totalRequests ? state.totalDurationMs / totalRequests : 0;
  const throughputRps = uptimeSeconds > 0 ? totalRequests / uptimeSeconds : 0;

  const statusCodes = {};
  const successRateByCode = {};
  const errorRateByCode = {};

  for (const [code, data] of state.statusCounts.entries()) {
    const rate = totalRequests ? data.count / totalRequests : 0;
    statusCodes[code] = {
      count: data.count,
      rate,
      avg_response_time_ms: data.count ? data.totalDurationMs / data.count : 0,
      min_response_time_ms: data.minDurationMs ?? 0,
      max_response_time_ms: data.maxDurationMs,
    };
    const numericCode = Number(code);
    if (numericCode >= 100 && numericCode < 400) {
      successRateByCode[code] = rate;
    } else if (numericCode >= 400) {
      errorRateByCode[code] = rate;
    }
  }

  const latencyBuckets = {};
  latencyBucketsMs.forEach((limit, index) => {
    latencyBuckets[`le_${limit}`] = state.bucketCounts[index];
  });
  latencyBuckets[`gt_${latencyBucketsMs[latencyBucketsMs.length - 1]}`] =
    state.bucketCounts[state.bucketCounts.length - 1];

  return {
    timestamp: new Date(now).toISOString(),
    uptime_seconds: uptimeSeconds,
    in_flight: state.inFlight,
    totals: {
      requests: totalRequests,
      success: state.successCount,
      error: state.errorCount,
    },
    throughput_rps: throughputRps,
    throughput_rpm: throughputRps * 60,
    response_time_ms: {
      avg: avgDurationMs,
      min: state.minDurationMs ?? 0,
      max: state.maxDurationMs,
      p50: percentileFromBuckets(0.5),
      p90: percentileFromBuckets(0.9),
      p95: percentileFromBuckets(0.95),
      last: state.lastDurationMs,
    },
    status_codes: statusCodes,
    success_rate_by_code: successRateByCode,
    error_rate_by_code: errorRateByCode,
    latency_buckets_ms: latencyBuckets,
  };
}

function middleware({ ignorePaths = [] } = {}) {
  const ignored = new Set(ignorePaths);
  return function metricsMiddleware(req, res, next) {
    if (ignored.has(req.path)) {
      next();
      return;
    }

    const start = performance.now();
    let finished = false;
    state.inFlight += 1;

    const done = () => {
      if (finished) return;
      finished = true;
      state.inFlight = Math.max(0, state.inFlight - 1);
      const durationMs = Math.max(0, performance.now() - start);
      observe(durationMs, res.statusCode);
    };

    res.once("finish", done);
    res.once("close", done);
    next();
  };
}

function prometheusText() {
  const snap = snapshot();
  const lines = [];

  const push = (line) => {
    lines.push(line);
  };

  const formatLabels = (labels) => {
    const entries = Object.entries(labels);
    if (entries.length === 0) return "";
    const formatted = entries
      .map(([key, value]) => `${key}="${String(value).replace(/"/g, '\\"')}"`)
      .join(",");
    return `{${formatted}}`;
  };

  const addMetric = (name, type, help, value, labels = {}) => {
    if (help) push(`# HELP ${name} ${help}`);
    if (type) push(`# TYPE ${name} ${type}`);
    push(`${name}${formatLabels(labels)} ${value}`);
  };

  addMetric(
    "http_server_requests_in_flight",
    "gauge",
    "Number of in-flight HTTP requests.",
    snap.in_flight
  );
  addMetric(
    "http_server_requests_total",
    "counter",
    "Total number of HTTP requests.",
    snap.totals.requests
  );
  addMetric(
    "http_server_requests_success_total",
    "counter",
    "Total number of successful HTTP requests (status < 400).",
    snap.totals.success
  );
  addMetric(
    "http_server_requests_error_total",
    "counter",
    "Total number of error HTTP requests (status >= 400).",
    snap.totals.error
  );
  addMetric(
    "http_server_requests_throughput_rps",
    "gauge",
    "HTTP requests per second since process start.",
    snap.throughput_rps
  );
  addMetric(
    "http_server_requests_throughput_rpm",
    "gauge",
    "HTTP requests per minute since process start.",
    snap.throughput_rpm
  );

  push("# HELP http_server_requests_seconds Request duration in seconds.");
  push("# TYPE http_server_requests_seconds histogram");
  let cumulative = 0;
  latencyBucketsSeconds.forEach((limit, index) => {
    cumulative += state.bucketCounts[index];
    push(
      `http_server_requests_seconds_bucket${formatLabels({
        le: limit,
      })} ${cumulative}`
    );
  });
  push(
    `http_server_requests_seconds_bucket${formatLabels({
      le: "+Inf",
    })} ${snap.totals.requests}`
  );
  push(`http_server_requests_seconds_sum ${state.totalDurationMs / 1000}`);
  push(`http_server_requests_seconds_count ${snap.totals.requests}`);

  addMetric(
    "http_server_requests_seconds_last",
    "gauge",
    "Last HTTP response time in seconds.",
    snap.response_time_ms.last / 1000
  );
  addMetric(
    "http_server_requests_seconds_min",
    "gauge",
    "Minimum HTTP response time in seconds.",
    snap.response_time_ms.min / 1000
  );
  addMetric(
    "http_server_requests_seconds_max",
    "gauge",
    "Maximum HTTP response time in seconds.",
    snap.response_time_ms.max / 1000
  );
  addMetric(
    "http_server_requests_seconds_avg",
    "gauge",
    "Average HTTP response time in seconds.",
    snap.response_time_ms.avg / 1000
  );
  addMetric(
    "http_server_requests_seconds_p50",
    "gauge",
    "50th percentile HTTP response time in seconds.",
    snap.response_time_ms.p50 / 1000
  );
  addMetric(
    "http_server_requests_seconds_p90",
    "gauge",
    "90th percentile HTTP response time in seconds.",
    snap.response_time_ms.p90 / 1000
  );
  addMetric(
    "http_server_requests_seconds_p95",
    "gauge",
    "95th percentile HTTP response time in seconds.",
    snap.response_time_ms.p95 / 1000
  );

  for (const [code, data] of Object.entries(snap.status_codes)) {
    addMetric("http_server_requests_total", null, null, data.count, { code });
    addMetric(
      "http_server_requests_seconds_avg",
      "gauge",
      "Average request duration by HTTP status code in seconds.",
      data.avg_response_time_ms / 1000,
      { code }
    );
    addMetric(
      "http_server_requests_seconds_min",
      "gauge",
      "Minimum request duration by HTTP status code in seconds.",
      data.min_response_time_ms / 1000,
      { code }
    );
    addMetric(
      "http_server_requests_seconds_max",
      "gauge",
      "Maximum request duration by HTTP status code in seconds.",
      data.max_response_time_ms / 1000,
      { code }
    );
  }

  for (const [code, rate] of Object.entries(snap.success_rate_by_code)) {
    addMetric(
      "http_server_requests_rate",
      "gauge",
      "Success or error rate per HTTP status code.",
      rate,
      { code, kind: "success" }
    );
  }

  for (const [code, rate] of Object.entries(snap.error_rate_by_code)) {
    addMetric(
      "http_server_requests_rate",
      "gauge",
      "Success or error rate per HTTP status code.",
      rate,
      { code, kind: "error" }
    );
  }

  return `${lines.join("\n")}\n`;
}

module.exports = {
  middleware,
  snapshot,
  prometheusText,
};
