# Community Features

This contribution includes C01-C21 alongside the original managed-link workflows.
This is a source and review guide, not a deployment ledger. Installation-specific
screenshots, credentials, backup identifiers and release acceptance records are
not part of this guide. See [proposal credits](UPSTREAM-PR-REVIEW.md) and the
[UI review](UI-UX-REVIEW.md) for design lineage and browser acceptance limits.

## Included Changes

| ID | Behavior and compatibility boundary | Guide | Focused regression |
| --- | --- | --- | --- |
| C01 | Correct Safari classification for new visits; no historical rewrite | [Analytics](ANALYTICS.md) | `tests/community-correctness.cjs` |
| C02 | Remove only leading `www.`; preserve interior hostname labels and existing records | [Custom domains](CUSTOM-DOMAINS.md) | `tests/community-hostnames.cjs` |
| C03 | Transactional ban/unban, independent-ban preservation, session/token revocation and admin safeguards | [Moderation](MODERATION.md) | `tests/moderation.cjs`, `tests/moderation-database.cjs` |
| C04 | Strict trusted peers/CIDRs or bounded hops; legacy boolean semantics retained | [Configuration](DEPLOYMENT.md) and `.example.env` | `tests/proxy-trust.cjs` |
| C05 | Optional off/report-only/enforce CSP, request-local nonces and delegated handlers; no script unsafe-inline/eval escape | [CSP](CSP.md) | `tests/csp.cjs`, `tests/browser-csp.sh` |
| C06 | MySQL utf8mb4 search with consistent filters, counts and pagination | [Database configuration](DEPLOYMENT.md) | `tests/search-database.sh` |
| C07 | Shared verified database TLS with CA/client certificate/key file support | [TLS](TRANSPORT-TLS.md) | `tests/transport-tls.sh` for pg/mysql2 |
| C08 | Consistent verified Redis TLS for cache, Bull and limiting | [TLS](TRANSPORT-TLS.md) | `tests/transport-tls.sh` for Redis |
| C09 | Explicit asymmetric OIDC algorithms, RS256 default and signed-logout parity; no none/HMAC | [OIDC](OIDC-SECURITY.md) | `tests/oidc-algorithms.cjs` |
| C10 | Exact API route exclusion from custom-homepage redirects; alias boundaries retained | [Custom domains](CUSTOM-DOMAINS.md) | `tests/community-hostnames.cjs` |
| C11 | Complete EN/default, FR and ES catalogs for bundled UI/mail/errors; escaped request-scoped formatting | [Localization](LOCALIZATION.md) | `tests/i18n.cjs`, `tests/browser-i18n.sh` |
| C12 | Allowlisted stable sorting across personal/admin/library/workspace lists; drafts and filters retained | [Sorting](LIST-SORTING.md) | `tests/list-sorting.cjs`, `tests/browser-list-sorting.sh` |
| C13 | Ephemeral bounded PNG logos in real PNG/SVG exports; canonical plain base64 preferred, exact legacy PNG data URI accepted | [QR branding](QR-BRANDING.md) | `tests/qr-branding.cjs`, `tests/browser-qr-branding-locales.sh` |
| C14 | System/light/dark appearance, accessible controls and chart/QR contrast | [Themes](THEMES.md) | `tests/theme.cjs`, `tests/browser-theme.sh` |
| C15 | Opt-in signed OIDC claim-to-admin mapping with bounded expiry, transactional write-time guards and protected local recovery admin | [OIDC roles](OIDC-SECURITY.md) | `tests/oidc-roles.cjs`, `tests/oidc-roles-database.cjs`, `tests/oidc-role-writes.cjs` |
| C16 | Optional management origin and explicit per-user domain grants; no global implicit sharing or cross-owner analytics | [Domain sharing](DOMAIN-SHARING.md) | `tests/management-domain-grants.cjs`, `tests/domain-access-read.cjs`, `tests/browser-domain-grants.sh` |
| C17 | Optional destination-host policy across writes, imports, routing and health; authorized unchanged-target metadata repair preserved | [Destination policy](DESTINATION-POLICY.md) | `tests/destination-policy.cjs`, `tests/destination-policy-edit-races.cjs` |
| C18 | Separate opt-in authenticated metrics listener with bounded labels and no URLs/identities | [Metrics](METRICS.md) | `tests/metrics.cjs` |
| C19 | Safe interior dots in case-sensitive aliases; length/segment/reserved/traversal controls | [Aliases](LINK-ALIASES.md) | `tests/dotted-aliases.cjs`, `tests/dotted-alias-database.sh` |
| C20 | Local interactive geography with keyboard controls and textual country table; creator-only analytics preserved | [Analytics](ANALYTICS.md) | `tests/geography.cjs`, `tests/browser-geography.sh` |
| C21 | Profile-led SQLite hourly lookup index; durable transactional aggregation retained, no new batching | [Visit performance](VISIT-PERFORMANCE.md) | `tests/visit-hour-index.cjs`, `tests/profile-visits.cjs` |

## Original Workflows Retained

The original features remain part of the same contribution: [scoped tokens and
idempotency](API-TOKENS.md), [link availability](LINK-LIFECYCLE.md),
[history/trash/restore](LINK-HISTORY.md), [stable OIDC identities](OIDC-SECURITY.md),
[Library](LIBRARY.md), [transfer](TRANSFER.md), [QR exports](QR-CODES.md),
[workspaces](WORKSPACES.md), [routing](ROUTING.md), [analytics](ANALYTICS.md),
[privacy/retention](PRIVACY.md), [webhooks](WEBHOOKS.md),
[forwarding](FORWARDING.md), [destination monitoring](DESTINATION-HEALTH.md)
and the optional [iOS Shortcut](../examples/IOS-SHORTCUT.md).
DNS ownership proof, campaign building and the existing UI/security fixes are
retained, not replaced by older upstream proposals.

## Upgrade Boundaries

- Preserve the database and original signing/encryption secret together. Review
  additive migrations and each feature's recovery notes; an older image can
  ignore new policies even when it can read the schema.
- CSP, management-host isolation, OIDC admin mapping, destination policy, TLS and
  metrics need explicit configuration. Do not enable them by assuming a test
  topology matches an existing reverse proxy or identity provider.
- Native domain-grant revocation names the recipient/domain and requires a
  read-only confirmation page followed by an origin-checked POST. Cancel does
  not mutate. Revocation permanently invalidates scoped tokens and disables
  health monitoring; regranting does not restore either automatically. API
  DELETE remains direct. Public redirects and ownership remain unchanged.
- QR uploads use canonical plain base64 in browser JSON without a data-URI
  prefix. Exact legacy PNG data URIs remain application-compatible. WAF
  acceptance must be tested without weakening policy; no deployment result is
  inferred from successful loopback tests.
- Locale changes do not translate machine values, URLs, token scopes or signed
  inputs. Custom templates retain precedence but need the documented locale,
  theme and CSP integration.

## Reproducible Gates

Use only disposable databases and synthetic accounts. Start with
[tests/README.md](../tests/README.md); the root Dockerfile builds the test image.

```sh
docker build -t kutt-test .
docker run --rm --network none --entrypoint node kutt-test tests/container-smoke.cjs
sh tests/redis-smoke.sh kutt-test
sh tests/browser-community.sh kutt-test
sh tests/search-database.sh kutt-test mysql2 tests/oidc-role-writes.cjs
sh tests/search-database.sh kutt-test pg tests/oidc-role-writes.cjs
```

The browser runner requires the documented Playwright and locked test-decoder
setup; evidence stays outside Git. CI also exercises real MySQL/PostgreSQL
search, OIDC roles and domain grants, plus real database/Redis TLS. Run the
additional alias, moderation, sorting, visit and security database fixtures
listed in the test guide when changing those boundaries. Keep the original
browser workflows, full SQLite suite and Redis restart coverage alongside the
new focused selectors. The [release workflow](../.github/workflows/fork-release.yaml)
runs the role-write regression on both real SQL engines. The full SQLite suite
also checks mapping enabled and never enabled: expiry, role loss and session
revocation between authentication and mutation must not commit link edits,
deletions or history records. Both API prefixes and edit routes are covered,
with owner, granted-domain and workspace-collaborator controls preserved.

The community browser runner covers enforced CSP, QR branding, destination
policy and edit recovery, OIDC roles, domain grants and geography. Localization,
sorting and appearance have additional dedicated matrices. Coverage includes
320/390/1440px, EN/FR/ES and both themes where applicable; it is not a claim that
every possible combination or physical browser/device was tested.

Analytics domain/tag filters expose overflowing selected values as associated,
wrapping text. CSV/JSON export links use existing theme-button semantics while
preserving their current-color icons, URLs, filenames and API formats.
`tests/browser-geography.cjs` measures both export links against their rendered
backgrounds at a minimum 4.5:1 in normal, hover and keyboard-focus states, and
downloads both formats with the active filters in every language/theme/width
layout. These assertions complement the existing selected-value, creator-only
analytics and revoke/regrant checks in `tests/browser-domain-grants.cjs`.

The 1,519-key catalogs retain identical key and placeholder contracts. Reviewed
copy uses formal Spanish management commands, distinguishes moderated entries
from link destinations, and explains geography percentages naturally in French
and Spanish without changing their denominator. `tests/i18n.cjs` pins these
wording and escaped-interpolation contracts; `tests/i18n-community.cjs` checks
localized JSON errors under both API prefixes and native HTML errors. The
existing moderation, sorting and geography browser suites exercise the affected
rendered surfaces, including compact confirmation text and wrapping percentage
explanations.

Passing source/CI checks do not certify live DNS, TLS, WAF, IdP admission, backup
recovery, physical printing, native clipboard behavior or iPhone Shortcut
execution. Revalidate the final reconciled commit; no upstream merge or completed
production rollout is claimed here.
