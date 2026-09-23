# Custom domain ownership

New ordinary domain claims require DNS TXT proof, including claims made by an
administrator through the ordinary settings/API route. Existing owned domains,
UUIDs and links are unchanged. Do not delete and recreate an existing domain to
upgrade. DNS proof does not provision certificates, reverse-proxy routes or SSO.

Custom homepages do not intercept `/api` or `/api/...` (including `/api/v2`).
Requests retain normal API authentication, token domain scopes and mutation
origin checks; changing the Host header grants no additional rights. Root and
login-page homepage redirects are unchanged, as are public short links such as
`/apiary`. This exception matches a complete path segment, not an `api` prefix,
and does not decode encoded separators or provision a new public route.
Malformed leading double-slash paths return 400 instead of reaching an
empty-alias database lookup.

## Settings

1. Arrange the hostname's HTTPS routing with the deployment administrator. Keep
   management protected by the existing WAF/SSO policy. Short redirects remain
   public. Cloudflare proxying is a deployment choice, not a reason to disable WAF.
2. In Settings, add the hostname and optional homepage. The form displays a TXT
   record name, value and expiry, with named Copy buttons and nearby confirmation.
3. Publish that TXT record in authoritative DNS and select **Verify ownership**.
   The same unexpired challenge is retained when DNS has not propagated yet.
   Wait for authoritative publication before retrying: an early failed lookup
   can be negatively cached by recursive DNS (for example, 30 minutes). If the
   challenge expires meanwhile, request a fresh one and publish its new value.
   Some DNS consoles expect the relative record name, not the full hostname.
4. A successful claim appears in the domain table. An expired challenge is
   replaced; publish the new value and retry. Remove obsolete challenge records
   after verification if desired.

The challenge expires after 30 minutes and is bound to the exact normalized
hostname, account and authentication generation. Another user cannot reuse it.
Revoking sessions/password recovery invalidates outstanding proofs; request a
fresh challenge. A valid legacy API key still works immediately after session
revocation because API authentication reads current account state, not Redis's
older user cache.

## API

`POST /api/domains` and `POST /api/v2/domains` retain their authentication and
successful `200` response. New claims now have an intentional security gate:

```json
{"address":"go.example.com","homepage":"https://example.com/"}
```

Before verified ownership, JSON clients receive `409` with `error` and a
`verification` object containing `record_name`, `record_value`, `proof` and
`expires_at`. Publish the exact TXT value, then repeat the same request including
the opaque `proof`. Handle a replacement challenge after expiry. Never treat
`409` as successful registration. No domain is claimed during challenge issuance.
The endpoint is limited to ten requests per minute even when optional management
rate limiting is disabled. DNS lookup is bounded and fails closed.

The final claim atomically requires an unowned, unbanned domain and a current
account generation. Competing claims cannot overwrite the winner, bypass a ban,
or replace the domain ID. The trusted administrator route may provision unowned
domain rows for administration; it does not prove another user's ownership.

## Recovery and tests

Preserve the JWT secret and database together. Invalid/expired proofs can simply
be reissued; do not grant ownership directly to work around failed DNS checks.
`security-boundaries.cjs` covers signatures, expiry, account/hostname/generation
binding and concurrent claims. `security-database.cjs` repeats the atomic race on
PostgreSQL/MySQL. `browser-domain-proof.cjs` uses an explicitly isolated DNS test
fixture for desktop/mobile form, copy, verification and reload checks. That
fixture is never a production DNS exception.
