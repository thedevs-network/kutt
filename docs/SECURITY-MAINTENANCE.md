# Security maintenance

## Security boundary release (3.2.6-sr94.40)

The September 19 authenticated source review finalized seven medium findings.
The release addresses bounded webhook admission/fairness, atomic domain claims,
DNS ownership proof, stale email-change capabilities after account recovery,
verification-link login CSRF, legacy management CSRF and pathological URL parsing.
Source scan identity: `6a68942a-7442-49ba-aad5-b2313775bada`. Scan evidence and the
separate fix report are retained privately; no credentials appear in public docs.

- New domain claims use [DNS TXT proof](CUSTOM-DOMAINS.md), without changing
  existing domains or allowing a concurrent claimant to overwrite ownership/bans.
- Cookie-authorized legacy writes enforce the existing trusted-origin boundary.
  An ignored API-key field cannot exempt a request authenticated by its cookie.
- Verification GET confirms only the token action, never creates or switches a
  browser login. HEAD is non-consuming. The user explicitly signs in afterward.
- Password recovery/change, email change and session revocation clear pending
  recovery/email-change capabilities. Issuance and consumption recheck the
  current authentication generation at the final database write. Re-registering
  an unverified account also retires previous capabilities.
- Legacy API authentication reads current persisted state, avoiding stale Redis
  principals after revocation and preventing cached rotated keys from logging in.
- URL validation rejects oversized/non-string values before parsing. Userinfo
  matching no longer contains overlapping backtracking alternatives.
- Webhook admission has durable owner/global rate and outstanding-work caps,
  with owner-fair leasing. Queue exhaustion cannot veto a fresh administrator's
  ban/trash action: the audit event records an explicit notification omission.
  Ordinary mutations remain transactional and fail with 429 without partial save.
- The isolated Redis test harness removes only its own recorded container ID,
  never a different container whose name collided with its proposed fixture name.

An independent patch review caught the administrative moderation and stale-cache
edge cases before publication. Both have dedicated regression coverage. Full
source/exact-image regression, Redis and targeted PostgreSQL/MySQL checks passed.
The release was published and deployed on September 19; public WAF/SSO checks,
real DNS ownership proof, monitored health and byte-verified pre/post off-host
writable restores passed. Exact identities and dated evidence are in the
[UI/UX ledger](UI-UX-REVIEW.md). Published/wrapper image scans retain zero
Critical/High and three Medium BusyBox matches with no vendor fix listed; this
is not an exhaustive security certification.

The migration invalidates pending password-reset/email-change links once. Users
request fresh links as needed; passwords, API keys, signing secrets, sessions,
existing domains and short links are not reset. See [upgrade recovery](DEPLOYMENT.md).


## Runtime image hardening (3.2.6-sr94.37.1)

The September 18 fresh vulnerability database identified CVE-2026-85091 in
Alpine's system `zlib` 1.3.2-r0. This blocked deployment of `.37`; that release
was published but never deployed. Do not reuse a cached clean scan as evidence
for a later release.

The pinned runtime uses system zlib only for `apk-tools`/`libapk`. Node and the
application's native bindings do not link it. Remove these three build-only
packages after dependency installation, while explicitly retaining
`ca-certificates-bundle`, `libcrypto3`, `libssl3` and `ssl_client`. Keep the APK
installed-package database intact for truthful scanning. Node's bundled
compression library is distinct; removing system zlib is not a claim that all
compression code is vulnerability-free.

`tests/image-hardening.cjs` runs during Docker build and in isolated image CI.
It checks package/file removal, preserved system and Node trust stores, TLS
helper dependencies, compression round trips and SQLite. Rebuild rather than
install packages into a running container. Re-run full runtime, OIDC and image
scans whenever the pinned base or dependencies change. Do not suppress a new
finding simply to pass deployment. `.37.1` passed CI, exact-image runtime/browser
regression, public WAF/SSO regression, monitored health and pre/post NAS writable
restore. Fresh source/wrapper scans reported zero critical/high and three medium
BusyBox-family matches for CVE-2025-60876 with no fixed version listed. This is a
dated image result, not a vulnerability-free claim. The `.38` logout correction
retains the same hardening and passed exact-image, live, monitored health and
pre/post NAS writable restore gates on September 18; see the audit for evidence
and the separate remaining user-assisted acceptance limits.

New tokens are masked by default, re-masked on backgrounding and removed from
displayed state on dismissal/page exit. Copy errors never auto-reveal them, and
late callbacks cannot repopulate a dismissed panel. Masking is not revocation.
Logout uses fixed-root full document navigation and clears the cookie with
no-store caching; this changes no OIDC/session/scope enforcement. Test both
native and HTMX responses, denied management and rendered session recovery.

Release `.39.2` adds local webhook Copy confirmation with bounded error handling
and stale-callback protection, plus release-versioned script/stylesheet URLs.
No credentials, delivery rules, authorization, schema or cache/WAF policy change.
The published source and exact wrapper retain zero critical/high and three medium
BusyBox findings in the September 18 database. Full regression, existing-browser
loaded-resource checks, public security/health and pre/post writable restore
passed. A bounded review found no actionable regression in this change; neither
that review nor image scanning is an exhaustive security certification.

## Roadmap release 3.2.6-sr94.16

These changes accompany release `v3.2.6-sr94.16`. Publication and deployment
are separate gates recorded in [the roadmap](FEATURE-ROADMAP.md).

## Source-review corrections

- Retention policy operations require a current administrator browser session;
  explicit legacy/scoped keys cannot inherit a cookie or administer retention.
- Partial owner/admin link edits preserve an omitted password. Explicit null
  or empty input removes it; the existing masked placeholder preserves it.
- Protected redirects share a 10-attempt/minute link-and-IP password budget
  across Basic GET/HEAD and both POST aliases, even when optional management
  rate limiting is disabled. Merely displaying the password form is not counted.
- Authentication rate limits share canonical route keys across case and API
  aliases. Invalid/used reset tokens are refused before password hashing. Final
  reset/email-change updates recheck token/expiry predicates atomically.
- Referrer dimensions are bounded for future writes and report rendering.
  Historical detail is preserved, not silently deleted; visit totals remain.
- Abuse-report email is plaintext. The report URL is bounded and validated;
  report submissions have an independent always-on rate limit.
- Password-protected redirects recheck domain/link availability, including
  domain bans, before accepting a password and again before redirecting.
- Local password login refuses cross-site browser origins/form submissions.
  Canonical origins come from configuration, not an untrusted Host header.
  Non-browser clients without Origin retain the existing API login contract.
- All email credential-action buttons, including Outlook/VML fallbacks, use
  HTTPS. Passwords, codes and recovery links must never be logged or published.

No data migration, credential reset, WAF exception, or account remapping is
required for these corrections. Restart the app after deploying. In-memory
rate-limit state resets on process restart; use private shared Redis for
multi-process persistence across app restarts. Never rely on app throttles as
a replacement for perimeter limits or monitoring.

Locked parser dependencies (`body-parser` 1.20.8, `qs` 6.16.0) and Bull's
CommonJS UUID dependency (11.1.1) are patched. UUID is a targeted override,
not a Bull major-version upgrade; Redis/Bull compatibility is tested separately.
Image scanning is a separate gate and does not prove the absence of code flaws.

## Reproducible tests and residual boundaries

`tests/security-regressions.cjs` runs in the isolated full smoke suite and
exercises the boundaries above with dummy credentials/data. The HTTPS
`tests/browser-login-origin.cjs` reproduces a real cross-origin browser form
submission and verifies normal login on desktop/mobile. Its loopback-only
self-signed test certificate does not disable production TLS verification.
`tests/configuration.cjs` covers secret files and the read-only monitoring CLI.

The Shortcut template has no real account/credential embedded. Hash and semantic
verification check the signed container against the deterministic reviewed
action graph. Desktop/mobile setup tests include one-time masking, pagehide,
late-response suppression, error/retry and revocation. A desktop browser test
is not physical iPhone acceptance; native macOS execution and iPhone behavior
must be described separately in the [Shortcut guide](../examples/IOS-SHORTCUT.md).

Remaining deployment risks include shared-IP rate-limit contention, the legacy
application proxy-trust default, nonpersistent Redis examples and database-engine
coverage. Configure them explicitly using [deployment guidance](DEPLOYMENT.md).
The full feature suite targets SQLite; do not infer PostgreSQL/MariaDB parity
from configuration validation alone. OS package advisories without a vendor
fix must be recorded in the release scan rather than suppressed.
