# Management Interface Polish

The shared `static/css/interface.css` layer loads after feature styles and before
operator custom styles. It preserves the existing workflows rather than adding a
new frontend framework or changing APIs, database records or security policy.

## Changes

- Label and align search with sort controls, with equal heights and input-driven
  pagination reset for typing, paste and native search clearing.
- Set action foregrounds on controls so dark-theme `currentColor` SVG rules do
  not inherit a low-contrast grey. Use readable semantic colours in both themes,
  stable 36px desktop/40px compact targets and visible keyboard focus.
- Remove flex growth and oversized gaps between creation and recent links.
- Keep one select arrow, stack mobile sort fields to fit translated selections,
  wrap compact filters and group Settings navigation.
- Keep Library actions horizontal and Admin filters in a responsive grid.
- Hide zero-visit analytics charts/maps/tables while retaining totals, filters
  and exports. Populated reports reappear after filtering; no data is discarded.
- Use consistent modest control corners and borders without hover displacement.

## Verification

```sh
docker build -t kutt-interface .
for locale in en fr es; do
  KUTT_TEST_LOCALE="$locale" KUTT_EVIDENCE_DIR="/tmp/kutt-interface-$locale" \
    sh tests/browser-csp.sh kutt-interface interface
done
sh tests/browser-theme.sh kutt-interface
KUTT_TEST_CSP_MODE=enforce sh tests/browser-geography.sh kutt-interface
sh tests/browser-community.sh kutt-interface
```

Use the Playwright installation instructions in `tests/README.md`. The interface
suite checks five widths (1440, 1024, 768, 390 and 320), both themes, 22 management
pages and list/empty/edit/confirmation states under enforced CSP. Actual SVG
stroke/fill contrast must reach 3:1 on opaque action backgrounds; control geometry,
focus, selected-label fit, search reset, compact rows and empty reports are checked separately.
Existing suites verify rendered text, populated reports, exports, dialogs, native
date/time selection and authorization boundaries. CI runs all three locales.

Responsive Chromium tests do not establish physical iOS/Safari or Firefox
acceptance. Operator overrides, WAF and real identity-provider behaviour need
separate deployment validation. No optional security control is disabled here.
No migration is required; a code rollback preserves the database and restores
the prior visual defects. Preserve recoverable backups and signing secrets.
