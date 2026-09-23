# Opt-in destination monitoring

Roadmap item 15 shipped in `v3.2.6-sr94.15`. Publication, restore, production,
rendered-UI and post-restart evidence is recorded in [the roadmap](FEATURE-ROADMAP.md).

## Owner workflow

Open **Destination health** from a link's actions or Library. Monitoring starts
disabled. Enable it, choose an interval (1 to 168 hours), then save. **Check now**
queues an asynchronous cycle; reload for results. The **Destination monitoring**
page in Settings lists your configured links with attention and overdue states.
Conflicts preserve the draft; reload deliberately before saving again.

The worker checks the default destination and every saved redirect-rule target,
deduplicating identical URLs within the cycle. It does not exercise arbitrary
visitor-forwarded paths or query values. No redirect, link pause, destination,
password, quota, analytics or DNS setting is changed automatically. A failing
check does not mean that browsers cannot use the link: restricted sites and
servers without HEAD support require manual verification.

## Network and authorization boundaries

Only public HTTPS on port 443 is eligible. URL credentials, IP literals, local
hostnames and credential-like query names are refused. Fragments are removed
because they are not transmitted in HTTP. Owners should not enable monitoring
on links containing other sensitive path/query data; ordinary URL data must be
sent to that destination to make the request.

Every request resolves and validates all A/AAAA answers, refuses private,
loopback, link-local, multicast and reserved ranges, and pins one validated IP on
the TLS socket while checking the original hostname/certificate. No environment
proxy, pooled connection, alternate credentials or certificate bypass is used.
Only HEAD is sent, with a fixed user agent, no cookies, no request body, no GET
fallback and no redirect following. Response bodies and Location headers are not
retained. DNS is bounded to 3 seconds and HTTPS to 10 seconds, with an 8 KiB
response-header limit. These controls follow the
[OWASP SSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)
and use [Node's HTTPS socket options](https://nodejs.org/api/https.html).

Configuration and results are private to the owner, not every administrator or
workspace editor. Scoped tokens require `links:read` for reads or `links:update`
for changes/queueing; domain restrictions and session CSRF checks apply. A token
may configure persistent monitoring: revoking that token blocks further API use,
but does not undo an owner's saved schedule. Disable monitoring to stop it.
Owner auth-version changes, bans, deletion, domain revocation and link retirement
stop further probes. When the worker detects this, it disables the schedule and
increments its revision; recovery does not silently resume it. A current owner
must explicitly re-enable it. Retired links therefore cannot leave invisible,
perpetually retrying jobs. Current authority, policy revision, source hash and lease
are rechecked before each request and before saving its result. An already-sent
HEAD may finish during revocation; its stale result is discarded.

## Limits and operational states

At most 100 links per owner can be enabled. Across workers, a database gate admits
at most one cycle per minute, with at most 21 serial HEADs per cycle. A ten-minute
lease recovers after a crash; manual requests are limited to one per link per
minute. A due check may wait behind other owners, so intervals are targets, not
an uptime SLA. Delays over 15 minutes are reported as overdue. Do not run duplicate
primaries to increase throughput; review capacity first.

Only primary process `NODE_APP_INSTANCE=0` (or unset) runs the ten-second timer.
No extra service or public listener is needed. Restart resumes the persisted
queue. Errors retry on subsequent intervals and log a generic message without
URLs. Invalid rules fail closed, release the lease, and show a repair message.

| Result | Meaning and action |
| --- | --- |
| Healthy / OK | All checked targets returned 2xx |
| REDIRECT | 3xx; inspect the final destination manually |
| ACCESS_RESTRICTED | 401/403/429; assess access or bot restrictions |
| HEAD_UNSUPPORTED | 405/501; verify manually, no automatic GET |
| HTTP_ERROR | Other HTTP failure; check the destination service |
| URL_DENIED / ADDRESS_DENIED | Policy refusal; correct the URL/DNS or leave monitoring disabled |
| DNS_FAILED / TIMEOUT / CONNECTION_FAILED | Inspect resolution, service health or TLS; retry later |
| Stale / authorization required | Source changed or owner authorization changed; review then save |

Status transitions generate private `link.health_changed` events and signed
asynchronous webhooks for subscribed owners. Configuration generates
`link.health_configured`. Payloads contain the link UUID and changed field names,
never URLs, query values or response bodies. Retrieve details with owner-scoped
GET. Webhook receiver security and retries are unchanged.

Operators can run `node scripts/destination-health.cjs` inside the container
with its normal `DB_FILENAME` or `DB_FILENAME_FILE`. It also loads the local
`.env`, honors `DB_CLIENT_FILE`, refuses non-SQLite databases and never creates
a missing file. This read-only SQLite probe emits aggregate JSON:
`worker_age_seconds` (-1 if never started), `enabled`, `attention`, and `overdue`.
No IDs or targets are exported. Alert on command failure, age over 180 seconds,
or nonzero attention/overdue; a negative age is not a healthy zero. The homelab
adapter and tested alert evidence are documented in the deployment repository.

## API

Both `/api` and `/api/v2` support:

| Route | Body / response |
| --- | --- |
| GET `/links/health?before=ID` | Owner/domain-filtered list, 50 per page, opaque numeric `next` cursor |
| GET `/links/{uuid}/health` | Configuration, revision, state, timestamps, safe result/action list |
| PUT `/links/{uuid}/health` | `{"enabled":true,"interval_hours":24,"revision":0}`; next revision |
| POST `/links/{uuid}/health/check` | `{"revision":1}`; 202 queued, not a synchronous result |

400 invalid input; 401/403 authentication/scope denial; 404 other owner/domain;
410 retired link; 409 conflicting revision/disabled config; 429 queued too
recently/already running. Unreadable results are hidden with `results_unavailable`
so the owner can still queue a new check or disable monitoring. Responses use private/no-store.
The pages `/link/health/{uuid}` and `/settings/health` require a browser session.

## Migration and recovery

`20260914080000_destination_health` adds `link_health` and `health_worker`; existing
links are neither modified nor automatically probed. Down migration refuses any
configured monitor. Full consistent database backups preserve authorization,
leases, schedules, revisions and results. CSV/JSON link transfers intentionally
do not silently enable background network requests on the receiving instance;
configure monitoring explicitly after an import.

Restore database and application secrets with the exact release image, isolated
from outbound networking until ownership and destinations are reviewed. Expired
leases retry after restart. A health HEAD has no application mutation, but the
destination may log it; do not promise exactly-once network delivery. Older
images do not run this monitoring. Prefer fix-forward rather than dropping
tables or using an image-only downgrade; reconcile any snapshot rollback with
links created since the snapshot.

Tests cover transport policy, owner/domain/scoped/CSRF boundaries, revisions,
rollback, crashes, stale results, revocation, unchanged redirects/counters,
classification and desktop/mobile workflows. Production checks remain distinct
from offline/mock tests and do not infer a customer's destination is healthy.
