# Container smoke test

Management-host isolation and explicit per-user domain grants run in the full
suite and with `KUTT_TEST_ONLY=management-domain-grants`. The fresh fixture checks
raw/forged/encoded Host routing, exact Origin checks, host-only cookies, canonical
mail and shortcut URLs, protected public forms, grant revocation, token expiry,
workspace-owner entitlements, import commit/replay, lock races, domain recovery,
and disabled-setting compatibility. Native revoke checks include non-mutating
GET/cancel/old forms, fresh ownership, invalid origins and stale/regranted IDs.
The full suite also repeats signed OIDC
callback/logout validation on the separate management host.

Run `sh tests/search-database.sh IMAGE mysql2 tests/management-domain-grants.cjs`
and the same command with `pg` for isolated real-database gates, including a
forced stale-snapshot permission check. The `oidc-roles-database.cjs` gate adds
expired mapped-admin denial for grant writes. `sh tests/browser-domain-grants.sh
IMAGE` checks keyboard grant/confirm/cancel, irreversible scoped-token revocation
and recipient selectors with enforced CSP at 320/390/1440px, in EN/FR/ES and
light/dark, plus confirmation with JavaScript disabled. This browser gate is also integrated
into `browser-community.sh`; it uses only disposable loopback accounts and
captures synthetic screenshots outside the checkout. See
[domain sharing](../docs/DOMAIN-SHARING.md) for topology and recovery boundaries.

Geography uses `KUTT_TEST_ONLY=geography` and the full container suite.
`sh tests/browser-geography.sh IMAGE` checks the existing analytics contract,
bundled SVG, count/share details, pointer/keyboard/native country selection,
unknown and unmapped rows, table pages, filter preservation, stale/empty/error
states, no external requests and zero analytics writes. Run with
`KUTT_TEST_LOCALE=en|fr|es` for six light/dark layouts per locale at
1440/390/320px. See [analytics geography](../docs/ANALYTICS.md#geography-c20)
for fixture safety, API data usage and coverage limits.

Appearance preferences are covered by `KUTT_TEST_ONLY=theme` and the full suite.
`sh tests/browser-theme.sh IMAGE` checks System/Light/Dark, browser storage and
cross-tab behavior, real rendered contrast, chart colors/pixels and QR print
preservation on desktop/mobile. See [themes](../docs/THEMES.md) for test runtime,
evidence and custom-layout requirements. `KUTT_TEST_LOCALE=fr` or `es` exercises
translated appearance labels; omission retains the English baseline. The HTTP
gate checks all three catalogs and unchanged `system`/`light`/`dark` values.

Safe dotted aliases are covered by `dotted-alias-unit.cjs` and
`dotted-aliases.cjs`. The latter runs in the normal smoke suite or with
`KUTT_TEST_ONLY=dotted-aliases`: create/edit/admin/workspace/import paths,
reserved names, dot/traversal/encoding limits, case/domain identity, scoped
access, redirects, retirement/restore and forwarding-suffix compatibility.
See [alias rules](../docs/LINK-ALIASES.md). Use only disposable test databases.

`browser-dotted-aliases.cjs` uses `KUTT_BROWSER_DISPOSABLE=1`, a fresh loopback
`KUTT_TEST_URL`, optional `PLAYWRIGHT_MODULE`, and `KUTT_EVIDENCE_DIR` outside the
checkout. It covers native create, personal/admin/workspace edits, rejected
aliases and retained drafts, redirects and layout at 1440/390/320px. It refuses
an initialized app, verifies the public redirect response, and substitutes a
synthetic landing response without contacting the external destination.
`sh tests/browser-dotted-aliases.sh IMAGE` provisions and removes the fresh
loopback instance. It accepts `NODE_BINARY`, `PLAYWRIGHT_MODULE`,
`KUTT_BROWSER_PORT` (default `31121`) and `KUTT_EVIDENCE_DIR`.

Build the candidate image, then run `sh tests/dotted-alias-database.sh IMAGE mysql2`
and `sh tests/dotted-alias-database.sh IMAGE pg`. Each gate creates its own pinned,
network-isolated database container with tmpfs storage and removes only that
container by its captured ID. The HTTP suite refuses an initialized database and
covers dotted write paths, native collation parity, scoped domains, concurrent
claims, rollback, trash/restore and unchanged forwarding suffixes.
Ordinary aliases are controls for both case matching and duplicate-claim races.
The forced stale-snapshot check requires a normal `409` conflict, never a `500`
or an unclassified exception, for both ordinary and dotted aliases. Both race
forms also verify that the losing link rolls back, the winning link/claim/history
remain unchanged, and the same owner can reassert an active claim.

Build from a clean checkout without a `.env` file:

```sh
docker build -t kutt-smoke .
docker run --rm --network none --entrypoint node kutt-smoke tests/container-smoke.cjs
```

The build needs network access to package registries. The test itself needs no
external services or network access. It creates a temporary SQLite database,
uses randomly generated disposable credentials, starts the application on a
local ephemeral port, then removes its database and stops the child process.
It refuses a checkout containing `.env` and does not inherit database or secret
file settings from its caller. Run only in a disposable build/container.

Coverage:

- C11 localization: English/French/Spanish key and placeholder parity, fail-closed
  catalog loading, hostile interpolation, custom view/partial precedence,
  Node/browser formatter parity, mail rendering, 90 concurrent locale contexts,
  localized HTTP errors, cookie/header negotiation, null/foreign-origin denial,
  safe return paths, localized assets and unchanged signed expiry inputs.
  `tests/browser-i18n.cjs` uses a fresh loopback fixture for actual native language
  form submissions (including their Origin header and retained theme preference),
  translated theme controls, login errors, HTMX editing,
  plural feedback and 22 views in three languages at 1440/390/320px.
  `i18n-community.cjs` adds French/Spanish moderation and origin denials,
  unchanged audit payloads, sorting and dotted-alias/import validation.
  The moderation, list-sorting, dotted-alias and theme browser suites accept
  `KUTT_TEST_LOCALE=fr` or `es`; omission retains their default English gate.
  See `docs/LOCALIZATION.md` for commands and explicit acceptance limits.
- Campaign URL parameters: encoded bounds, explicit clears, API aliases,
  idempotency, public/protected/Basic and routing/forwarding precedence,
  import/export, history, restart, owner/admin/scoped/CSRF and workspace roles.
  `tests/browser-campaign.cjs` exercises creation and all editing surfaces on
  desktop/mobile, including delayed disclosure events and unsaved-draft recovery.
- Production migrations on a fresh SQLite database.
- Native SQLite query, close and Node process teardown.
- Initial administrator creation and rejection of a second bootstrap.
- Password authentication.
- Rejection of anonymous link creation and listing.
- Authenticated creation, listing and deletion of a short link.
- Public redirection without credentials, and immediate 410 after moving to trash.
- Token scopes, expiry, revocation, owner bans, legacy key compatibility,
  cross-user access denial, CSRF and explicit credential precedence over cookies.
- Domain-restricted list totals, CRUD and statistics; domain deletion, recreation,
  bans and ownership transfer; fail-closed older-image token format.
- Eight concurrent idempotent creates produce one link, replay survives server
  restart, conflicts return 409, expired records are reusable, and failed
  creations roll back their reservations. Stored records contain no raw secrets.
- Populated schema downgrade refusal and separate empty-database down/up.
- Lifecycle validation, owner/domain/CSRF checks, concurrent visit caps, password
  flows, HEAD and info semantics, restart persistence, retained expired records
  and guarded policy schema rollback.
- History/trash/restore, retained policies, secret-free audit payloads, pagination,
  ownership/domain/scoped-token boundaries, CSRF, concurrent alias claims,
  retired alias protection and domain/account deletion recovery behavior.
- Disposable signed OIDC authorization code/PKCE, stable identities and email
  collision denial, absolute session expiry, logout/replay, private diagnostics,
  session revocation, bans, provider outage recovery and guarded identity migration.

`KUTT_TEST_ONLY=accessibility` validates named controls, selected native tabs,
unique IDs and isolated focus-helper recovery/cleanup without network access.
`tests/browser-accessibility.cjs` uses the same fresh loopback settings and
`KUTT_EVIDENCE_DIR` described below, at 1440/390/320px. It exercises native
keyboard controls, focus after HTMX/native/async updates, concurrent draft focus,
visible outlines/reduced motion, restore confirmation and admin tab pagination.
It does not replace a full assistive-technology or physical-device audit.

`KUTT_TEST_ONLY=dialogs` checks authenticated/admin-only confirmation endpoints,
the shared modal frame and isolated request/focus state transitions. It is part
of the full container suite. `tests/browser-dialogs.cjs` uses a fresh loopback
instance and required evidence directory at 1440/390/320px: native background
isolation, names, initial/restored focus, Tab/Shift+Tab, Escape/cancel, all
personal/admin/domain dialogs, QR, repeated opening, cancelled slow requests,
load/write errors, validation drafts, duplicate-submit prevention, real synthetic
write/retry/trash success and removed-opener recovery. No production data is used.

For rendered lifecycle UI, install Playwright in your test runtime and run
`tests/browser-lifecycle.cjs` with `KUTT_BROWSER_DISPOSABLE=1` and a loopback
`KUTT_TEST_URL` for a fresh disposable instance. `PLAYWRIGHT_MODULE` can point to
an external installation. The test refuses an initialized app, checks desktop
and mobile controls, persists/reloads policies, verifies public redirects and
captures screenshots to `KUTT_EVIDENCE_DIR` (or a fresh temporary directory).

`tests/browser-expiry-edit.cjs` uses the same isolation settings on a fresh instance
and requires `KUTT_EVIDENCE_DIR`. It tests personal/admin expiry intent, conflict
review/retry, sibling draft preservation and paused public redirects at
1440/390/320px. `tests/expiry-edit.cjs` is included in the full container suite;
`KUTT_TEST_ONLY=expiry-edit` runs its focused API/rendered-fragment regression.

`KUTT_TEST_ONLY=admin-edit` tests fresh owner/domain metadata on admin editor
success and errors, non-secret draft retention, anonymous/custom-domain cases,
API privacy, authorization and restart. `tests/browser-admin-edit.cjs` uses the
same disposable loopback settings and evidence path for native admin
save/error/retry/filter/open/close at 1440/390/320px. Table geometry and error
accessibility have separate browser regressions below; programmatic access to
an off-screen row action is not acceptance of the mobile table layout.
No production credentials or records are used.

## UI/UX regression

All focused selectors below also run in the full container suite. They do not
replace that suite or the separate Redis worker test when releasing.

| Focused selector | Contract | Rendered companion |
| --- | --- | --- |
| `library-ux` | Accurate availability and signed bulk-result notices | `browser-library.cjs` |
| `validation` | Named errors, independent drafts and error focus | `browser-validation.cjs`, `browser-oidc-validation.cjs` |
| `login-copy` | Registration/login labels match enabled policies | `browser-login-copy.cjs` |
| `contrast` | Text and control palette assertions | `browser-contrast.cjs` |
| `copy` | Confirmed clipboard feedback; selectable link/legacy-key fallback; masked responsive one-time tokens with explicit reveal and safe dismissal | `browser-copy.cjs` |
| `responses` | Typed response validation; malformed success must not replace saved state | `browser-responses.cjs` |
| `login-navigation` | One full-document sign-in transition; unchanged JSON/auth boundaries | `browser-login-navigation.cjs` |
| `unavailable` | Branded private-by-default 410 page; unchanged HEAD/API/lifecycle | `browser-unavailable.cjs` |
| `header` | Scoped site header and content-sized account-security heading | `browser-header.cjs` |

Use fresh loopback-only disposable instances and a separate evidence directory
for each rendered suite. `browser-login-navigation.cjs` requires HTTPS loopback
with a test-only certificate. `browser-header.cjs` takes `KUTT_HEADER_FIXTURES`
as a JSON array of exactly three `{ "origin": "http://127.0.0.1:PORT", "name": "Site name" }`
entries matching each fresh instance's configured brand. Never point these
tests at production or reuse a real user's browser profile.

`browser-tables.cjs` covers responsive personal/admin table controls;
`browser-table-zoom.cjs` adds actual 200/400% Chromium zoom and action hit regions.
`browser-headings.cjs` checks 15 content-heading routes, long names, actual zoom,
navigation and unchanged site-header geometry. These zoom tests install a
temporary loopback-scoped extension into a disposable Chromium profile to call
the native tab zoom API. They do not simulate zoom with CSS or pinch scaling.
The heading test waits for fonts and responsive size transitions before strict
layout comparisons, and logs any in-flight height change. Native print preview,
screen-reader behavior and physical QR scanning remain separate acceptance.

`tests/browser-history.cjs` uses the same isolation settings and a separately
fresh instance. It exercises delete confirmation, trash, history, restore and
reload at desktop/mobile sizes, checks public redirects and captures screenshots.

`tests/browser-security.cjs` uses the same isolation settings on a fresh instance
to check desktop/mobile security diagnostics, revoke all sessions, copied-cookie
denial and re-login. The protocol fixture does not require a human IdP login.

This is not a production OIDC provider, SMTP, PostgreSQL or MySQL acceptance test. It does
not demonstrate compatibility with every persisted database or CPU platform.
Take a database backup before upgrading an existing deployment.
# Library regression

`library.cjs` runs with the container smoke suite against disposable data.
`browser-library.cjs` requires a fresh loopback-only instance and
`KUTT_BROWSER_DISPOSABLE=1`, `KUTT_TEST_URL` and an installed Playwright module.
It exercises desktop/mobile organization, selection and bulk actions. Screenshots
go to a temporary evidence directory, not production data or the repository.

# Transfer regression

`transfer.cjs` is part of the isolated container suite. It covers CSV/JSON
round trips, formula escaping, dry-run no-write checks, protected links,
owner/domain/token/CSRF limits, atomic rollback and concurrent/restart replay.
`browser-transfer.cjs` uses the same disposable loopback settings on a fresh
instance for desktop/mobile file selection, preview, confirmation, downloads,
conflict correction and validation errors. It never runs against live data.

## Routing validation

`routing.cjs` runs in the full isolated container suite. `KUTT_TEST_ONLY=routing`
selects its focused fixture for development, never release CI. It verifies
ordered conditions, preview isolation, password/lifecycle paths, authorization,
optimistic concurrency, atomic rollback and guarded schema downgrade.
`browser-routing.cjs` uses a fresh loopback-only instance with
`KUTT_BROWSER_DISPOSABLE=1`, `KUTT_TEST_URL`, and optional `PLAYWRIGHT_MODULE` /
`KUTT_EVIDENCE_DIR`. It checks desktop/mobile editing, preview, ordering, stale
revision recovery, clear/fallback, layout and browser errors.

## QR validation

Branded exports add `qr-branding.cjs` to the full offline suite and the focused
`KUTT_TEST_ONLY=qr-branding` selector. `qr-logo-unit.cjs --decode` uses the existing
test-only jsQR dependency for actual raster decoding across size/alias cases;
run with disposable app configuration (including SQLite under `/tmp`) and no
real `.env`. `QR_DECODER_MODULE` may specify an installed test decoder.
`NODE_BINARY`, `PLAYWRIGHT_MODULE` and `QR_DECODER_MODULE` can select host test
runtimes for `sh tests/browser-qr-branding.sh IMAGE`. This runner creates/removes
only its own fresh loopback fixture; evidence stays outside the checkout.
`sh tests/browser-qr-branding-locales.sh IMAGE` runs the focused QR gate in
EN/FR/ES and light/dark at 1440/390/320px, including contrast/overflow and
localized browser/server error recovery. `qr-branding-i18n.cjs` additionally
checks localized parser/auth/validation errors, concurrent cookie negotiation,
source/catalog coverage and unchanged plain/branded artifact bytes.
See [QR branding](../docs/QR-BRANDING.md) for limits and separate physical gates.

`qr.cjs` runs in the standard offline hardened-image suite. For independent
browser decoding install the isolated test-only dependency with
`npm ci --prefix tests/browser-deps` (never inside the production image).
Use the same fresh loopback/disposable instance procedure as the other browser
tests, then run `node tests/browser-qr.cjs`. `PLAYWRIGHT_MODULE` and
`QR_DECODER_MODULE` may point to separately installed test runtimes.
The script refuses an already initialized instance, checks desktop/mobile actual
PNG/SVG downloads and ClipboardItem PNGs with jsQR, renders print mode/PDF, and
checks image failure recovery, clipboard denial/retry, conversion errors,
duplicate clicks and unsupported browsers. Clipboard writes are intercepted;
the test does not modify the operator's OS clipboard. It also creates its own
digit-leading email and domain to exercise link/domain admin filters at both
viewport sizes, waiting for HTMX and the real table fade before screenshots.
These dependencies are not application runtime dependencies.

`admin-user-filter.cjs` runs in the full offline container suite. It checks
numeric IDs (including leading zeros), digit-leading email/substring searches,
unsafe IDs and non-string filters, count/list/pagination parity, rendered HTML,
and ordinary/scoped credential denial for links and domains.

## Workspace validation

`workspaces.cjs` is included in the full container suite. It covers accepted
invitations, roles, revocation, owner/account/domain boundaries, separate API
scopes, CSRF, transactional edits, alias conflicts, restart and guarded migration
rollback. `KUTT_TEST_ONLY=workspaces` selects only that focused fixture for local
debugging; it never replaces the full release suite.

`browser-workspaces.cjs` uses a fresh loopback-only disposable instance and the
same Playwright environment as the other browser tests. It creates three local
test accounts and exercises desktop/mobile creation, invitations/acceptance,
sharing, editing, role changes, trash/restore, clipboard, revocation and closure.
Public redirects must survive closure. It refuses an initialized instance.

`workspace-edit.cjs` adds atomic edit-revision tests across personal/shared
clients, native draft retention, safe escaping/password non-disclosure, filtered
row recovery, optional API revisions, role revocation, visits and restart. Use
`KUTT_TEST_ONLY=workspace-edit` for the focused subset.
`browser-workspace-edit.cjs` requires a fresh loopback fixture and evidence path.
It exercises native conflict/review/retry and invalid-alias correction at
1440/390/320px, checks focused visible errors and retained native checkbox state,
and confirms a revoked editor can no longer submit. No real account is used.

## Final roadmap and security validation

`security-boundaries.cjs` covers legacy origin/principal boundaries, verification
without login, recovery invalidation, DNS proof/atomic ownership, URL complexity,
bounded/fair webhook admission and administration under queue exhaustion.
`KUTT_TEST_ONLY=security-boundaries` selects it during development. Full release
regression still runs all suites. Redis regression additionally exercises stale
cached principals across revocation/key rotation; cleanup mock tests require
exact fixture IDs and preserve foreign name collisions and original exit status.

`security-database.cjs` is a separate destructive-to-fixture-only PostgreSQL 16 /
MySQL 8.4 race test. It requires `KUTT_DATABASE_DISPOSABLE=1`, a loopback database
host, a database name beginning `kutt_security_` and no initialized user tables.
Run it only in a fresh `--network none` database container's network namespace,
with throwaway credentials/storage. It applies migrations and tests competing
domain claims, queue serialization (including old repeatable-read snapshots),
fair leases and recovery invalidation. This is not full product database parity.

`sh tests/search-database.sh IMAGE mysql2` and `sh tests/search-database.sh IMAGE pg`
start digest-pinned disposable engines with tmpfs storage, no external network
and no published ports. They wait for readiness, run fresh migrations, verify
utf8mb4/emoji and case-insensitive search, compare filtered totals with paginated
rows, test owner isolation and bound SQL input, and remove only their own container
ID. Both run in release and PR CI. MySQL uses its column collation rather than
Knex's incompatible `utf8_bin` override. No existing database collation is changed.

`proxy-trust.cjs` validates strict configuration and Express compilation, then
uses real IPv4/IPv6 sockets to check forwarded address/protocol handling,
untrusted-hop boundaries, spoof resistance, distinct client budgets and the
documented shorter-path limitation of hop-count mode. It does not infer or
change the production proxy topology.

`oidc-algorithms.cjs` runs fresh ES256, PS256 and EdDSA provider/app fixtures;
the main regression suite covers omitted-setting RS256 compatibility. Each
uses actual code/PKCE login, stable identities, signed logout, replay, expiry,
restart and outage recovery. Unexpected algorithms (even a key in JWKS), HMAC,
unknown keys and tampered signatures cannot create or revoke a session. Invalid
algorithm settings fail configuration validation. Release and PR CI run both.

Custom-host regressions use real HTTP Host headers, not Fetch overrides. A
homepage must not intercept either API alias or case-insensitive API paths;
tests preserve root/login redirects and public aliases, reject cross-site and
invalid explicit credentials, and enforce domain-restricted token privacy.

`browser-domain-proof.cjs` checks the DNS challenge, preserved draft, visible Copy
icons/feedback, claim and reload at 1440/390/320px. Its loopback-only disposable
app needs `NODE_OPTIONS=--require=/kutt/tests/domain-proof-offline.cjs`,
`KUTT_BROWSER_DISPOSABLE=1`, `NODE_APP_INSTANCE=1`, mail/OIDC disabled and a
`/tmp/kutt-smoke-` database. This explicitly guarded TXT fixture only recognizes
generated `.example.invalid` challenges. The QR/dialog suites use the same preload
when their synthetic setup creates custom domains. Never use it in production.

The full suite also runs `analytics.cjs`, `privacy.cjs`, `webhooks.cjs`,
`forwarding.cjs`, `link-health.cjs`, `shortcuts.cjs` and
`security-regressions.cjs`. Their corresponding `browser-*.cjs` scripts use the
same fresh loopback fixtures and desktop/mobile evidence directory. Focused
`KUTT_TEST_ONLY` runs are useful during development but never replace the full
release regression.

`configuration.cjs` runs early in the full suite: secret-file precedence,
fail-closed startup, the read-only aggregate monitoring CLI and manifest assets.
Run `python3 tests/compose-config.py` with Docker Compose installed to render all
four examples using dummy configuration without starting database services.
This does not establish PostgreSQL/MariaDB feature parity.

Run `sh tests/redis-smoke.sh kutt-smoke` separately for a new isolated Redis
container, Bull visit processing and rate-limit persistence across app restarts.
The harness requires an empty test Redis database and never flushes an existing
one. It cleans up its own network namespace, processes and containers.

`browser-shortcuts.cjs` validates the exact downloaded artifact, fixed token
permissions, clipboard wiring (mocked), masking/hiding, error/retry, late-response
suppression and revocation. `browser-login-origin.cjs` needs an HTTPS loopback
fixture to test real browser cross-site login rejection and normal secure-cookie
login. Test-only certificate handling must not be copied into production.

On macOS, `python3 scripts/verify-shortcut.py` checks the signed placeholder
container against its deterministic action graph without importing or executing
it. Native Shortcuts execution with dummy fixtures and physical iPhone acceptance
are separate checks; neither is claimed by headless browser emulation. See
`examples/IOS-SHORTCUT.md` for private first-import checks.
## Webhook secret copy feedback

The suite intercepts unversioned webhook assets with stale fixture responses.
It requires the script and stylesheet URLs to carry the installed release
version, then runs the normal rendered interactions. This is a deterministic
stale-path simulation, not a substitute for inspecting loaded assets in an
existing live browser after a real deployment.

`tests/browser-webhook-copy.cjs` uses a fresh approved loopback fixture with
`KUTT_BROWSER_DISPOSABLE=1`, `KUTT_TEST_URL` and `KUTT_EVIDENCE_DIR`. Start the
disposable app with `NODE_OPTIONS=--require=/kutt/tests/webhooks-offline.cjs`, a
`DB_FILENAME` beginning `/tmp/kutt-smoke-`, loopback `DEFAULT_DOMAIN`, and
`NODE_APP_INSTANCE=1`. The guarded test-only DNS fixture recognizes
`hooks.example.com`; never load it in production. No outbound delivery is made.

At 1440/390/320px, the rendered suite creates a disabled synthetic webhook and
checks native keyboard copy, same-viewport confirmation, fixed button width,
clipboard rejection/unavailability/timeout and retry. It verifies duplicate
suppression, dismissal while pending, rotation with an older copy outstanding,
secret clearing and exact fixture cleanup. Screenshots mask the synthetic secret;
errors never include its value. Real user clipboard acceptance remains separate.

## Logout recovery

`tests/browser-logout-navigation.cjs` targets a fresh approved loopback fixture
with `KUTT_BROWSER_DISPOSABLE=1`, `KUTT_TEST_URL` and `KUTT_EVIDENCE_DIR`.
It waits for the final login form after explicit logout or server-side session
revocation, checks denial and successful rendered recovery at 1440/390/320px,
and rejects duplicate script/browser errors. Waiting for network idle on the
intermediate delayed logout page would miss that regression.

## Image hardening

`docker run --rm --network none --read-only --entrypoint node kutt-smoke tests/image-hardening.cjs`
checks the Alpine production image only: no APK tools/system zlib, retained
CA/TLS dependencies, Node compression and native SQLite. The Dockerfile also
runs it during the build. Do not run it on a developer host.
## Community regression coverage

The shared HTTP test helper uses fresh connections without automatic retries,
then drains ordinary responses before returning a buffered `Response`. This
prevents synchronous child fixtures from reusing stale sockets and avoids the
unread-body close crash in Node's bundled client (`nodejs/undici#5360`). SSE
responses remain streamed. No application behavior or assertions are replaced;
browser, Redis and public smoke tests still exercise their normal transports.
Offline response-schema fixtures use reserved literal addresses instead of
depending on public DNS availability.

`community-correctness.cjs` checks the installed user-agent parser (including
desktop/mobile Safari) and hostname normalization. `community-hostnames.cjs`
exercises actual HTTP create/edit/import/routing, moderation, DNS proof identity,
public Host routing and persisted Safari counts on the disposable smoke database.
Both run in the full container suite. Browser analytics and domain-proof tests
also verify these changes at desktop/mobile widths; Host routing uses Node HTTP
instead of relying on Fetch implementations preserving a supplied Host header.

## Verified Transport TLS

Run from the checkout with Docker and OpenSSL available:

```sh
sh tests/transport-tls.sh kutt-smoke pg
sh tests/transport-tls.sh kutt-smoke mysql2
sh tests/transport-tls.sh kutt-smoke redis
```

Each run generates disposable CA/server/client certificates in a private
temporary directory, starts isolated digest-pinned servers without published
ports or real configuration mounts, and deletes only its recorded container
IDs. Trusted mutual TLS must work; wrong SAN, unknown CA, expired certificates,
missing client credentials and plaintext-only servers must not connect. A
plaintext control proves the last fixture is actually reachable before testing
that TLS does not fall back. Migrations/runtime must agree; encrypted Redis
repeats real cache, Bull worker and restart-persistent limiter tests.

Configuration checks cover CA bundles, default trust, client-key matching,
sanitized startup failures, file precedence and SQLite pool compatibility.
Do not use these fixture scripts against a real database or certificate store.

## Stable Sorting

`list-sorting.cjs` runs in the isolated container suite (`KUTT_TEST_ONLY=list-sorting`
for focused HTTP tests). `list-sort-database.cjs` exercises every sort field and
direction against the real MySQL/PostgreSQL search fixtures. SQLite uses
`list-sort-sqlite.cjs` with `KUTT_DATABASE_DISPOSABLE=1`, `DB_CLIENT=better-sqlite3`
and a fresh `DB_FILENAME=/tmp/kutt-sort-*.sqlite`. CI runs all three engines.

`browser-list-sorting.cjs` requires an empty disposable loopback application,
`KUTT_BROWSER_DISPOSABLE=1`, `KUTT_TEST_URL` and `KUTT_EVIDENCE_DIR`, plus
Playwright/Chromium (`PLAYWRIGHT_MODULE` may name an absolute module path).
It creates fixture users/links, never authenticates to a real deployment, and
checks desktop/mobile controls, admin transitions, native state, multiple drafts
and in-flight list/editor response races. Remove its disposable container/data
afterward; do not run it against retained configuration.

`sh tests/browser-list-sorting.sh IMAGE` provisions and cleans that disposable
container with a loopback-only port and no real mounts. Set `NODE_BINARY` for an
alternate Node runtime and `KUTT_BROWSER_PORT` when port 31119 is occupied.
CI runs the same helper with isolated, version-pinned Playwright tooling.
## Private performance metrics

`tests/metrics.cjs` is part of the isolated full regression suite. Set
`KUTT_TEST_ONLY=metrics` for configuration/listener/authentication, bounded-label
privacy, timing/counter, secret-file rotation, restart and public-route isolation
checks. Only disposable loopback listeners and generated credentials are used.

## Optional CSP

`csp.cjs` is included in the full offline container suite; `KUTT_TEST_ONLY=csp`
selects the focused mode/nonce/header/HTTP boundary gate. Configuration tests
reject unknown and policy-valued modes. Source tests reject bundled executable
attributes and unnonced/inline scripts; concurrent templates cannot override or
share request nonces. APIs, fragments, public redirects and QR SVG retain their
existing headers. Locale and theme catalogs are unchanged.

`sh tests/browser-csp.sh IMAGE` creates a disposable loopback fixture and checks
enforced login, copy, paging/edit, dialogs, chart pixels/map, settings, native
locale forms and protected-link navigation in EN/FR/ES, light/dark, 1440/390/320px.
It also verifies blocked inline/wrong-nonce/external scripts, event attributes and
eval, with a trusted nonce control. Eval executes from a network-loaded script,
not Playwright's privileged Runtime.evaluate stack. Set
`KUTT_TEST_CSP_MODE=report-only` for a nonblocking diagnostic/control run.

Pass `dialogs` or `list-sorting` as the runner's second argument for the existing
modal, pending mutation and delayed list/editor regression suites under enforced
CSP. Additional selections `logout-navigation`, `validation` and `domain-proof`
cover revoked sessions, form failures/drafts and the full DNS ownership flow.
The `date-time` selection runs 18 creation-schedule combinations (EN/FR/ES,
light/dark, 1440/390/320px) with exact second-level results, explicit UTC in a
non-UTC browser timezone, cancel/clear, HTMX draft retention, persisted API
values and public redirect enforcement. It is included in the community runner.
`KUTT_TEST_ONLY=schedule-creation` selects HTTP/API creation validation,
authorization and legacy-expiry compatibility in the offline container suite.
`sh tests/browser-csp-oidc.sh IMAGE` checks enforced SSO-only outage/retry and
top-level provider cancellation with a synthetic loopback development provider.
The runner enables only the guarded offline domain-proof fixture, never
real DNS. `KUTT_TEST_CSP_MODE=enforce sh tests/browser-qr-branding-locales.sh IMAGE`
runs all 18 QR combinations with actual decoding, clipboard/print/races/cleanup.
The QR harness reads captured Blob objects directly; it does not add a synthetic
`fetch(blob:)` requirement to the production policy. See [CSP](../docs/CSP.md) for
the bounded policy, custom-template compatibility and deployment limitations.

`sh tests/browser-community.sh IMAGE` runs the combined community-feature
matrix with CSP enforced, including modal/list/logout/validation/domain/SSO
flows, QR decoding, destination policy, role diagnostics and all three geography
locales. Install the locked `tests/browser-deps` dependencies for the independent
QR decoder and provide `PLAYWRIGHT_MODULE` when Playwright is not locally
resolvable. Both PR and fork release CI run this suite plus real MySQL/PostgreSQL
OIDC role-lifecycle tests. Disposable non-admin database fixtures use the
registration query; administrative creation retains its fresh-actor requirement.
