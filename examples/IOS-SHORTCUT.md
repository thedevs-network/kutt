# Private iOS Shortcut

This example creates a link on your own Kutt account from the iOS Share Sheet or
a manually entered URL, then copies the returned short link. Existing links are
reused when compatible (`reuse: true`); this is not a retry/idempotency guarantee.
The default-domain token can create links, not list, edit, delete, read analytics,
manage tokens, administer users or use custom domains. Short redirects stay public.

## Setup

1. Sign in to Kutt through your normal SSO. Open Settings > iOS Shortcut.
2. Download `Kutt-Shorten-URL.shortcut` and open it in Apple's Shortcuts app.
   The template contains placeholders, never a credential. Inspect its actions.
3. In Kutt, give the token a device-specific name and choose Create Shortcut
   token. Copy the exact HTTPS API endpoint and the one-time credential into the
   two import questions. The URL must end in `/api/v2/links`; do not use a login,
   short-link, HTTP, tunnel or third-party endpoint. Mask/reveal/copy controls are
   available. Hide the credential after saving it, or revoke it if abandoning setup.
4. Finish adding the Shortcut. Share a URL from Safari and choose this Shortcut.
   Select the intended URL if the app supplies several. When run directly, enter
   a URL when prompted. The shared URL is JSON data, never the HTTP endpoint.
5. If Shortcuts requests network permission, approve only your expected Kutt API
   host. Cancel unexpected destinations. Check the copied short link once.

Apple's Get Contents of URL may follow redirects. A trusted, exact HTTPS API
endpoint that accepts the scoped token directly is required; it must not redirect
to SSO or a different hostname. Do not approve an unexpected destination or
weaken WAF/SSO. The application returns JSON for valid API requests, not a login
form. There is one POST and no automatic retry or fetch of the shared destination.

## Secret Handling And Renewal

The token expires after 30 days and is shown only once. Kutt stores its hash.
Shortcuts stores configured text locally and may sync it with your Apple account;
it is not a password vault. Never publish, export for sharing, upload, sign or
send a configured copy containing a token. The supplied signed template is
credential-free. Clipboard copying is local-only within the Shortcut; clear
sensitive clipboard contents after setup. Use a separate token for each device.

To renew, create a replacement in Kutt, update only your private Shortcut, test
it, then revoke the old named token in Settings > API tokens. For a lost device
or suspected leak, revoke first. Revocation takes effect on the next request.
Do not replace it with a legacy or administrator API key.

## Errors And Recovery

- 401: expired/revoked token or account no longer active. Sign in to Kutt and
  create a new restricted token. Do not automate unlimited refresh credentials.
- 403: scope/domain restriction or WAF block. Inspect Kutt and WAF logs privately;
  keep the token restricted and the WAF enabled.
- 429: wait before manually trying again; do not add a retry loop.
- Network timeout: the server may already have created the link. Check Library
  before retrying. `reuse` reduces ordinary duplicates but is not exactly-once.
- Missing `link`, non-JSON, or an `error`: nothing is copied. Check the endpoint
  and service health. Native transport failures also stop the Shortcut.
- Missing input or cancellation: no request is sent. Public redirects do not
  depend on the Shortcut, a token, or SSO.

No new database migration is needed: this uses the existing hashed scoped-token
table and link API. Back up the database as usual. After recovery, confirm token
expiry/revocation and account access; revoke tokens belonging to lost devices.
Do not roll back to a release that ignores domain restrictions. Removing this
setup page does not revoke previously issued tokens; revoke explicitly first.

## API

Both `/api` and `/api/v2` support these signed-in-session-only endpoints:

- `GET /shortcuts`: exact endpoint, fixed token policy, body example and downloads.
- `POST /shortcuts/token` with `{"name":"My iPhone"}`: HTTP 201 with a one-time
  token, ID, fixed `links:create` scope, default-domain restriction and 30-day
  expiry. Other input fields are rejected. Five creations per minute per client
  when rate limiting is enabled. Same-origin/CSRF rules apply.
- `GET /shortcuts/template`: signed, credential-free native template attachment.
- `GET /shortcuts/guide`: this guide. All responses are private/no-store.

Scoped and legacy API keys cannot mint credentials or download private setup
resources, even when accompanied by an administrator cookie. Revoke through the
existing session-only `DELETE /tokens/{id}`; only the owner can revoke a token.

## Reproduce The Template

`examples/ios-shortcut.cjs` is the auditable action graph. It contains no external
script, account-specific endpoint, token, redirect or remote executable payload.
`scripts/build-shortcut.py` emits a deterministic unsigned XML property list:

```sh
python3 scripts/build-shortcut.py --output /tmp/Kutt-Shorten-URL.unsigned.shortcut
shortcuts sign --mode anyone --input /tmp/Kutt-Shorten-URL.unsigned.shortcut --output examples/Kutt-Shorten-URL.shortcut
chmod 0644 examples/Kutt-Shorten-URL.shortcut
```

Signing requires macOS and Apple's service. Sign only the placeholder template;
never substitute a real token before signing. Review the generated action graph,
run tests, inspect/run it in native Shortcuts, and verify template download bytes
before publishing a changed artifact. Linux CI validates the source graph and
checked-in artifact checksum; it does not pretend to run an iPhone.
macOS CI additionally runs `python3 scripts/verify-shortcut.py` to decode the
signed placeholder artifact without importing or executing it, and compare its
action graph and import questions against the reviewed source. This checks the
container's embedded-key signature, not an independent Apple CA trust chain.

The release template has been exercised in native macOS Shortcuts with dummy credentials
against a local fixture (successful JSON, API error and cancellation). Browser
setup has separate desktop/mobile regression tests. Physical iPhone acceptance
has not been performed; the first private import should follow the checks above.

Apple references: [HTTP requests](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios),
[import questions](https://support.apple.com/guide/shortcuts/add-import-questions-to-shared-shortcuts-apdf330fd3a0/ios),
[sharing privacy](https://www.apple.com/legal/privacy/data/en/shortcuts-sharing/).
