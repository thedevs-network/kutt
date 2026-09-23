# Scoped API tokens

Create named tokens in Settings using a signed-in browser session. The secret is
shown once. The database stores a SHA-256 digest of a random 256-bit secret. Use
`X-API-Key`; URL/body credentials are rejected for scoped tokens. Never embed a
token in a public client application.

| Scope | Allowed operation |
| --- | --- |
| `links:read` | List the owner's links, trash, history, routing/forwarding policies and previews |
| `links:create` | Create links as the owner |
| `links:update` | Edit owned links, lifecycle/routing/forwarding/tracking policies, restore owned trash |
| `links:delete` | Move the owner's links to [trash](LINK-HISTORY.md) |
| `stats:read` | Read statistics for the owner's links |
| `workspaces:read` | List accepted/owned workspaces and their shared links |
| `workspaces:write` | Create/edit/trash/restore shared links as a current workspace owner/editor |
| `webhooks:read` | Read the owner's webhook configuration and delivery history, never signing secrets |
| `webhooks:write` | Create/edit/rotate/delete the owner's webhooks and queue tests/retries |
| `events:read` | Read the owner's private management-event journal |
| `domains:share` | List, grant or revoke explicit access to custom domains the token's account owns |

Both `/api` and `/api/v2` are supported. Tokens never confer administrator
privileges. Other routes, account changes, domain administration outside the
explicit `domains:share` operations, and token management are denied. A cookie
cannot elevate a scoped request. Public
short-link redirects need no token.
Workspace scopes do not grant membership or personal-link access. Invitations,
roles and sharing require a session; domain-restricted tokens cannot use workspace
routes. See [Workspaces](WORKSPACES.md) for the separate authorization model.
Webhook/event scopes are owner-wide and also reject domain-restricted tokens.
They do not authorize other owners' data, native pages or live SSE streams.
See [Integrations](WEBHOOKS.md) for delivery and browser-session boundaries.

## Management API (session authentication only)

- `GET /api/v2/tokens`: metadata, never secrets/hashes (latest 100).
- `POST /api/v2/tokens`: `{ "name": "Shortcut", "scopes": ["links:create"],
  "expires_in_days": "30" }`; metadata plus `token` once, HTTP 201.
- `DELETE /api/v2/tokens/:id`: revoke an owned token, HTTP 204; idempotent.
  Other users' tokens return 404.

Expiry defaults to 30 days; presets: 7, 30, 90, 365, `never`. Alternatively,
`expires_at` accepts a future ISO 8601 UTC timestamp. Expiry, revocation, bans
and verification are checked per request without caching. Last-use writes are
limited to once per minute. Metadata timestamps are UTC.

## Domain restrictions

Select a domain in the token form, or send `domain_scope` when creating a token:
`all` (default, all currently available domains), `default` (the installation's
default domain), or an owned or explicitly granted custom domain UUID from
`GET /api/v2/domains/available` (session/legacy account or `links:create` token).
A custom-domain token
must send that domain's address in the link creation `domain` field.

Restrictions apply to creation, listing (including totals), editing, deletion
and statistics. Another domain's link returns 404. A removed, banned or
transferred custom domain invalidates its restricted tokens immediately.
Revoking a grant permanently revokes that recipient's domain-restricted tokens.
Recreating the same hostname or granting access again does not reactivate them;
create a new token. `domains:share` permits only explicit sharing of owned
domains, honors token domain restrictions, and never permits recipients to share
onward. Other domain administration is denied. Existing tokens retain the
machine value `all` for compatibility; writes still require current entitlement.
See [domain sharing](DOMAIN-SHARING.md) for the routes and revocation semantics.

## Retry-safe link creation

Authenticated JSON clients can send `Idempotency-Key` on `POST /api/v2/links`
(also `/api/links`). Use a unique random UUID per intended creation and reuse it
only when retrying that same request:

```sh
curl --fail-with-body https://short.example/api/v2/links \
  -H "X-API-Key: $KUTT_TOKEN" \
  -H 'Content-Type: application/json' -H 'Accept: application/json' \
  -H 'Idempotency-Key: 0206a9f2-8c41-49c4-9313-4233d71c32d7' \
  --data '{"target":"https://example.com/article","expire_in":"2 days"}'
```

For 24 hours after successful creation, identical retries return the original
JSON and HTTP status, with `Idempotency-Replayed: true`, without another link.
The first response has `false`. The key is owner-scoped across tokens and API
aliases; authorization is still checked on every retry. Changed payloads return
409. Retrying a deleted or banned link returns 409, never recreating it.
After 24 hours the key is eligible for reuse, so clients must not blindly retry
older requests. Records are lazily removed on the owner's next idempotent create.
At most 1,000 unexpired keys per owner are retained (429 above that limit).

Keys are 8-128 ASCII letters, digits, dots, underscores, colons or hyphens. Invalid
keys return 400. HTML form submissions do not accept this header. Requests
without it retain existing behavior. Failed creations roll back their key
reservation and may be retried. Relative expiry is measured from the first
successful creation, not extended by retries. Passwords are represented only by
a keyed request digest and a boolean in stored responses, never plaintext.
Rotating `JWT_SECRET` makes old request digests fail with 409 until retention
expires; start a fresh operation only after checking the existing link.

## Compatibility and rollback

The image-only rollback notes below describe the token releases in isolation.
They do not override newer [lifecycle](LINK-LIFECYCLE.md) or [trash/history](LINK-HISTORY.md)
constraints. Current databases must run code that enforces all installed policies.

The additive `20260913190000_api_tokens` migration does not modify users, links
or existing `users.apikey` values. Legacy keys retain their prior permissions
and storage format to avoid breaking integrations or image-only rollback.
Move integrations to scoped tokens, then regenerate the legacy key to invalidate
the previous value. Legacy keys remain broad credentials; new-token guarantees
do not apply to them.

An older image ignores the new table and still accepts legacy keys, but cannot
accept new scoped tokens. Schema rollback drops the token table and revokes all
scoped tokens; prefer image-only rollback. Take a consistent database backup
before migration and test restore separately.

The `20260913220000_token_domains_idempotency` migration adds one token column
and a separate request table. Domain-restricted secrets use the `kutt_d_` prefix
so the previous image rejects them rather than silently broadening privileges.
Image rollback preserves links and existing unrestricted tokens, but loses
idempotency support: pause retrying clients first. Schema rollback discards
idempotency history and domain restrictions; restricted secrets remain rejected
after reapplying that schema. Issue replacement restricted tokens after recovery.
