# Analytics privacy

Released and deployment-verified as `v3.2.6-sr94.12` on 2026-09-14. Source and
hardened-image tests, desktop/mobile workflows, a fresh NAS backup restore,
public WAF checks, real Authentik logout and post-restart health checks passed.
Production retention remains disabled; destructive tests use disposable data.

## Per-link tracking

Open the shield action (Tracking settings) on a link. Record analytics defaults
to enabled, preserving existing behavior. Turning it off stops new analytics
and displayed visit-count increments. Public redirects, passwords, routing and
operational redirect quotas still work. Existing analytics are not deleted.
Proxy/WAF logs, backups and previously queued payloads are separate stores;
this switch is not a retroactive erasure request or a promise of anonymous logs.

`GET /api[/v2]/links/{uuid}/tracking` returns `id`, `address`, `enabled` and
`revision`. `PUT` accepts exactly `{ "enabled": false, "revision": 0 }`, using
the most recent revision. Concurrent/stale changes return 409 and require reload.
Native pages require a session. Scoped API tokens need `links:read` for GET and
`links:update` for PUT. Owner, domain, revocation and same-origin checks apply;
neither administrator status nor workspace membership overrides ownership.
Trashed links/archived domains must be restored before changing settings.

The request handler checks the policy before enqueueing. Jobs carry the tracking
revision; the worker checks it again, then the aggregate transaction locks the
link and rechecks before incrementing counters. Opt-out followed by opt-in never
replays earlier tracking generations. Legacy jobs without a revision work only
on links whose privacy policy has never changed. Policy lookup failure skips
analytics instead of breaking the public redirect. Existing in-flight requests
that commit before the opt-out transaction remain recorded. Redis delivery still
does not promise exactly-once processing; completed jobs follow existing cleanup.

CSV/JSON exports include `tracking_enabled`. Opt-outs survive imports, which
require `links:update` as well as `links:create` when using a scoped token.
Legacy imports without the field keep tracking enabled. Old importers that do
not recognize this field must reject it, not silently strip privacy choices.

## Retention

Settings > Analytics retention is available only to a current, verified, unbanned
administrator **browser session**. API keys cannot manage instance-wide retention,
even when an administrator cookie accompanies them. Retention defaults to disabled.

Choose Keep all analytics or a rolling retention duration of 1-36500 days. Preview
shows the current UTC cutoff and eligible hourly-bucket count. Enabling deletion
requires explicit acknowledgement. Apply uses a signed five-minute receipt bound
to the administrator/authentication version, proposed duration and current policy
revision. Changing the draft invalidates the displayed confirmation. A stale,
expired, tampered or cross-account receipt cannot change policy. No deletion
occurs synchronously in the save request.

Routes under `/api[/v2]/analytics/retention`:

| Method/path | Contract |
| --- | --- |
| `GET` | `days`, `revision`, `last_run`, `deleted_buckets`, `last_error` |
| `POST /preview` | `{ "days": 30, "revision": 0 }`; returns cutoff, eligible bucket count and signed `confirmation` |
| `PUT` | `{ "confirmation": "<receipt>", "acknowledge_deletion": true }`; acknowledgement required when days > 0 |

`days: 0` disables future deletion; it cannot recover previously removed data.
Responses are private/no-store. Preview/save are rate limited, same-origin and
freshly authorized. Receipts must not be logged or checked into source control.

The primary process (`NODE_APP_INSTANCE=0`, or the normal non-cluster process)
runs retention at startup and every minute. Each run processes at most ten
500-row batches. Each transaction locks/rechecks the singleton policy and deletes
only hourly `visits` buckets strictly older than UTC midnight minus the duration.
The rolling cutoff advances daily; the preview is a snapshot, not a fixed deletion
list. A failed batch rolls back; earlier committed batches remain deleted.
Retries resume on the next tick without changing links or lifetime counters.
Disabling policy takes effect between batches. Multiple processes serialize on
the same row. Status reports sanitized failures and last successful batch time.
All-link reports can consequently differ from lifetime counters.

Legacy statistics stop using their 60-second Redis cache after the first retention
policy change, including after disabling retention again. Inaccessible old cache
entries expire normally; fresh requests do not serve purged aggregates. The new
range-report API is already uncached. Backups and exported reports have independent
retention and may still contain deleted analytics; operators must manage them
separately according to their retention requirements.

## Migration, backup and rollback

`20260914050000_analytics_privacy` adds per-link tracking/revision rows and an
instance-wide retention singleton. Up migration is additive and starts disabled;
it does not alter existing links, users, credentials or visits. Downgrade is
allowed only for untouched policy tables. Any tracking decision or retention
revision makes downgrade refuse to discard policy or queued-job generations.

**Do not roll back only the image after using these controls.** Older versions
ignore the new tables and may resume tracking despite an opt-out. Prefer a tested
fix-forward release. A rollback needs a compatible backup, write reconciliation
and explicit review of privacy changes and queue contents since that backup.
Never delete policy rows or lower revisions just to bypass the migration guard.
A backup restore can resurrect old analytics; assess retention before allowing
traffic and before restarting retention. Preserve current SQLite/WAL/SHM data and
use the consistent backup helper rather than copying a live SQLite file alone.

`tests/privacy.cjs` covers owner/admin/token/domain/CSRF boundaries, revisions,
legacy/stale queue suppression, transactional rechecks, public quotas, malformed
policy fail-closed behavior, CSV/JSON preservation, signed acknowledgement,
UTC cutoff, bounded batches, cache exclusion, purge failure/recovery, restart
and guarded downgrade. `tests/browser-privacy.cjs` exercises native desktop/mobile
controls, conflicts, previews, acknowledgement, in-flight editing protection and
error/retry/reload states on a fresh disposable loopback instance only. Production
acceptance must never enable deletion merely to test it against real-user data.
