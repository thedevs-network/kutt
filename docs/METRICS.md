# Private Performance Metrics

Metrics are off by default. They use a separate HTTP listener, not an application
route. Existing `/metrics` short links retain their ordinary alias behavior.
Enabling monitoring does not grant access to links, accounts or management.

## Configuration

| Setting | Default | Meaning |
| --- | --- | --- |
| `METRICS_ENABLED` | `false` | Enable the separate listener and observation. |
| `METRICS_HOST` | `127.0.0.1` | Literal IPv4/IPv6 bind address; no hostname lookup. |
| `METRICS_PORT` | `9101` | Base unprivileged port; actual port is base plus `NODE_APP_INSTANCE`. |
| `METRICS_TOKEN_FILE` | Unset | Recommended secret file containing an independently generated bearer token. |
| `METRICS_TOKEN` | Empty | Alternative token; the file takes precedence. |

The token must contain 32-512 non-space ASCII characters. Generate at least 32
random bytes (for example `openssl rand -hex 32`) and protect the file with mode
`0600`. Never use a JWT secret, OIDC client secret or an account API key. Missing,
invalid or unreadable configured material fails startup. Listen failures also
fail startup; monitoring must not silently appear enabled while unavailable.

Only `GET /metrics` with exactly `Authorization: Bearer <token>` returns data.
Query parameters, alternate paths/methods, browser cookies and Kutt API keys are
not accepted. Responses are non-cacheable and do not enable CORS. No token or
request header is returned in diagnostics. Comparison uses fixed-length hashes
and constant-time comparison.

Use a private Docker network and do **not** publish this port on the host or add
a public reverse-proxy route. A collector in another container requires the
explicit `METRICS_HOST=0.0.0.0` setting and a shared private network. It still
requires the bearer token. Do not send the token across an untrusted network;
use a protected tunnel or an authenticated, verified-TLS transport there.

Example private Prometheus scrape configuration:

```yaml
scrape_configs:
  - job_name: kutt-performance
    scrape_interval: 30s
    authorization:
      type: Bearer
      credentials_file: /run/secrets/kutt_metrics_token
    static_configs:
      - targets: [kutt:9101]
```

For several workers, assign distinct integer `NODE_APP_INSTANCE` values from
0 to 63 and scrape each actual port, not a load-balanced service address. All
histories are process-local: restarts reset counters. Sum rates across workers;
sum histogram buckets by `le` before calculating aggregate quantiles. A single
worker scrape is not whole-cluster coverage. Identical worker indices sharing
a network namespace conflict and fail startup rather than returning partial data.

## Data Contract

- `kutt_http_requests_total`: finished/aborted requests, including static assets.
- `kutt_http_request_duration_seconds`: cumulative histogram, seconds through
  response completion/abort, not only server handler time. Fixed buckets from
  5ms through 10s plus infinity. Slow clients therefore affect this measurement.
- `kutt_http_requests_active`: in-flight requests.
- `kutt_process_uptime_seconds`, resident/heap memory bytes and cumulative
  user/system CPU seconds: this application worker only.
- `kutt_event_loop_delay_mean_seconds` and `_max_seconds`: sampled at 20ms,
  accumulated since listener start, not reset by scrapes. Initially zero until
  samples exist. These are not interval quantiles.

HTTP labels have fixed sets: four coarse routes (`api`, `management`, `static`,
`redirect`), seven standard methods plus `OTHER`, and five status classes plus
`aborted`/`other`. At most 224 combinations exist; only observed combinations
are emitted. No path, URL, alias, query, target, user/domain ID, email, host,
referer, user agent, IP, credential, database row or release tag is a label.
The fixed category names describe URL surfaces, not authentication outcomes.
Scrapes themselves are not included in application HTTP counters.

This complements rather than replaces readiness, external redirect/SSO probes,
backup age/recovery checks, worker/queue checks and destination-health monitoring.
It does not query the database or perform outbound requests.

## Rotation, Rollback and Tests

Update the dedicated secret on application and collector, then restart/reload
both with the new file. Old tokens stop working after application restart;
there is no dual-token grace period. A temporary scrape failure during rotation
is preferable to indefinitely accepting revoked credentials.

Disable metrics and remove its private scrape target to roll back. There is no
schema migration, account change or persisted application data to undo. Retain
the existing monitoring collector/probes until replacements have been verified.

`tests/metrics.cjs` runs in the full isolated container suite; focused execution
uses `KUTT_TEST_ONLY=metrics`. It tests configuration, bind conflicts, disabled
mode, credentials/methods/paths, fixed-cardinality labels, private outputs,
counter/histogram values, file precedence, rotation and the real public/private
listener boundary. No deployed credential is used by the test.
