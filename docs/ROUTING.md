# Ordered redirect rules

Release `v3.2.6-sr94.10.1` is published, deployed and verified (2026-09-14).
It supersedes `.10` with the default-only protected-link compatibility fix.

## Model

Each link may have up to 20 ordered rules. The first matching rule wins; if none
matches, the existing link destination is used. Conditions of different kinds
are ANDed. Values within a device/language/country condition are ORed. Query
conditions are all ANDed. Rules are routing preferences, never access controls.

- Device uses the existing express-useragent parser, with isbot classification
  taking priority. Values: `desktop`, `mobile`, `tablet`, `bot`, `other`.
- Language uses the highest-quality Accept-Language preference. `fr` matches
  `fr` or `fr-FR`; `fr-FR` does not match `fr-CA`. Case is normalized. Unknown
  or wildcard language does not match a language condition.
- Country uses the local geoip-lite database and the configured trusted client
  IP. It does not trust a client-supplied CF-IPCountry header. Unknown geography
  does not match; VPNs and database age can affect results. No geolocation API
  or request data is sent to a third party.
- Query keys/values are decoded with URLSearchParams and are case-sensitive.
  `present` includes empty values, `absent` excludes all occurrences, and
  `equals` matches any duplicate occurrence equal to the given literal value.
  There are no regular expressions or scripts. Query data is not forwarded
  unless the owner separately enables explicit [forwarding allowlists](FORWARDING.md).

Targets are absolute HTTP(S) URLs without embedded credentials. Destination
validation/ban checks run before saving, outside the write transaction. No
destination page is fetched. Domain bans are rechecked on matched redirects.
The original password, ban, trash, schedule and visit-cap gates still apply.
HEAD and preview do not consume quota or record analytics. Info (`+`) shows the
default target, not a list of alternate destinations. The password form carries
only the bounded original query; it does not disclose alternate targets before
the correct password is supplied. Basic authentication and password submission
use the same rule evaluation as ordinary redirects.

## UI and API

Open **Redirect rules** from a link's actions or Library. Add named rules with
typed device/language/country/query conditions, move them up/down, then save.
Test redirect evaluates the current draft without saving or following its URL.
Removing all rules restores default-only routing. Conflicting edits return an
error instead of overwriting a newer policy; reload after reviewing that error.

Personal ownership is required, including for administrators. Workspace roles
do not grant policy management. Scoped tokens retain current domain restrictions
and cannot be elevated with a browser cookie. Native pages require a session.

Both `/api/links/{uuid}` and `/api/v2/links/{uuid}` support:

| Method | Path | Permission | Result |
| --- | --- | --- | --- |
| GET | `/routing` | `links:read` | `revision`, ordered `rules`, `fallback` |
| PUT | `/routing` | `links:update` | Atomically replace `rules` at supplied `revision` |
| POST | `/routing/preview` | `links:read` | Evaluate saved or supplied draft rules |

```json
{
  "revision": 0,
  "rules": [{
    "name": "French mobile campaign",
    "target": "https://example.com/fr/mobile",
    "conditions": {
      "devices": ["mobile", "tablet"],
      "languages": ["fr"],
      "countries": ["FR", "BE"],
      "query": [{"key": "campaign", "op": "equals", "value": "summer"}]
    }
  }]
}
```

Preview accepts `{"context":{"device":"mobile","language":"fr-FR",
"country":"FR","query":"campaign=summer"}}` and optional `rules` for a draft.
It returns `target`, zero-based `rule_index` (null for fallback), `rule_name`,
and `preview: true`. It does not bypass availability when a recipient later
opens the actual link. Missing rule policy has revision zero; each save increments
revision, including clearing all rules. Stale revision is `409`; malformed input
is `400`; ownership/domain denial is `404` or `410`; invalid credentials are `401`.

Limits: 32 KB serialized policy, 80-character rule names, 20 values per condition
kind, 10 query conditions, 80-character query keys, 200-character query values,
2,048-character preview/rule-enabled redirect query, and 2,040-character targets. At least one
condition is required per rule. Save/preview application limits are 30/60 requests
per minute per path/client when enabled; existing WAF controls remain active.
Default-only links retain the old behavior of ignoring incoming query strings,
including password forms; `.10.1` corrects that compatibility edge case in `.10`.

## Persistence and recovery

Additive migration `20260914030000_link_routing` creates link-owned routing JSON
and optimistic revisions. It does not modify existing links or visits. Policy
and field-name-only audit history are saved in one transaction. A forced audit
failure rolls back the policy. Corrupt stored policy returns `503` rather than
silently changing the destination; the owner can replace it at its current
revision after inspection. In-flight requests may finish with their already-read
policy; later requests read current state. Existing Redis link caching is not
used for policy reads.

Downgrade refuses a populated policy table. Older releases do not evaluate these
rules: do not roll back to `.9` once rules are in use without an explicit routing
impact decision. Prefer fix-forward or the same verified compatible image.
Preserve the current database and reconcile later writes before restoring any
pre-release snapshot. SQLite backup includes rules/revisions. CSV/JSON link
transfer retains rules as `routing_rules`, revalidates destinations and requires
`links:update` in addition to `links:create` for nonempty policies. Imported
policies start at revision one; older files without rules still work. Transfer
does not replace a complete database backup.

`tests/routing.cjs` covers conditions, precedence, preview isolation, untrusted
country headers, protected links/lifecycle, scopes/ownership/CSRF, concurrent
revision conflicts, transaction rollback, restart and guarded downgrade.
`tests/browser-routing.cjs` checks desktop/mobile editing, preview, ordering,
conflict recovery and fallback. Never point disposable tests at production data.
