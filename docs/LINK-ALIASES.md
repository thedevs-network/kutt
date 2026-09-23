# Link aliases

Personal and administrator link forms, both `/api` and `/api/v2`, workspace
create/edit operations, and CSV/JSON imports accept `guide.pdf`, `v1.2.3` and
`docs/v1.2/guide.pdf`. Creation uses `customurl` in the personal API; edits,
workspace APIs and import rows use `address`. The same server-side rules apply
to each path; browsers do not impose an ASCII-only pattern on legacy aliases.

## Rules

- Maximum 64 characters across the entire alias, including dots and slashes.
- At most eight nonempty slash-separated segments.
- Dotted or nested segments consist of ASCII letters, digits, `_` and `-`,
  optionally separated by single interior dots: `name.ext`, not `.name`,
  `name.`, `name..ext`, `.` or `..`.
- No percent-encoded input, backslashes, query/fragment delimiters, `+`, ASCII
  whitespace/control characters, or empty/leading/trailing slash segments.
  Personal forms/APIs retain their existing surrounding-space trimming;
  control characters are rejected before trimming.
- Management/static roots are reserved case-insensitively, even before a
  nested suffix: for example `api`, `settings`, `scripts`, `.well-known`,
  `favicon.ico`, `robots.txt` and `manifest.webmanifest` cannot be claimed.
  Exact-root matching does not reserve unrelated names such as `api.json`.
- Alias text is not case-folded. Existing database collation and collision
  semantics are unchanged; do not assume case-only variants are distinct on a
  case-insensitive database. Domains retain their existing normalization and
  ownership rules.

Legacy dot-free, single-segment aliases from `LINK_CUSTOM_ALPHABET` remain
supported, except ambiguous URL delimiters/control characters. That setting
cannot bypass the safe dotted/nested grammar. Automatic generation also checks
alias safety and existing reservations, with a bounded retry limit; an alphabet
that cannot produce safe available aliases fails instead of creating an
unreachable URL. No existing aliases or database records are rewritten.

## Matching and lifecycle

Dots are literal alias characters, not file downloads or a new routing mode.
Existing exact-match, custom-domain, password, HEAD and `+` information behavior
is unchanged. Ownership, API-token scopes, workspace roles, collision handling,
trash/restore and permanent retired-alias claims continue to apply. Imports
validate generated conflict-renaming candidates as well as their original input.

Alias validation is deliberately separate from
[forwarding suffix validation](FORWARDING.md). Forwarding retains its existing
256-character/eight-segment grammar, including `~`, `.hidden`, `file.` and
`a..b` inside non-traversal segments. Exact dotted child links and retired claims
still prevent a broader parent's forwarding policy from taking over their URLs.

No migration or configuration change is required. Earlier versions may reject
dotted aliases during creation, editing or import; do not rewrite live aliases
to work around an image rollback. Deployment, restore and public proxy/WAF
acceptance are separate release gates.

## Verification

`tests/dotted-alias-unit.cjs` covers grammar, boundaries, reserved roots and
custom-alphabet/suffix separation. `tests/dotted-aliases.cjs` exercises all write
paths, malformed input, both API aliases, HTML forms, case/domain identity,
scoped access, redirects, import/export/rename, lifecycle and restart in the
existing disposable smoke fixture. Run its focused gate with
`KUTT_TEST_ONLY=dotted-aliases node tests/container-smoke.cjs` in an isolated
container/checkout without `.env`, never against a deployed database.

`tests/browser-dotted-aliases.cjs` adds actual rendered create/edit/error recovery
at desktop and mobile sizes. `tests/dotted-alias-database.sh IMAGE mysql2` and
`tests/dotted-alias-database.sh IMAGE pg` run the standalone HTTP/database gate
against fresh, network-isolated engines. Case-collision results are compared
with ordinary aliases on that engine, not assumed to be case-sensitive. See
[test setup](../tests/README.md) for disposable-instance and evidence settings.
