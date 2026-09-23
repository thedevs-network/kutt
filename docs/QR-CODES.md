# QR copying, downloads and printing

Open a link's QR action from Links or Library. Choose the pixel size and error
correction, apply, then download PNG/SVG or print the preview. Printing excludes
navigation and account information; the sheet contains the code and short URL.
Downloads encode the canonical short URL, not its destination, password or login
credentials. Keep that URL public. Scans still pass through normal redirect,
password, schedule and visit-limit checks. Generating/downloading/printing never
fetches the destination or consumes a visit.

Release `.17` adds an image-copy button beside the downloads. It writes only a
PNG of the displayed short URL, at the selected pixel size, after a user click.
It never reads the clipboard or fetches the destination. Image clipboard support
requires a secure context and a supporting browser. Permission/conversion errors
are recoverable; PNG/SVG downloads and printing remain available independently.
The `ClipboardItem` receives a PNG promise and `write()` is called before any
await, preserving Safari's user-activation requirement. Browser/OS permission
policy can still deny a write.

Inspired by [kkpanfilov's upstream PR #1016](https://github.com/thedevs-network/kutt/pull/1016),
implemented against this fork's authenticated QR page rather than importing its
older preview code or unrelated dependency changes.

## API

`GET /api/v2/links/{uuid}/qr?format=png&size=512&level=M` (also `/api/links/...`).
Use a signed-in session, legacy owner API key or scoped `links:read` token in
`X-API-Key`. Domain restrictions apply; a simultaneous cookie cannot increase
token permissions. Ownership is required even for administrators. The existing
administrator table's local QR preview is unchanged; it does not grant owner
download access to other users' links.

- `format`: `png` (default), `svg`.
- `size`: integer 128..1024 pixels, default 512. A size too small for the symbol
  and its quiet zone is refused. SVG retains its vector viewBox.
- `level`: `L`, `M` (default), `Q`, `H` error correction.
- Response: attachment `kutt-qr-{uuid}.{format}`, matching image MIME type,
  `private, no-store`, `nosniff`; SVG additionally has a restrictive sandbox CSP.
- 400 invalid options/URL; 401 unauthenticated; 403 insufficient scope; 404
  nonexistent, foreign or banned link/domain-scoped mismatch; 410 trashed link,
  archived, banned, deleted or no-longer-available domain. An active custom
  domain must be owned by or explicitly granted to the link's creator; a grant
  never gives access to another creator's QR exports. Pause/expiry/quota states
  can be exported, but the page displays their state and scans remain blocked.
- Generation is limited to 30 requests/minute per path/client when application
  rate limiting is enabled. The existing WAF is not bypassed.

The server uses [node-qrcode](https://github.com/soldair/node-qrcode) 1.5.4 for
QR encoding/SVG, and pngjs 7.0.0 to render its matrix on an exact integer canvas.
The library PNG renderer sometimes rounds 1024 down to 1023 for a 41-module
symbol. `.8.1` fixes this with a deterministic fixture; the failed `.8` release
CI prevented that version from being deployed. No tag was moved or reused.
Images have opaque black/white pixels and a fixed four-module quiet zone. There is no remote
QR provider or outbound URL fetch. Custom domain protocol follows the same
`CUSTOM_DOMAIN_USE_HTTPS` behavior as existing links.

## Validation and rollback

No migration, data rewrite or new secret is required. Roll back to the previous
image if necessary; remove only this release's code/dependency changes, not data.
Production backups must still precede deployment. QR images are not backups and
contain no destination or user records.

`tests/qr.cjs` is part of the isolated container regression: validates actual PNG
pixels, quiet zones and dimensions, SVG safety, option limits, access boundaries,
privacy, lifecycle preservation, no counted visits, restart and revoked tokens.
`tests/browser-qr.cjs` checks desktop/mobile navigation, settings, real downloads,
independent QR decoding, print rendering and image failure recovery on a fresh
loopback-only instance. Physical paper/printer/phone acceptance is separate from
browser PDF and automated decoder validation.
It also independently decodes the PNG passed through a real `ClipboardItem`,
checks permission denial, conversion failure, duplicate clicks, recovery and
unsupported-browser download fallback. Clipboard writes are intercepted in
the test; it does not modify the operator's OS clipboard or claim physical
iPhone/Safari acceptance.
