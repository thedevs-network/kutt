# Analytics ranges and exports

This guide describes the bundled range reports, exports and geography view.
See the [community source guide](COMMUNITY-FEATURE-ROADMAP.md) for feature scope,
regression coverage and compatibility boundaries. Source and fixture checks do
not establish deployment acceptance for another installation.

## Reports

Analytics is available from Library, Settings and the links navigation. The old
stats page also links to an exact-link report. Choose inclusive UTC start/end
dates, domain, tag and literal alias/description search. Daily values, totals,
browser/OS/country/referrer breakdowns and current tag summaries are available
in the UI and JSON/CSV exports. Tables are paginated; exports include all rows.
Empty ranges, request errors and retry are distinct states. Date/filter values
are preserved in the page URL. No visitor IPs or user agents are exported.

Domain and tag filters retain native keyboard-selectable controls in a responsive
layout. When the selected text cannot fit inside its control, the full value is
shown directly below as wrapping plain text and associated with the control for
assistive technology. No tooltip or smaller font is needed to read long values.
The displayed value updates on selection, resizing and report reload; Clear
removes it along with the filter. Filtering and export semantics are unchanged.

CSV/JSON export links use the shared light/dark button styling and retain their
18px current-color icons. The rendered regression requires at least 4.5:1 text
contrast in normal, hover and keyboard-focus states. Actual keyboard downloads
verify the selected filters, localized title, filename and CSV/JSON report data
across EN/FR/ES, both themes and 1440/390/320px. No export URL, authorization or
format changes accompany the styling fix. These are focused source/fixture
checks, not acceptance of another installation's custom theme or proxy.

Both `GET /api/analytics` and `GET /api/v2/analytics` accept:

| Parameter | Meaning |
| --- | --- |
| `start`, `end` | `YYYY-MM-DD`, inclusive UTC calendar dates, 1-366 days; supported dates 1000-01-01 through 9999-12-30 |
| `link` | Exact owned link UUID, optional |
| `domain` | Available custom-domain UUID, a domain containing the caller's retained links, or `default`; optional |
| `tag` | Owned tag UUID, optional |
| `q` | Literal case-insensitive alias/description substring, maximum 200 characters |
| `format` | `json` (default) or `csv` |

Without dates, the last 30 UTC dates ending today are returned. With only `end`,
the start defaults to 29 days before it. Invalid dates/ranges/fields return 400;
unavailable links/domains/tags return 404. Filters combine with AND. No target
HTTP requests are made. Responses are private/no-store and do not create visits.
Exports require the same authentication and filters; CSV text cells that could
be interpreted as spreadsheet formulas receive a leading apostrophe.

The response includes `filters`, `timezone`, `total`, `matched_links`,
`visited_links`, `by_day`, `stats`, `tags`, `available_filters`, and
`generated_at`. Tag totals use current assignments, not historical assignments:
one visit can count under several tags. They must not be summed as unique visits.
Trashed links retain their historical analytics until explicit retention/deletion;
reports do not restore or change their public availability.

Native pages require a signed-in session. API tokens need `stats:read`; all
current domain restrictions and revocation checks apply. Cookie credentials do
not elevate scoped tokens. Personal ownership is required even for administrators;
workspace membership alone does not grant access to another owner's analytics.
Restricted-domain tokens receive only tags assigned to visible links and allowed
domain choices, never the account's unrelated metadata.

An available custom domain is owned or explicitly granted. After a grant is
revoked, the creator can still filter historical analytics for their own retained
links on that domain; ownership predicates remain enforced on both links and
visits. This read-only access neither authorizes mutations nor exposes another
creator's records. Revoked domain-scoped tokens remain unusable; a regrant does
not reactivate them.

Reports are bounded to 10,000 selected links, 100,000 hourly buckets, 20,000 tag
assignments and 10,000 distinct values per dimension. Oversized reports return
422 and ask for narrower filters instead of silently truncating results. Invalid
stored counts/dimensions fail closed (503). The application limits this endpoint
to 30 requests/minute per client/path when rate limiting is enabled; edge controls
remain active. These limits do not change the legacy stats response.

## Geography (C20)

C20 geography is included in this contribution. Its source behavior and focused
tests are described below and in the [community guide](COMMUNITY-FEATURE-ROADMAP.md);
publication and deployment remain separate acceptance gates.

The range-report page includes an interactive geography view in English, French
and Spanish. Country labels use the selected locale's `Intl.DisplayNames`.
The SVG uses the existing `server/utils/map.json` geometry (177 country/territory
shapes) already bundled with Kutt. Geometry is rendered into the authenticated
HTML with escaped template attributes; no raw report JSON, inline event handlers,
new mapping service, external tile requests or new API endpoints are used.
The existing per-link legacy stats map is unchanged.

### API Data Usage

The chart consumes the **same validated response** from `GET /api/analytics` as
the other range-report views. `stats.country` is an array of `{ name, visits }`,
with country-code names and nonnegative integer counts. `total` is the count of
tracked visits for the active date/link/domain/tag/search filters. Names are
matched case-insensitively against bundled geometry IDs; the API payload is not
rewritten. API ownership, token scopes, domain restrictions and private/no-store
responses are unchanged.

- A country's displayed share is `visits / total`, formatted as a locale-aware
  percentage with at most one decimal place. The denominator includes unknown
  and unmapped visits, not just colored countries. Rounding can affect sums.
- When the report total is zero, or historical country counts exceed it, shares
  are marked unavailable. Counts remain visible; the chart does not renormalize
  inconsistent historical data or claim that mapped countries account for 100%.
- Color bins are labeled integer count ranges derived from the largest mapped
  count in the current response. Zero means no recorded count for that shape,
  not proof that no visitor came from that country. Colors are not a substitute
  for the textual counts and shares.
- Unknown country names and codes missing from this simplified geometry (for
  example Singapore) remain in the existing paginated country table. The map
  also reports the count without matching geometry. Geometry is not a statement
  about current political boundaries and must not be used as a complete region
  directory. No new geographic resolution or visitor-location inference is added.

Country hover/focus shows details; click, Enter/Space or the native country
selector keeps a selection. The SVG has one country tab stop, with arrows and
Home/End traversing localized alphabetical order. Escape clears the selection.
The native selector makes tiny shapes accessible, and the linked country table
retains every returned row plus the report-share column. The map selection is
**details only**, never a global country filter: it does not change the URL,
date/link/domain/tag/search filters, exports, table pagination or report totals.

All country interactions are local DOM updates using text-only content. They
do not request reports, redirect through a short link or add analytics. New
responses update the map only after the existing schema and request-serial
checks. Loading/error states hide the report and remove export targets as before;
an older response cannot replace newer geography, even if abort is ineffective.
Light/dark styling responds to the existing theme root attribute without another
request. Custom layouts/views retain their existing override precedence; custom
analytics views without the new geography partial keep their existing table.

### Source Validation

Use disposable fixtures, never live data:

```sh
docker build -t kutt-geography-test:c20 .
docker run --rm --network none --read-only --tmpfs /tmp \
  -e KUTT_TEST_ONLY=geography kutt-geography-test:c20 node tests/container-smoke.cjs
KUTT_TEST_LOCALE=fr sh tests/browser-geography.sh kutt-geography-test:c20
```

The browser wrapper owns a loopback-only app and a temporary SQLite database;
it seeds synthetic country aggregates directly in that database, exposes no test
API, and removes only its own container by captured ID. The test refuses an
initialized app. It accepts `NODE_BINARY`, `PLAYWRIGHT_MODULE`,
`KUTT_BROWSER_PORT` (default 31123), `KUTT_EVIDENCE_DIR` outside the checkout,
and `KUTT_TEST_LOCALE=en|fr|es` (English by default).

The focused HTTP/unit gate checks geometry identity, counts/percentages, unknown
and unmapped values, inconsistent and empty totals, hostile names, unchanged API
data, private pages and zero visit writes. Each browser language run checks
1440/390/320px in light and dark, actual keyboard/pointer/native interactions,
nonblank SVG bounds/fills, filter and table-page preservation, stale/empty/error
and retry states, safe text, no external requests and unchanged visit records.
Browser-plugin tooling is unavailable in this task; tests use regular Playwright
Chromium. Physical devices, Safari/Firefox and assistive-technology acceptance
remain separate from these automated keyboard and screenshot checks.

On 2026-09-22, the geography HTTP/unit gate, catalog/template checks (1,459 keys
per locale), existing analytics authorization/export/ingestion regression and
existing English analytics browser flow passed. English/French/Spanish geography
browser runs each passed six light/dark layouts at 1440/390/320px, with screenshot
samples inspected under `/tmp/kutt-c20-geography-*`. An extra SVG-container tab
stop found by the initial native-keyboard test was removed; the final map has one
country tab stop. The section heading also has a scoped reset so it does not
inherit masthead spacing. These are source/browser checks, not live acceptance.
The full combined container regression also passed, including OIDC and guarded
migration rollback/reapply. Package version remains `3.2.6-sr94.47`; no QR,
metrics, analytics API, geometry-data or parent-checkout changes were made.

## Ingestion and compatibility

Request and queue processing use the same `isbot` classification and 1,000-character
user-agent bound. Known bots and HEAD requests do not add analytics; redirect
availability/maximum-visit enforcement remains separate and unchanged. The worker
also rechecks bots in older queued header-shaped jobs. Missing or unrecognized
agents may not be detected: this is heuristic filtering, not proof of humanity.

Country is derived locally from the trusted client IP using GeoIP. Client-supplied
country hints are ignored. Invalid referrer URLs become direct visits; paths,
queries and fragments are not retained in referrer dimensions. New hourly
referrer buckets retain at most 128 names plus an `(other)` overflow counter.
Report breakdowns use the same cap; totals still include overflow visits. Old
high-cardinality data is not erased: oversized historical detail is omitted from
reports in favor of its aggregate count. Worker processing
rechecks link/user ownership, deletion and bans. The displayed counter and hourly
aggregate now commit atomically; a failed aggregate write cannot increment only
the displayed counter. Concurrent inline workers retain every increment, and
referrer keys cannot inherit object properties. This does not claim exactly-once
delivery from Redis.

Existing hourly aggregate data and the legacy `/links/{uuid}/stats` API are
preserved. Historical aggregates have no raw user agent, so older bot/country
classification cannot be reconstructed or honestly corrected. New reports include
those existing aggregates without reclassifying them.

The [privacy controls](PRIVACY.md) add per-link ingestion opt-outs and optional
administrator-confirmed retention. Defaults preserve existing tracking/data.
Opt-outs do not alter redirect quotas, and retention keeps lifetime counters.

## Migration and recovery

`20260914040000_analytics_range_index` adds a composite owner/time/link index to
existing visits. It does not rewrite or delete analytics. Downgrade removes only
the index and is tested with populated data. Old application versions remain
schema-compatible but lose the new reports and ingestion improvements. Prefer
fix-forward; preserve current data and reconcile later writes before restoring
an older backup. Full database backups include aggregates; CSV reports are not
a substitute for backups of links, credentials, policies and account state.

`tests/analytics.cjs` checks UTC boundaries, ownership/scopes, private domain/tag
metadata, exports, invalid stored dimensions/counts, old API compatibility, bot
filtering, queued hints, concurrent increments, object-property referrers, rollback,
restart and index migration. `tests/browser-analytics.cjs` uses only a fresh
loopback fixture and checks desktop/mobile filters, charts, tables, downloads,
empty/error/retry states and browser runtime/layout errors.
`tests/browser-domain-grants.cjs`, run by `tests/browser-domain-grants.sh`, also
checks common and long domain/tag selections, keyboard Apply/reload/Clear, and
creator-only shared-domain reports before and after grant revocation across
English/French/Spanish, light/dark and 1440/390/320px layouts. Each future change
still requires publication, backup restore and live WAF/SSO acceptance.
