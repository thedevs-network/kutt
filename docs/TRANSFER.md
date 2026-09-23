# CSV and JSON transfer

Open **Library > Import and export**. Download your own links as JSON or CSV,
optionally searching an alias/target and selecting not-trashed, trashed or all links.
Exports include lifecycle restrictions, spent redirect counts and private tags
and collections, ordered routing rules and explicit forwarding allowlists. They never contain password hashes, credentials or ownership
identifiers. Downloads are private, uncached attachments.

Import a file or paste its contents, choose an alias-conflict policy and run a
dry run. Review every row before confirming. Editing input invalidates the
preview. Confirmation is bound to the input, account, scoped-token ID and domain
restriction, expires after 20 minutes, and rechecks availability and permissions.
Browser sessions and legacy API keys use the same account-level credential
bucket; rotating a legacy key alone does not invalidate an otherwise valid
preview for that account. Prefer individually revocable scoped tokens.

- **Abort batch**: any conflicting alias prevents the whole import.
- **Skip conflicting rows**: existing or retired aliases are skipped unchanged.
- **Generate new aliases**: conflicts receive deterministic new aliases shown in
  the preview. Existing links are never overwritten or reassigned.

Imports create new links owned by the importing account. Original IDs are
informational and never reused. Banned links are rejected. Custom domains must
remain active and be owned by, or explicitly granted to, the importing account.
Entitlement is rechecked on confirmation and idempotent replay. Retired custom-domain exports
retain their original host; they are never silently imported into the default
domain. HTTP(S) targets only, with no embedded credentials. There are no HTTP
requests to destinations; existing domain/host ban checks still apply.

Protected links export `password_required: true`, not their password. Supply an
explicit `password` (3-64 characters) before importing such a row, including a
row that might be skipped. The server hashes it before storing. Never remove
that protection marker just to pass validation unless you deliberately intend a
public link. Treat export/import files as private: destination URLs themselves
may contain sensitive information. Do not commit them or paste passwords into
issue reports.

## Limits and formats

The import page has JSON and CSV template downloads. Each contains one generic,
paused sample link and no account data; edit its alias/destination before preview.
The sample does not create anything until explicit confirmation. Missing/unsupported
JSON structure and malformed CSV report an actionable format message. CSV cell
conversion errors identify the data-row number and field; parser line numbers,
when available, are physical lines (including the header and quoted newlines).
Error messages never echo cell contents or parser exception details.
Invalid input remains available for correction; choosing an oversized or unreadable
file does not replace the existing content or format. Import submission stays
disabled until its script is ready, and the form never submits private content
as a URL query string.

An export contains at most 1,000 links; narrow the search if it exceeds that.
Import batches contain 1-100 links, UTF-8 content at most 900,000 bytes, and CSV
records at most 100,000 characters and at most 100 distinct destination hosts
per import batch (including routing targets). Split larger exports into separate batches.
These are management transfers, **not full application backups**: users,
credentials, statistics, identities, history and saved filters are not imported.
Account limits are 100 successful batches per rolling 24 hours, 100 labels per
kind and 20 labels of each kind per link. Request rates are separately limited.

JSON uses a versioned envelope (`schema_version: 1`, `links: [...]`); a bare array
of links is also accepted. Minimum row:

```json
{"address":"example","target":"https://example.org/page"}
```

Optional fields: `id`, `domain`, `description`, `paused`, `starts_at`, `ends_at`,
`max_visits`, `redirect_count`, `expires_at`, `deleted_at`, `password_required`,
`password`, `tags`, `collections`, `routing_rules`, `tracking_enabled`, `forwarding`, `banned`. Unknown fields are rejected. Booleans
must be actual booleans; timestamps are ISO 8601 with a timezone; tag/collection
values are arrays of unique names. Lifecycle counters are retained so imports
cannot accidentally reset a link's spent quota. Trashed rows remain trashed.

CSV uses the same field names, true/false booleans, decimal counters and JSON
arrays within quoted label/routing cells and JSON objects in forwarding cells. The maintained `csv-parse`/`csv-stringify`
libraries handle quoting, commas, Unicode and embedded newlines. Exports prefix
formula-like or whitespace-leading cells with an apostrophe and identify this
reversible encoding with `cell_encoding=apostrophe-v1`. Preserve that column on
round trips. Duplicate headers, malformed records and unknown encodings fail.

## API

Both `/api/transfer` and `/api/v2/transfer` are supported:

- `GET /export?format=json&state=all&q=example`: `links:read`.
- `GET /template?format=json` (or `csv`): `links:create`; private, uncached
  attachment with a generic paused sample. No data mutation. Both API aliases
  require authentication; anonymous requests fail, and a read-only scoped key
  cannot borrow authority from a browser cookie. Unknown/array formats fail.
- `POST /preview`: `links:create`; JSON body `{format, conflict, content}`.
  Returns `{valid, rows, expires_in, preview_token}` without changing link data.
- `POST /commit`: same body plus the returned `preview_token`; `links:create`.
  Returns 201 with `{created, skipped, replayed}`. Identical completed retries
  return 200 and the same link IDs, including after a restart, for 24 hours.

Organization, nonempty routing/forwarding rules and tracking opt-outs additionally require `links:update`. Domain-restricted tokens
can export/import only their domain; they may reuse existing owned labels but
cannot create account-wide labels. Management HTML requires a signed-in session.
Explicit API keys never inherit a browser cookie's authority. Cookie writes
enforce same-origin checks. No anonymous import/export or cross-account admin
override exists. Public short-link redirects are unchanged.

If confirmation fails due to a connection error, retry **the identical
confirmation**, not a new dry run. A committed receipt prevents duplication.
Changed input/scoped-token identity, changed aliases/permissions, an expired receipt or a
subsequently deleted/banned/moved-away link causes refusal. A dry-run error writes
nothing; a write failure rolls back all link, label, alias, history and receipt
and routing/forwarding changes in that batch. A previously committed all-skipped batch remains a replay,
not a later attempt to create its skipped rows.

## Migration and recovery

The optional `routing_rules` field follows [the routing policy format](ROUTING.md).
The optional `forwarding` object preserves [query/path allowlists](FORWARDING.md);
missing values default to empty lists. Dotted/nested aliases use the same
[validated segments and limits](LINK-ALIASES.md) as ordinary create/edit,
including generated conflict-renaming candidates. Nonempty imported policies
start at revision 1.
The optional boolean `tracking_enabled` preserves [analytics opt-outs](PRIVACY.md).
It defaults to true for older files; importing false with a token additionally
requires `links:update`. New exports include it in both CSV and JSON.
Older files without `routing_rules` remain default-destination-only. Imported policies retain
their order/conditions and receive a fresh revision of one; all destinations are
revalidated. An invalid stored policy fails export instead of silently losing it.
An older fork that does not recognize this field refuses the import: do not
remove nonempty rules just to force compatibility.

`20260914010000_link_imports.js` adds an owner-scoped receipt table. It stores
keyed input fingerprints and result IDs, not file contents or passwords. Old
receipts are cleaned during successful imports. The signing key is the existing
JWT secret; rotating it invalidates uncommitted preview tokens and old client
retry tokens. Follow coordinated credential rotation procedures.

Take a consistent full database backup before upgrade. Migrate and test an
isolated restored copy on the exact release image before production. A populated
receipt-table downgrade refuses to discard retry protection. Prefer a compatible
image rollback without schema downgrade; do not drop receipts to force it.
Restoring a pre-import backup loses later writes and therefore requires an
explicit recovery decision. CSV/JSON exports are not a substitute for that backup.

Automated regression: `tests/transfer.cjs` via `tests/container-smoke.cjs`.
`KUTT_TEST_ONLY=transfer` selects this suite inside a clean disposable test image.
Rendered desktop/mobile workflows: `tests/browser-transfer.cjs` against a fresh
loopback-only disposable instance. Deployment completion and published versions
are recorded separately in [the roadmap](FEATURE-ROADMAP.md).
