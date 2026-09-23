# Optional Content Security Policy

`CSP_MODE` accepts exactly `off`, `report-only` or `enforce`. It defaults to `off`
for compatibility with existing custom templates. Unknown, empty, misspelled or
policy-valued settings fail startup; there is no arbitrary policy/origin input.
This feature does not change authentication, authorization, TLS, proxy trust,
WAF rules, OIDC provider configuration or the application version.
This is defense-in-depth hardening, not a claim of a demonstrated exploitable
injection or a comprehensive application audit.

| Mode | Document header | Behavior |
| --- | --- | --- |
| `off` | No application CSP header | Existing browser behavior and HTMX evaluation defaults |
| `report-only` | `Content-Security-Policy-Report-Only` | Browser diagnostics without policy blocking; HTMX evaluation and fragment scripts remain enabled for staging customizations |
| `enforce` | `Content-Security-Policy` | Policy blocks disallowed content; HTMX evaluation and fragment scripts are disabled |

Enable `report-only` in an isolated test deployment first. Exercise your actual
custom templates, authentication, forms and integrations; inspect browser CSP
console messages and `securitypolicyviolation` events. Fix violations, then test
`enforce` before a separately authorized production change. A mode change requires
an application restart. There is no automatic fallback if a customization fails.
An independently configured proxy CSP still applies; multiple policies intersect
rather than replace each other. Do not weaken edge controls to hide conflicts.

## Policy and boundaries

In either active mode, all HTML sent through `res.render` receives
`Cache-Control: private, no-store, no-transform`, including HTMX/API fragments
and rendered error pages. Only full, non-API HTML documents receive the nonce
policy header. Their fresh 192-bit cryptographic nonce is shared by the response
header and trusted template helpers, isolated across concurrent requests.
Body, query, request headers and template model fields cannot supply the nonce.
Do not cache these documents at a reverse proxy or reuse a nonce in static HTML.

The fixed policy is:

```text
default-src 'none'; base-uri 'none'; object-src 'none';
frame-ancestors 'self'; frame-src 'none';
script-src 'nonce-<generated>'; script-src-attr 'none';
style-src 'self' 'nonce-<generated>'; style-src-attr 'none';
img-src 'self' data: blob:; font-src 'self'; connect-src 'self';
form-action 'self'; manifest-src 'self'; worker-src 'none'; media-src 'none'
```

There is no script URL allowlist, wildcard, `unsafe-inline`, `unsafe-eval` or
`strict-dynamic`. Each trusted script element needs the server nonce, including
self-hosted scripts. Images allow `data:` and `blob:` for locally generated QR
previews and sanitized logos; this does not permit fetching arbitrary remote
resources. Clipboard permissions and secure-context requirements are unchanged.

HTMX/API fragments do not receive a replacement document policy. Non-rendered
JSON responses, attachments, static assets and public HTTP redirects retain
their existing headers; QR SVG attachments keep their independent
`default-src 'none'; sandbox` policy. CSP
governs browser documents, not API access or validation of link destinations.
OIDC authorization/logout and public targets remain top-level navigations, not
cross-origin forms, frames or script fetches. Protected-link forms still submit
to the same origin before navigating to their validated destination.

The `no-transform` directive prevents intermediary HTML rewriting that can
inject scripts without the application nonce. Cloudflare documents that
[Email Address Obfuscation does not apply to responses with this directive](https://developers.cloudflare.com/waf/tools/scrape-shield/email-address-obfuscation/).
This avoids its injected email-decoding script without adding a script allowlist
or changing Cloudflare/WAF configuration. Check that any other HTML-transforming
proxy respects the directive; edge behavior still requires deployment-specific
verification. Mode `off` retains the previous response headers.

No `report-uri`, `report-to` or report receiver is installed. Diagnostics stay in
the browser, so CSP reports cannot disclose document URLs, aliases or tokens to
a third party through this feature. Report-only is a local diagnostic stage,
not a central telemetry service. Avoid forwarding sensitive console output.

## Bundled UI and customizations

Bundled templates no longer contain executable `onclick`, `hx-on:*` or evaluated
`hx-vals` attributes. `static/scripts/ui-events.js` delegates named, inert data
attributes to explicit handlers. Capture-phase handlers preserve the former
target-handler order for dialogs, list drafts, pagination and HTMX requests.
Stats IDs are escaped template data and copied into request parameters without
eval; map handlers receive their event explicitly. Charts, QR downloads/copy/
print, forms, theme scripts and locale assets stay self-hosted.

HTMX's generated indicator style uses `inlineStyleNonce`. With either active CSP
mode, `attributesToSettle` includes only `class`, `width` and `height`, not
`style`: swapping copied style attributes would violate the style policy. Use
class-based transitions; trusted scripts may still set individual CSSOM
properties. `off` retains HTMX's previous settling configuration.

Custom view lookup still prefers `custom/views`; custom `/css` and `/images`
still take precedence, with custom CSS loaded after bundled CSS. There is no
new custom-script search path. Preserve the updated base layout/config and its
script includes when overriding a layout. For additional trusted script tags:

```hbs
<script nonce="{{cspNonce}}" src="/scripts/my-extension.js" defer></script>
```

Serve extensions through your existing controlled static-asset build. The
`cspNonce` helper takes no arguments and must only be used on administrator-
controlled code, never arbitrary user HTML or a user-selected script URL.
Nonce-bearing scripts are trusted capabilities, not a sanitizer. Do not copy
nonces from API requests or fragment responses, add them to every DOM script,
or turn an unsafe customization into a trusted one automatically.
Deploy the templates and scripts together and reload already-open browser tabs;
old layouts without the delegated script cannot operate the new fragment hooks.

Move custom inline event handlers, `hx-on`, `js:` values, expression-based
`hx-trigger` filters and eval-dependent libraries into explicit event listeners
in trusted scripts. Keep dynamic text as escaped data/textContent. Load scripts
in the full layout and delegate events for later fragments: enforcement does
not execute scripts inserted by HTMX. Put inline styles in self-hosted CSS and
replace external fonts/images/fetches with reviewed same-origin assets. Trusted
custom `<style>` elements can use `nonce="{{cspNonce}}"`; style attributes cannot.
New third-party integration requirements require a separately reviewed policy
change, not a catch-all escape or automatic disabling of protection.

## Verification

`tests/csp.cjs` covers strict configuration, concurrent nonce isolation, hostile
nonce/policy inputs, bundled source contracts, localized HTML and nonce freshness.
Real HTTP cases check `no-transform` on full documents, HTMX/API fragments and
rendered errors, document-only CSP, and unchanged off-mode, JSON/error, static,
redirect and PNG/SVG attachment headers. It runs in the full container suite;
`KUTT_TEST_ONLY=csp` selects only its focused development fixture.

```sh
sh tests/browser-csp.sh IMAGE
KUTT_TEST_CSP_MODE=report-only sh tests/browser-csp.sh IMAGE
sh tests/browser-csp.sh IMAGE dialogs
sh tests/browser-csp.sh IMAGE list-sorting
sh tests/browser-csp.sh IMAGE logout-navigation
sh tests/browser-csp.sh IMAGE validation
sh tests/browser-csp.sh IMAGE domain-proof
sh tests/browser-csp-oidc.sh IMAGE
KUTT_TEST_CSP_MODE=enforce sh tests/browser-qr-branding-locales.sh IMAGE
KUTT_TEST_CSP_MODE=enforce sh tests/browser-geography.sh IMAGE
```

These runners create and remove fresh loopback-only SQLite containers with
synthetic credentials and no production mounts. Set `NODE_BINARY` and
`PLAYWRIGHT_MODULE` for local tooling; QR decoding also uses the existing
`QR_DECODER_MODULE`. Enforced UI coverage uses EN/FR/ES, light/dark and
1440/390/320px, plus the existing dialog and delayed list/editor race suites.
Injection probes cover inline scripts, wrong nonces, same-origin scripts without
a nonce, inline handlers and network-loaded eval, with report-only controls.
Real QR exports are independently decoded. The geography runner also checks
analytics export contrast and actual keyboard CSV/JSON downloads with active
filters in both themes at all three widths; run it for each supported locale.
These export controls use existing self-hosted styles and add no scripts or
policy exceptions. Headless Chromium proof is not physical-device, Safari,
native printing or custom-deployment acceptance.

The OIDC browser runner uses an isolated synthetic HTTP provider with development
mode explicitly enabled. It exercises outage/retry, cross-origin top-level
authorization and cancellation back to the local app, without password fallback.
It never changes the production HTTPS-only provider requirement. The ordinary
logout runner covers both revoked full pages and revoked HTMX requests.

Primary references: [CSP specification](https://www.w3.org/TR/CSP/),
[HTMX configuration and scripting](https://htmx.org/docs/), and
[HTMX indicator styles and nonces](https://htmx.org/attributes/hx-indicator/).

## Deployment Acceptance Limits

Synthetic main-UI, QR and OIDC evidence is generated in the external directories
reported by the corresponding browser runners. Machine-local paths and operator
release/backup records are not part of this contribution. Passing fixture checks
does not establish how another edge proxy, custom template or browser behaves.
Verify actual rendered HTML keeps `no-transform`, inspect CSP violations and
exercise authentication, native confirmations, charts and exports before enabling
enforcement. Do not allow injected scripts or weaken the WAF to hide a mismatch.
The default remains `off`; deployment and custom/Safari/native acceptance remain
separate gates. See the [community source guide](COMMUNITY-FEATURE-ROADMAP.md).
