# Branded QR exports

Open a link's **QR code** page, choose a PNG logo, and export PNG or SVG.
The preview, clipboard image and printed QR use the same rendered PNG. Remove
the logo to return to the previous correction level. Size changes require Apply;
exports are disabled while changes or requests are pending. Keyboard users can
operate the native file chooser, Remove, downloads, Copy and Print.
The separate logo thumbnail uses the sanitized PNG embedded in the server's SVG,
never the original upload or its metadata.

Logos are optional and ephemeral. They are not saved to the link, database,
browser storage or a public URL. Reloading clears the logo. Copy is available
only where secure-context image clipboard APIs are supported; PNG download
remains available. Requests are cancelled on replacement, late results are
discarded, and generated object URLs are revoked on replacement/page exit.

## API

Both `/api/links/{id}/qr` and `/api/v2/links/{id}/qr` accept authenticated POST:

```json
{
  "size": 512,
  "format": "svg",
  "logo": "iVBORw0KGgo..."
}
```

`logo` is the complete canonical standard-base64 encoding of the PNG file, with
required padding and no whitespace; the example above is abbreviated. Plain
base64 is preferred and is what the browser sends, avoiding data-URI syntax in
the JSON request. The exact legacy `data:image/png;base64,` prefix remains
accepted for API compatibility; other URI types, parameters and prefix variants
are rejected. Both forms have identical validation and generated image bytes.
This requires no WAF exception or policy change. Deployment-specific WAF
acceptance still needs verification with the actual upload request.

Use a session or an `X-API-Key` with `links:read` and the appropriate domain scope.
Only the link owner may export, including administrator sessions. Existing ban,
trash, archived-domain and domain-ownership checks apply. Supplied foreign/null
origins and `Sec-Fetch-Site: cross-site` are denied even for API tokens; non-browser
clients may omit Origin. Responses are private/no-store attachments. Neither
target URLs, passwords nor credentials are encoded; QR creation records no visit.
POST errors retain their status and JSON format even with an HTML Accept header.

GET keeps its existing unbranded PNG/SVG options and byte output. POST accepts
only `size`, `format`, `level` and `logo`; omit `logo` for plain output. Size is an
integer or decimal string from 128 to 1024, format is `png` or `svg`, and level is
L/M/Q/H. With a logo the validated level is always replaced by H. Invalid/null/
empty logos produce 400, never a silent plain-image fallback.

## Input and rendering limits

- Canonical plain PNG base64, or the exact legacy PNG data URI: no SVG, JPEG,
  remote URL, URL-safe base64, whitespace or malformed/noncanonical base64.
  Up to 64 KiB decoded bytes and 512 by 512 pixels. The global JSON body
  limit remains unchanged at 100 KiB.
- A POST-only parser wrapper returns sanitized JSON errors directly, keeping
  malformed upload bodies out of the existing global request-error logger.
- Non-interlaced, non-animated PNG. Standard grayscale/RGB/indexed/alpha bit-depth
  combinations are accepted. Chunk count (128), framing, all CRCs, dimensions and
  IHDR methods are validated before decoding. Bounded zlib inflation must match
  the exact raster length, with no trailing compressed stream.
- Only raster chunks reach the pinned `pngjs` decoder. Text, profiles and other
  metadata are discarded. A resized, opaque RGBA raster is newly encoded for SVG,
  with transparency composited onto white. No input metadata or external href is
  copied, and no network fetch occurs.
- `qrcode` generates a correction-H symbol. The white center plate covers at most
  20% of symbol width (4% area), aligned to module edges, with one-module padding
  around an aspect-preserving logo. Finder patterns and the four-module quiet
  zone remain unchanged. Branded images need at least two output pixels per
  module; dense symbols return 400 until a larger size is selected.

PNG/SVG rendering reuses pinned production libraries, not a new QR encoder.
Independent test decoding uses existing test-only `jsqr` 1.4.0 (locked integrity),
whose [primary API documentation](https://github.com/cozmo/jsQR#usage) specifies
RGBA image decoding. See also [pngjs](https://github.com/pngjs/pngjs) and
[node-qrcode](https://github.com/soldair/node-qrcode). No new runtime dependency,
schema migration or deployment configuration is required.

## Validation and integration

`qr-branding.cjs` runs in the full container suite, or with
`KUTT_TEST_ONLY=qr-branding`. It includes the bounded input/raster unit suite,
ownership/scopes/origin/lifecycle checks, both logo encodings with identical
PNG/SVG bytes and rejection bounds, plain GET/POST equivalence, zero visits,
metadata/privacy checks and restart/revocation. `qr-logo-unit.cjs --decode`
additionally requires the isolated test decoder and independently reads actual
PNGs across plain/dotted/nested/long-alias and custom-host sizes. One dense 1024px
case requires 512px sampling in jsQR for both the unbranded control and branded
image; this is recorded, not counted as a native-resolution decode.

`tests/browser-qr-branding.sh IMAGE` creates a fresh loopback SQLite fixture and
runs `browser-qr-branding.cjs` at 1440/390/320px using Playwright and the test
decoder. It asserts actual browser POSTs contain plain base64, not a data URI,
and checks downloaded PNG and rasterized SVG, visible logo pixels,
clipboard PNG, print layout, file rejection/retry, keyboard controls, late render
and clipboard results, object-URL cleanup and visit counts. It never uses the
operator's real clipboard or fetches the encoded destination. Physical scanning,
native print dialogs and Safari acceptance remain separate release gates.

## Localization and themes

The QR branch integrates C11 and C14 from `6cf8f959` and retains version `.47`.
All QR labels, accessible names, status text and API errors use the bundled
English (default), French and Spanish catalogs. New branding messages have
stable `qr.*` keys; existing QR keys are retained. Browser feedback is escaped
in template data attributes and assigned with `textContent`, not DOM translation
or HTML insertion. Unexpected browser/network errors use the localized load
failure message. Native file-dialog/validation chrome follows the browser/OS.

Locale middleware precedes the bounded POST parser, including malformed and
oversized JSON errors. The preference cookie and `Accept-Language` negotiation
are unchanged. QR bytes, URLs, filenames, sizes, correction levels, formats,
scope names and status codes never depend on locale. The lifecycle display uses
the localized label; the API's machine-readable lifecycle value stays unchanged.
Dark mode retains an opaque white QR image, thumbnail and quiet zone.

`qr-branding-i18n.cjs` checks all three languages on both API aliases, parser and
authorization errors, concurrent cookie precedence, source/catalog references,
and byte-identical plain/branded images across locales. The full suite includes
the shared catalog/key/placeholder and template-compilation gate.

Run `sh tests/browser-qr-branding-locales.sh IMAGE` for the focused 18-view matrix:
EN/FR/ES, light/dark, 1440/390/320px. Each locale/theme has its own disposable
fixture, with actual decoded PNG/SVG downloads, clipboard images, print layout,
keyboard/remove/error/race/cleanup coverage, no-overflow and text-contrast checks.
Screenshots include branded, invalid-logo and print states. A single combination
can be run with `KUTT_TEST_LOCALE=fr KUTT_TEST_THEME=dark` and the ordinary runner.
The unrelated 270-view appearance suite is not needed for QR-only integration.

### Integration verification (2026-09-22)

- Full offline `tests/container-smoke.cjs`: passed with the .47 dependency lock,
  including C11 source catalogs, C14 theme contracts, both QR suites, C19,
  moderation, OIDC and migration rollback checks. The test harness drains ordinary
  responses (preserving URL and streaming SSE) to avoid the known Node 24.21
  unread-response/connection-close failure; runtime behavior is unchanged.
- Focused `KUTT_TEST_ONLY=qr-branding`: passed, including localized HTTP errors.
- `qr-logo-unit.cjs --decode`: 36 size/alias cases passed; one dense case used
  normalized sampling with the same plain control, as documented above.
- Focused browser matrix: all 18 viewport/locale/theme combinations passed, with
  54 branded/error/print screenshots. Longer French/Spanish text, mobile layouts,
  dark contrast and white printed quiet zones were visually reviewed.
- Legacy `browser-qr.cjs`: passed, including clipboard conversion/denial,
  unsupported controls, plain PNG/SVG decoding, print/PDF and image recovery.
- Source key/placeholder parity (1,453 keys per locale), all template compilation,
  changed JavaScript syntax, shell syntax, API schema import and diff checks passed.

Synthetic browser evidence is generated outside Git in the directories reported
by the branded and legacy QR runners. No production, parent working-tree,
analytics-source or version changes were made by this integration.
