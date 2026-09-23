# Nested aliases and explicit forwarding

Implemented for `v3.2.6-sr94.14.1`, roadmap item 14. Production acceptance is tracked
separately in the roadmap and remains unchecked until all release gates pass.

## Aliases and matching

The existing create/edit controls and APIs accept aliases such as
`campaign/autumn/guide` or `docs/v1.2/guide.pdf`. Nested aliases have 2 to 8
nonempty ASCII segments made of letters, digits, `_` and `-`, with single
interior dots and the existing 64-character total limit. See
[alias rules](LINK-ALIASES.md) for the complete create/edit/import contract.
Legacy dot-free single-segment custom-alphabet aliases remain supported. Management and
static root names are reserved case-insensitively, including `api`, `settings`,
`login`, `scripts` and `.well-known`. Empty segments, traversal and ambiguous
encoded slash/backslash/double encoding are rejected.

Exact aliases win. Otherwise the longest existing alias can handle an explicitly
allowed suffix. Existing child aliases, including paused, trashed and banned
ones, never fall through to a parent's target. A renamed/deleted alias claim
also stops fallback: creating a parent does not reactivate retired URLs. Matching
is domain-specific; a different custom domain does not inherit these settings.
Retired single-segment aliases keep their existing not-found redirect behavior;
they are never reused. Nested prefix lookup returns 410 at a retired claim.

## Management

Open **Path and query forwarding** from a link's actions or Library. Enter one
query key or path prefix per line, preview the draft, then save. Clearing creates
an unsaved empty draft until saved. Reload discards the draft in favor of current
settings; a revision conflict preserves edits and requires an explicit reload.
The preview uses saved redirect rules and a supplied device/language/country/
query context. It performs no outgoing HTTP requests and does not count visits.

Defaults are empty allowlists: existing redirects are unchanged. Forwarding
requires HTTP(S) destinations without embedded credentials, both the base target
and any selected rule target. The target's origin, existing query values and
fragment are retained. Only explicitly permitted incoming keys are appended;
unknown keys are ignored. Existing target values win over incoming values. Up to
10 values of 500 characters per allowed key are accepted; ordering is retained.
The incoming query is bounded to 2048 characters and 50 parameters, and the final
destination to 2040 characters. Credential-like names (`token`, `access_token`,
`password`, `api_key`, `code`, `state`, etc.) cannot be allowlisted. No request
headers, cookies or authorization credentials are copied.

An allowed prefix `docs` matches `docs` and `docs/start`, not `docs-other`.
Suffixes are appended beneath the target's existing path, never interpreted as
another origin or an absolute URL. Each suffix/prefix permits at most 8 literal
ASCII segments and 256 characters; `.`, `..`, empty segments, percent encoding,
backslashes and control characters are prohibited. Literal segment characters
are letters, digits, `_`, `~`, `.`, and `-`. Each allowlist has at most 20 entries.
There are no wildcards or regular expressions. Owners must still assess the
destination application's semantics: allowing a query key that controls its
own redirect, tenant or resource selection delegates that input to the visitor.
Forwarding is not an authorization mechanism for the destination.

For example, alias `help/team`, target `https://example.com/base?fixed=owner`,
keys `utm_source` and `fixed`, and prefix `docs` produce:

```text
/help/team/docs/start?utm_source=book&fixed=visitor&unknown=no
https://example.com/base/docs/start?fixed=owner&utm_source=book
```

Ordered routing selects the destination first; forwarding is then applied.
Public redirects remain unauthenticated except for a link's own password. Native
password forms preserve query/path across a wrong-password retry. API password
submissions revalidate the path, current policy and child/retired-alias precedence.
The protected POST uses `suffix_path` and `routing_query`. The server still accepts
the original `.14` name `forwarding_path` for compatibility, but new clients must
use `suffix_path`: CRS 930120 matched the old JSON field name as `.forward` during
public acceptance. Conflicting old/new values are rejected. No WAF rule or target
exclusion was added; password and path validation are unchanged.
HEAD requests and previews do not consume quota; successful GET/unlock requests
still enforce lifecycle limits. Corrupt stored policies fail closed with 503.

## API

Both `/api` and `/api/v2` support:

| Route | Requirement |
| --- | --- |
| `GET /links/{uuid}/forwarding` | `links:read`; returns `query_keys`, `path_prefixes`, `revision`, `fallback` |
| `PUT /links/{uuid}/forwarding` | `links:update`; current integer `revision` and both allowlists; returns next revision |
| `POST /links/{uuid}/forwarding/preview` | `links:read`; optional draft `policy`, `path`, and routing `context`; returns target, matched rule and `preview:true` |

Example save:

```json
{"revision":0,"query_keys":["utm_source"],"path_prefixes":["docs"]}
```

Management is owner-only, even for administrators. Domain-scoped tokens remain
restricted to their domain; cookies cannot elevate them. Pages require a browser
session, API scopes are explicit, and session writes have origin/CSRF checks.
Shared workspace editors do not gain owner-wide routing/forwarding authority.
Responses are private/no-store. Stale revisions return 409, invalid input 400,
inaccessible owner/domain 404, and deleted or archived links 410.

CSV/JSON exports contain a `forwarding` object (JSON in a CSV cell); imports
validate and preserve it, and require `links:update` in addition to
`links:create` when nonempty. Old exports without this field mean no forwarding.
Changes add a `forwarding_updated` history entry and minimal
`link.forwarding_updated` webhook event, with field names only, not query values.

## Migration and recovery

`20260914070000_link_forwarding` adds one table without changing existing alias
column widths or rewriting links. The migration down refuses any saved policy
or nested alias. Back up the entire database and current secrets consistently;
restore it into an isolated exact-version container, migrate, check integrity/
foreign keys and perform a rolled-back write before any production deployment.

An older image cannot resolve nested aliases and ignores forwarding policies.
Do not perform an image-only downgrade after using this feature. Prefer a
compatible fix-forward release; restoring an earlier snapshot loses later data
unless explicitly reconciled. Retired alias claims, lifecycle counters, privacy,
OIDC identities and webhook outbox/secrets must remain together. Never delete
policy rows or reservations simply to make a downgrade succeed.

## Verification

`tests/forwarding.cjs` exercises HTTP matching, traversal/encoding, child and
tombstone precedence, bounded query/path behavior, protected/Basic/rule/HEAD/
quota paths, authorization, conflicts, transaction failure, restart, transfer
and downgrade guards in a disposable database. `tests/browser-forwarding.cjs`
validates desktop/mobile create, navigation, preview, save/reload, conflict,
outage recovery, password retry and clear workflows against a fresh loopback
fixture. Publication, exact-image restore and public WAF acceptance remain
separate release gates, not inferred from those tests.
