# UI/UX Improvements And Validation

This contribution contains the reusable managed-link UI fixes and the community
features described in [the source guide](COMMUNITY-FEATURE-ROADMAP.md).
Deployment-specific screenshots and chronological operator records are excluded.
This is not a claim of exhaustive accessibility or security conformance.

## Existing Workflows

| Area | Preserved behavior | Main regression |
| --- | --- | --- |
| Editing | Unchanged relative expiry does not extend a link; stale changes require conflict review | `expiry-edit.cjs`, `browser-expiry-edit.cjs` |
| Collaboration | Signed revisions prevent concurrent availability loss; non-secret drafts survive errors | `workspace-edit.cjs`, `browser-workspace-edit.cjs` |
| Admin editing | Correct owner/domain context and authorized editor on success and failure | `admin-edit.cjs`, `browser-admin-edit.cjs` |
| Keyboard/layout | Named actions, visible focus, deliberate wrapping, usable tables and content-sized headings | `browser-accessibility.cjs`, `browser-tables.cjs`, `browser-table-zoom.cjs`, `browser-headings.cjs` |
| Dialogs | Focus containment/return, background isolation, cancellation and stale-response suppression | `dialogs.cjs`, `browser-dialogs.cjs` |
| Library/forms | Accurate lifecycle/bulk feedback, local errors, correction focus and preserved drafts | `library-ux.cjs`, `validation.cjs`, corresponding browser suites |
| Transfer | Downloadable examples, actionable row errors and preserved authorization | `transfer.cjs`, `browser-transfer.cjs` |
| Authentication | Configuration-aware labels and one-document login/logout/revoked-session navigation | `login-copy.cjs`, `login-navigation.cjs`, `browser-logout-navigation.cjs` |
| Webhooks/clipboard | Local pending/success/error feedback and stale-copy suppression after dismissal/rotation | `webhooks.cjs`, `browser-webhook-copy.cjs`, `browser-copy.cjs` |
| One-time tokens | Masked responsive field, explicit reveal/copy/hide and lifecycle cleanup | `token-secret.cjs`, `browser-copy.cjs` |
| API feedback | Validate status, content type and consumed schema before claiming success | `responses.cjs`, `browser-responses.cjs` |
| Public recipients | Neutral branded 410 pages without private destination/lifecycle details; bodyless HEAD | `unavailable.cjs`, `browser-unavailable.cjs` |
| Domain ownership | Signed user-bound DNS proof, immediate form activation for fast submits, retained draft and visible Copy feedback | `security-boundaries.cjs`, `browser-domain-proof.cjs` |

## Community Workflows

- [Localization](LOCALIZATION.md): English is the default; French and Spanish
  cover bundled templates, browser feedback, mail and API human messages.
  Escaped stable keys, plural/date/number formatting and request-local state
  replace English DOM postprocessing. Machine values remain unchanged. The
  native selector works without JavaScript; custom text is not auto-translated.
- [Appearance](THEMES.md): System/light/dark modes, early preference selection,
  keyboard controls, storage-denial/cross-tab behavior and readable charts/forms.
  QR previews retain white image backgrounds and quiet zones in both themes.
- [CSP](CSP.md): opt-in report-only/enforce with per-document nonces and
  self-hosted delegated handlers. Bundled HTMX, dialogs, charts, forms, QR and
  authentication are exercised under enforcement. No script unsafe-inline/eval
  fallback is added; custom templates need explicit integration.
- [Sorting](LIST-SORTING.md): consistent allowlisted keys and stable pagination
  in personal/admin/library/workspace views. Filters, disabled sort state,
  active drafts and pending editor loads survive delayed list responses.
- [QR branding](QR-BRANDING.md): PNG file chooser, sanitized preview, remove,
  download PNG/SVG, copy and print with pending/error recovery and blob cleanup.
  The logo is embedded in exported pixels, not a cosmetic overlay. Browser JSON
  sends canonical plain base64; exact legacy PNG data URIs remain API-compatible.
  Real exported PNG and rasterized SVG are independently decoded.
- [Moderation](MODERATION.md): native confirmation, safe errors/status codes,
  independent-ban preservation and fresh administrative authorization. Existing
  sessions and tokens cannot revive when an account is unbanned.
- [Domain sharing](DOMAIN-SHARING.md): explicit recipient grants with no global
  sharing or cross-owner analytics. Native revoke first displays recipient,
  domain and irreversible token/health consequences. Keyboard Cancel is
  non-mutating; only the origin-checked POST commits. This works with JavaScript
  disabled. Gone grants return controlled errors, stale confirmations cannot
  revoke a later regrant, and ownership/admin permission is checked freshly.
  Regranting does not reactivate revoked scoped tokens or health schedules.
  Grant-list authorization and recipient reads use the same guarded transaction,
  so a former owner cannot receive recipients added after domain reassignment.
- [Destination policy](DESTINATION-POLICY.md): localized policy feedback and
  read-only policy discovery. Authorized metadata-only repair can preserve an
  unchanged denied target; it cannot change destinations or bypass ownership.
- [Geography](ANALYTICS.md): local map assets, keyboard zoom/pan/reset and a
  textual country table, including missing/unknown data and retry states.
  Interaction does not fetch a tracking service or broaden analytics access.
- [Analytics filters and exports](ANALYTICS.md): responsive domain/tag controls
  expose long selections as associated wrapping text, not tooltip-only content.
  CSV/JSON links use existing theme-button styling and current-color icons.
  Rendered regressions require at least 4.5:1 text/background contrast in normal,
  hover and keyboard-focus states across both themes and all three widths/locales,
  with actual downloads preserving filters, filenames and API data formats.
- [Dotted aliases](LINK-ALIASES.md): valid interior dots work across forms and
  APIs without weakening reserved-path, traversal or forwarding boundaries.

## Security And Compatibility

Public short links remain public, with existing password/lifecycle/routing checks.
An optional management hostname isolates management routes without redirecting
credentials from a wrong host; protected-link forms submit on their actual short
authority, including accepted www aliases. Session cookies stay host-only.

Edit receipts, confirmation pages and UI-disabled controls are not authorization
boundaries. Fresh ownership, workspace membership, token scope/domain, role
expiry and origin checks remain authoritative. Password drafts are not echoed.
Hiding a one-time token does not revoke it or erase the system clipboard.

HTML native forms retain a same-origin Referrer-Policy so their Origin remains
valid. Opaque null and foreign browser origins are not accepted to make a form
work. API DELETE grant revocation intentionally retains its direct contract.

## Reproduction And Limits

Use [tests/README.md](../tests/README.md) for isolated full-container, Redis,
real-database and rendered fixtures. Browser suites use synthetic loopback
instances and fresh profiles, and keep screenshots outside the repository.
Never substitute a production database or personal browser profile.

The original matrix covers compact layouts, long titles/URLs, admin/ordinary/
signed-out roles and actual 200/400% Chromium zoom. New focused matrices exercise
320/390/1440px, EN/FR/ES and light/dark where applicable. Native keyboard,
JavaScript-disabled domain confirmation, delayed editor/list/QR responses,
malformed successes, denial and retry are separate assertions, not inferred
from a screenshot or document-width check.

- Browser QR tests decode actual downloaded images, inspect print CSS, and test
  clipboard completion/failure with synthetic controls. They do not establish
  physical printing, native file-save completion or OS clipboard acceptance.
- Source and loopback tests do not prove live WAF, TLS, DNS, mail or IdP behavior.
  In particular, verify plain-base64 QR uploads through the actual WAF without
  relaxing rules. Do not claim deployment acceptance from a successful decoder.
- SQLite runs the full feature suite. PostgreSQL/MySQL have focused execution
  for documented boundaries, not an exhaustive parity guarantee; MariaDB is
  configuration coverage only.
- Custom themes/templates, Safari/physical mobile devices and the signed iPhone
  Shortcut need their own acceptance. The Shortcut's signed bytes remain
  unchanged; localized setup guides do not translate the signed artifact.
- Prior operator-specific acceptance is not evidence for another installation.
  Re-run the final reconciled commit's gates before publishing or deploying.
