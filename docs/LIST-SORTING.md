# Stable List Sorting

The personal links table, administrative links/users/domains tables, Library,
Trash and workspace shared links have labeled **Sort by** and **Direction**
controls. Changing the order resets the page offset, not the page size. Search,
filters, pagination and saved Library filters retain the selected order.

## API

Both `/api` and `/api/v2` accept the same optional scalar query parameters:

| Lists | `sort` values |
| --- | --- |
| `/links`, `/links/admin`, `/library`, `/links/trash`, `/workspaces/:id` | `id`, `created_at`, `address`, `target`, `visit_count` |
| `/users/admin` | `id`, `created_at`, `email`, `links_count` |
| `/domains/admin` | `id`, `created_at`, `address`, `homepage`, `links_count` |

`direction` is `asc` or `desc`. Omission retains the existing `id` / `desc`
insertion order. `id` is the internal insertion sequence, not the public UUID;
`created_at` orders by the stored timestamp, including imported dates.
`address` is the alias/domain, `target` the destination, and `visit_count` the
numeric view count. Ties use the unique internal ID descending. Missing domain
homepages sort last in either direction; link counts sort numerically with
unlinked accounts/domains treated as zero. Text comparison follows the database
collation, not a claimed cross-database locale collation.

Unknown, empty, repeated, structured or incorrectly cased parameters return 400.
Identifiers are mapped from fixed profiles; request input is never SQL syntax.
Sorting does not widen ownership, administrator, workspace or API-token scope.
Total counts are unaffected. This is stable offset pagination, not a frozen
snapshot: concurrent inserts/deletes can still move records between pages.

Example: `GET /api/v2/links?sort=visit_count&direction=desc&limit=20&skip=0`.
Library filter payloads may include `sort` and `direction`; old saved filters
without them keep their former newest-first behavior. Malformed persisted
sorting is rejected rather than interpreted as an SQL column.

## Editing and Recovery

An inline link editor keeps its current position while saving. Sort controls
are disabled while editors are open. List refresh/search/pagination is deferred
until all editors close, retaining the selected sort values. An older in-flight
list response cannot replace an editor or even a pending editor load. Other
unsaved drafts are not discarded by saving/reordering one link.

Workspace candidate search and native mutations preserve normalized list state.
Library mutation errors retain valid return-filter state; deleted or malformed
references fall back to the ordinary list while still showing the action error.

No database migration is required. Older releases ignore these optional fields;
saved filters/data remain intact on rollback, but lists revert to their previous
order. Do not rewrite timestamps or IDs to emulate sorting.

## Verification

- Real SQLite, MySQL 8.4 and PostgreSQL 17 query suites cover every field and
  direction, numeric counts, missing homepages, ties, pagination, total counts,
  owner isolation and hostile/structured input.
- HTTP tests cover both API prefixes, scoped credentials, saved-filter restart,
  workspace access, malformed input and unchanged authentication requirements.
- Disposable browser tests cover 1440/390/320px, admin tab transitions, page reset,
  saved/native state, multiple drafts and delayed list/editor response races.
- Release, backup and deployed acceptance are tracked separately in the
  [community roadmap](COMMUNITY-FEATURE-ROADMAP.md), not inferred from these tests.
