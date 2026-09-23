# Visit Aggregation Performance

## Decision

Keep visits durably aggregated in the existing transaction, not in a new in-memory
batch. The link-row write serializes concurrent workers, and both the displayed
counter and hourly aggregate commit together. Tracking revision checks, bans,
deleted-link checks, Redis queue behavior and bounded referrers remain unchanged.

An isolated SQLite profile with 25,000 historical hourly rows found the current
hour lookup was scanning a link's history. A compound expression index on
`(link_id, strftime('%Y-%m-%d %H:00:00', created_at))` supports the existing query.
The fixed SQLite format is now a literal in generated SQL so SQLite can recognize
the indexed expression; all user values remain bound parameters.

This deliberately retains SQLite's existing UTC parsing, including historical SQL
timestamps, ISO timestamps, offsets and fractional seconds. A simple lexical range
over `created_at` would not preserve all these cases. No aggregate, stored timestamp,
country count or historical row is rewritten. MySQL/PostgreSQL retain their existing
query behavior; this migration is a no-op on those engines.

## Deployment And Recovery

The additive migration builds `visits_link_utc_hour_index` on SQLite. Index creation
takes disk space and a schema write lock, so back up first, confirm free space, and
schedule migration for a quiet window on large installations. Do not replace a live
database with a synthetic benchmark or compact/delete history to improve timing.

The old application can use the database with the extra index present. Image-only
rollback retains all visits. The migration's `down` removes only this index, with no
data rewrite; prefer leaving the harmless index when rolling back application code.

No new timer, buffer, queue, secret, endpoint or package is required. Redirect API
and UI behavior are unchanged. Public redirects still do not require management
authentication; analytics access remains owner/scoped.

## Evidence

The disposable profile records environment, query plans and median/p95 timings;
these are local synthetic measurements, not a production latency promise. The
pre-change profile on Node 24.21 used 100 lookups and 100 aggregate writes with
16 concurrent additional visits. It measured approximately 4.92 ms median for the
old scan. A same-run comparison measured 5.176 ms median and 5.627 ms p95 for
the legacy lookup, versus 0.0745 ms median and 0.211 ms p95 with the expression
index. Transactional aggregation measured 0.259 ms median and 0.626 ms p95.
Exact totals remained 25,116 after 100 sequential and 16 concurrent writes.
These are synthetic SQLite results, not homelab measurements. Real PostgreSQL 17
and MySQL 8.4 compatibility/concurrency/privacy tests passed. No batching was
justified or introduced.

Reproduce in an isolated image with no network or data mounts:

```sh
docker run --rm --network none --read-only --tmpfs /tmp:mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges:true \
  -e KUTT_PROFILE_DISPOSABLE=1 --entrypoint node IMAGE tests/profile-visits.cjs
```

`tests/visit-hour-index.cjs` asserts actual indexed query selection, equivalent
results across migration rollback/reapply, UTC/ISO/offset hour boundaries, retained
rows, exact concurrent totals, privacy revision rejection and ban rejection. It runs
in the normal SQLite container suite and the disposable MySQL/PostgreSQL fixtures.
Existing Redis restart and privacy regressions continue to exercise durability and
revocation behavior. No new UI acceptance claim is needed for this invisible query
optimization; existing analytics and redirect browser tests remain required.
