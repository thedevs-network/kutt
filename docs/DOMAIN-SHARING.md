# Management Origin and Explicit Domain Grants

Both features are opt-in. `MANAGEMENT_ORIGIN` defaults to empty, and the additive
grant migration creates no grants. Existing custom domains never become shared
automatically. There is no global-sharing flag or guest access to shared domains.
This differs deliberately from the global-domain idea in
[upstream PR 918](https://github.com/thedevs-network/kutt/pull/918).

## Separate Management Host

For example, retain `DEFAULT_DOMAIN=go.example.com` and configure
`MANAGEMENT_ORIGIN=https://manage.example.com`. Configure DNS, a valid TLS
certificate and reverse-proxy routing for that host separately. Kutt does not
create DNS records, certificates, proxy routes or WAF/SSO exceptions.

- Only an origin is accepted: no credentials, path, query, fragment, whitespace,
  trailing-dot hostname or encoded authority. Case, IDNs and default ports are
  normalized. HTTP is permitted only for a development loopback hostname.
- The management hostname must differ from the default short hostname, including
  its `www` equivalent, even when ports differ. It must not already be a custom
  short domain. Startup fails closed on a collision; use a new hostname instead
  of moving or deleting an existing domain and its links.
- The raw HTTP Host selects management access. Forwarded host headers do not.
  Configure the reverse proxy to preserve the approved Host and reject unknown
  hosts at ingress. `TRUST_PROXY` still governs client addresses/protocol; it does
  not select the management origin.
- Settings, login, OIDC, registration/recovery and credential-bearing API routes
  on a wrong host fail without authenticating, setting a login cookie or
  redirecting credentials. API clients must explicitly change their endpoint.
- Public aliases, redirects, HEAD, forwarding suffixes and password forms stay
  on their short hosts. Password submission checks the matching short host and,
  when supplied by a browser, its exact short Origin, including an accepted
  `www` alias. It does not use the management Origin. Public health,
  static/locale assets and public informational pages
  remain accessible. The default short root no longer renders a dashboard;
  configured custom-domain homepages still work.
- Login and session CSRF checks use the exact management origin. OIDC callbacks,
  account verification/reset/change-email URLs and shortcut API endpoints use
  the same configured origin, never a request's forwarded host.
- Token and OIDC cookies remain HttpOnly and host-only, with SameSite=Lax.
  HTTPS management cookies are Secure. No parent-domain cookie is introduced.
  Existing short-host cookies are not copied to the management host.

Update the identity provider's callback registration to
`MANAGEMENT_ORIGIN/login/oidc` and its back-channel logout endpoint to the
management origin's existing logout API path. Test discovery, code/PKCE login,
logout and a local recovery administrator before changing access controls.
Preserve the C15 protected-local-administrator policy. Do not loosen TLS, CSP,
CSRF, proxy trust or identity-provider verification to make the split work.

### Recovery

Take a verified backup and record the previous origin/proxy/IdP settings before
enabling the feature. Use the new hostname rather than reassigning an existing
short domain. If startup rejects an invalid or occupied hostname, correct
`MANAGEMENT_ORIGIN` or restore it to empty, then follow the normal controlled
restart procedure. Never delete a domain record merely to clear that check.
Revert IdP callback/API-client configuration consistently when rolling back.
Changing this setting does not revoke existing sessions: use the existing
session/token revocation controls when the rollout requires revocation.

## Explicit Grants

An owner uses **Settings > Domain sharing**, or the domain link in their custom
domain table. Administrators can use the domain table's sharing action. Enter
an existing verified, active account's email to grant access; revoke each grant
explicitly. Native forms work without JavaScript. English, French and Spanish
catalogs include all new labels and errors. Granted domains appear in the
recipient's shortener, workspace-owner and scoped-token selectors, not in their
owned-domain deletion table. A recipient cannot grant onward access.

The browser's **Revoke access** action first opens a read-only confirmation page
showing the recipient, domain and token/health consequences. **Cancel** returns
to the grant list without changing anything. Only the origin-checked confirmation
POST revokes access, with ownership/admin permission rechecked in the transaction.
This flow works without JavaScript. An already-revoked grant returns a controlled
404; an old confirmation cannot revoke a later regrant. API DELETE remains a
direct, explicitly authorized revoke operation with no confirmation-page step.

A grant permits using the domain for the recipient's own links. It does not
transfer the domain, existing links, analytics, history, integrations or member
lists. The domain owner cannot read another creator's links or statistics just
because those links use their domain. Administrators retain their existing
explicit administrative permissions, including C15's fresh bounded-role guard.
Workspace links continue to belong to the workspace owner: that owner's current
domain entitlement is required, not an editor's personal grant.

Revocation blocks new links, edits, restores, routing/forwarding/privacy changes,
import commits/replays and health work. Existing public redirects and protected
links remain available unless independently trashed, expired, paused or banned.
The creator can still remove their own links. Domain-scoped API tokens for the
revoked recipient are permanently revoked; regranting does not reactivate them.
Health schedules are disabled and need an explicit new opt-in. All-domain tokens
keep their machine value `all`; creating or modifying links requires current
ownership or an explicit grant. The creator retains access to their own stored
link records and analytics after revocation, never another creator's records.

Domain ban, release, reclaim, reassignment or deletion removes its grants and
revokes its domain-scoped tokens in the same transaction. Recipient or domain
owner bans/deletion also invalidate the affected grants. Unban/reclaim does not
recreate them. No redirect cache is used for authorization. Grant changes need
no Redis invalidation because they neither change a public target nor cache
permissions. Existing moderation/domain cache invalidation is retained.

Mutations acquire `domain_access_state` before user, workspace, domain or link
locks. This deliberately serializes domain-dependent management writes and
grant/moderation/OIDC-role transitions. The management grant-list read also uses
this guard so a concurrent domain reassignment cannot combine the former owner's
authorization with the new owner's recipient list. Ordinary reads and public
redirects do not acquire it. Recheck permissions inside that transaction.
MySQL checks use locking current reads,
including when a caller has an older repeatable-read snapshot. Do not introduce
another write path that locks a user/link first and then acquires the guard.

## API

Use `/api` or `/api/v2` on the management origin when enabled. Session writes
require the matching browser Origin. Legacy-key principals remain supported;
named tokens use only `X-API-Key`. No grant operation inherits named-token admin
privileges. `domains:share` is an explicit new scope for **owned** domains, and
its optional domain restriction is enforced. A recipient cannot share onward
even with this scope.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/domains/available` | Session/legacy account or `links:create`; current owned/granted domains only |
| GET | `/domains/:domainUuid/grants` | Domain owner/admin, or owner token with `domains:share` |
| POST | `/domains/:domainUuid/grants` | Same, JSON `{ "email": "member@example.com" }` |
| DELETE | `/domains/:domainUuid/grants/:grantUuid` | Same, no body |

Available domains return `{ "data": [{ "id": "domainUuid", "address":
"go.example.com", "owned": false }] }`. Grant list returns a minimal `domain`
object and `data` entries containing grant `id`, recipient `email`, and ISO UTC
`created_at`. POST returns one entry with status 201; DELETE returns 204.
There are at most 100 grants per domain and per recipient. Repeated grants
return 409; unavailable recipients and malformed fields return 400; inaccessible
domains/grants return 404. No bulk user directory or implicit opt-in is exposed.

## Verification

`tests/management-domain-grants.cjs` runs only with fresh disposable databases.
It is part of `tests/container-smoke.cjs` and its focused selection
`KUTT_TEST_ONLY=management-domain-grants`.

`tests/domain-access-read.cjs` additionally exercises the actual grant-list code
under a deterministic ownership-transfer interleaving; it is included in the
same focused selection and full suite.

Real MySQL/PostgreSQL gates reuse:

```sh
sh tests/search-database.sh IMAGE mysql2 tests/management-domain-grants.cjs
sh tests/search-database.sh IMAGE pg tests/management-domain-grants.cjs
sh tests/browser-domain-grants.sh IMAGE
```

The browser fixture covers 320/390/1440 pixels, all three locales, both themes,
native keyboard grant/confirm/cancel, confirmation layouts, scoped-token effects,
selector removal and enforced CSP, plus a JavaScript-disabled confirm/cancel flow.
The HTTP/SQL fixture verifies non-mutating GET/cancel, legacy-form confirmation,
origin checks, fresh ownership and stale/regranted IDs. The browser also submits
actual protected forms on the default, bare custom and `www` custom short hosts,
using only loopback DNS overrides and synthetic landing responses. OIDC's real
code/PKCE/signature/logout suite also runs with the separate management origin.
These fixtures do not demonstrate production DNS/TLS/WAF/IdP readiness. Those
remain separate deployment gates; this feature does not authorize deployment.
