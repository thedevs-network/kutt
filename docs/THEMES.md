# Appearance

The footer offers System, Light and Dark. System is the initial preference and
tracks the OS/browser color scheme. A selection is saved only in this browser's
`kutt.theme` local-storage entry, never in an account, cookie, URL or shared API
response. Another tab sees changes through the standard storage event. Unknown
values fall back to System. If storage is denied, the current page still applies
the choice; persistence cannot be guaranteed. Without JavaScript, the existing
light layout remains usable and the inactive selector is hidden.

The four footer labels use the English/French/Spanish catalogs (`theme.*` keys).
The radio values and stored preferences remain `system`, `light` and `dark` in
every language. Native language changes retain the current theme preference.
See [Localization](LOCALIZATION.md) for catalog conventions and locale selection.

The tiny same-origin `/scripts/theme.js` initializes before styles to avoid a
light flash. It sets only validated root attributes, never evaluates stored text,
does not read credentials or contact a network service. `/css/theme.css` keeps
semantic error/success colors, focus indication, native control schemes and dark
surfaces separate from the unchanged light palette. `/scripts/chart-theme.js`
adjusts chart labels, grid lines and tooltips at creation and when switching.
QR images/quiet zones and their print sheet remain black on white.

Custom layouts can opt in with the early theme script, theme stylesheet after
the base styles, and `{{> theme_picker}}` in the footer. Keep custom styles later
to retain override precedence. Chart pages load `chart-theme.js` after Chart.js
and before their chart-creation script. Custom charts/templates are not rewritten.

No database migration, server API or deployment setting is required. Rollback
is an ordinary image rollback; an old image simply ignores this storage key.
Public short links and management authorization are unaffected.

## Validation

`tests/theme.cjs`, included in the full container suite, exercises allowlisting,
early initialization, unrelated storage isolation, blocked storage, media and
cross-tab changes, public static assets and the authenticated selector. Run it
with `KUTT_TEST_ONLY=theme` against a disposable image.
The HTTP selector assertions cover all three catalogs and unchanged radio values.

`sh tests/browser-theme.sh IMAGE` creates a fresh loopback-only temporary app and
removes only its own container. It accepts `NODE_BINARY`, `PLAYWRIGHT_MODULE`,
`KUTT_BROWSER_PORT` (default `31122`) and `KUTT_EVIDENCE_DIR` outside the checkout.
Use `KUTT_TEST_LOCALE=fr` or `es` for translated labels; omission preserves the
default English baseline. Each language run checks 90 management-page layouts.
Chromium checks cover 1440/390/320px management pages in both themes, persisted
and live OS changes, cross-tab state, unavailable storage, computed text contrast,
rendered chart pixels/colors and white QR print sheets. Screenshot inspection
remains necessary; numerical contrast checks are not a full accessibility audit.
Native Safari/Firefox, assistive technology and physical displays are not covered
by this Chromium gate.
