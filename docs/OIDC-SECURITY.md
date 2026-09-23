# OIDC identity and session security

Released and deployed: `3.2.6-sr94.5`; evidence is recorded in the feature
roadmap. This feature does not make short-link redirects private.

## Identity and configuration

Configure `OIDC_ENABLED`, an exact HTTPS `OIDC_ISSUER`, confidential client ID
and secret, and `openid profile email` scopes. The callback remains
`https://YOUR_DOMAIN/login/oidc`. Use authorization code with PKCE S256. Provider
discovery failures fail login closed and retry after ten seconds; public links
remain usable. Development fixtures alone allow HTTP on 127.0.0.1.

`OIDC_ID_TOKEN_SIGNING_ALG` selects one exact asymmetric signature algorithm:
`RS256` (default), `PS256`, `ES256` or `EdDSA`. Configure the provider to use the
same algorithm for ID tokens and back-channel logout, and publish its public key
in its JWKS. Empty, unknown, unsigned and HMAC choices fail startup. This changes
neither client-secret authentication nor local session JWTs. Check a complete
login and signed logout before promoting a provider configuration change.

Compatibility note: older releases accepted any of these four algorithms for
logout while requiring RS256 for login. Logout now requires the configured ID
token algorithm too. A provider using different algorithms for those messages
must be aligned before upgrading. Issuer/subject bindings and session lifetimes
are unchanged; never recreate accounts or weaken signature checks to migrate.

Accounts bind to the exact `(issuer, sub)` pair, never to an email or display
name. Configure a stable, non-reassigned provider subject, such as Authentik's
user UUID. A bound user keeps the same Kutt account if their email changes.
Kutt does not automatically update their stored email. By default it does not
grant administrator rights from provider claims. A new identity needs an explicitly
verified email and creates an ordinary USER account unless the optional mapping
below is enabled and the verified ID token qualifies. Matching an existing email
is refused.

`OIDC_ALLOW_REGISTRATION=true` preserves delegated OIDC provisioning; it is
separate from `DISALLOW_REGISTRATION`, which disables local signup. Set it false
to admit only administratively pre-bound identities. Restrict eligible users
in the provider's application policy in either case.

## Existing-account migration

Back up and restore-test the database before upgrading. Preserve all secrets.
Migrate the schema, then an administrator must verify each existing Kutt user
against the identity provider and supply an explicit mapping. Never infer
ownership solely from an untrusted login's email claim.

```sh
node scripts/bind-oidc.cjs < /protected/verified-identity-map.json
```

The JSON is an array of `{ "issuer": "https://idp.example/application/o/kutt/",
"subject": "provider-stable-user-id", "user_id": 123 }` objects. Run with the
same database and issuer configuration as the app. Treat mappings as private
identity data, not Git content. The command is atomic, idempotent, refuses
conflicting ownership or subject replacement, and reports counts only. Newly
bound accounts have all old cookies invalidated and must sign in again. Links,
password hashes, API tokens and account IDs are unchanged with mapping disabled.
With administrator mapping enabled, binding also resets the role to USER and
revokes scoped tokens, legacy API keys and account-recovery tokens; a fresh
verified ID token must establish any administrator grant.

An issuer or subject-mode change after binding needs a separately audited
migration. Do not delete bindings to make login pass. Unbound local-password
sessions use the existing seven-day lifetime and may renew after a day of use;
they do not inherit the OIDC absolute limit. Revoke them explicitly, change the
password, or ban the account to invalidate outstanding cookies.

## Revocation and API

- `GET /api/auth/security`: current user's connected issuers and session limit;
  administrators also see sanitized provider readiness/error codes and times,
  plus read-only `role_mapping` state (enabled, exact claim name, allowed-value
  count, protected local user ID and maximum grant age). No claim values, raw
  tokens, secrets or other users' identity records are exposed.
- `POST /api/auth/revoke-sessions`: immediately invalidates all of the current
  user's browser cookies, including copied cookies; JSON returns 204. The UI is
  **Settings > Account security > Sign out all sessions**.
- Both routes also work under `/api/v2`. They require a browser session, reject
  API keys even when a valid cookie accompanies them, and enforce origin checks
  on mutations. API tokens are intentionally independent: revoke those in the
  API token settings. Account bans deny both browser and API access.
- Password changes and bans increment the persistent session version. A
  password change requires a new login. Unbanning does not restore old cookies.

OIDC sessions have an absolute lifetime, default one hour. Set
`OIDC_SESSION_MAX_SECONDS` to 300, 900, 1800, 3600, 14400 or 86400. Cookie renewal
cannot extend that lifetime. Fresh authorization then re-evaluates provider
application policy, although a still-active provider session may not prompt
the user again. Kutt does not poll provider groups or independently implement
SCIM. Removing an application group is not necessarily a logout event: for
immediate termination, also revoke the provider session or ban the Kutt user.

## Signed back-channel logout

Configure the provider's back-channel logout URL as
`https://YOUR_DOMAIN/api/auth/oidc/backchannel`. In Authentik select **Back-channel**
as Logout Method. Keep the WAF in place. This endpoint has no browser/SSO
challenge because its authentication is the signed `logout_token` POST body.
It does not grant access to management or create sessions.

Tokens must validate against the configured provider's JWKS and exact issuer
and client audience. Only the configured signing algorithm is accepted, never
unsigned or shared-secret algorithms. The logout event, recent iat, unique jti,
subject and/or session ID are validated; nonce is forbidden. Invalid messages
return a generic 400; successful and replayed notifications return 200. Replay
does not extend revocation. Subject-only logout invalidates current sessions
for that identity; a session ID narrows it to that provider session. Revocation
survives process restart and expired notifications are pruned on ingestion.

Provider outages can delay notifications. The absolute lifetime bounds existing
OIDC cookies; a local administrator can revoke sessions or ban a user sooner.
Transport success is not proof that a human MFA ceremony was completed.

## Recovery and validation

The migration adds `users.auth_version`, `oidc_identities` and
`oidc_logout_events`. It does not rewrite links or existing identity data.
Downgrade refuses to discard bindings or any revocation state. An older image
does not enforce these controls and is not a safe code-only rollback. Prefer
fix-forward or the same compatible version. Restoring a pre-upgrade snapshot
requires coordinating provider settings, reconciling later writes, and revoking
old cookies (including rotating the session signing secret if necessary).

The offline suite uses a disposable OIDC provider with real RSA signatures,
authorization-code/PKCE exchange, subject/email collision cases, logout and
replay checks, expired sessions, bans, provider outage recovery, CLI mapping
rollback and guarded downgrade. Desktop/mobile rendered tests exercise the
security page and sign-out/re-login. Tests never use real provider credentials.
Production additionally needs signed-provider delivery through the WAF, existing
account binding checks, unchanged public redirects and a verified backup restore.

Standards: [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html),
[Back-channel logout](https://openid.net/specs/openid-connect-backchannel-1_0.html).

## Optional administrator mapping (C15)

This is **off by default**. Never-enabled installations preserve existing local
and explicitly bound ADMIN roles, session lifetimes and API-token independence.
Enabling it makes OIDC-bound accounts managed: existing sessions, scoped tokens,
legacy keys and recovery tokens are revoked and their role is reset to USER.
Unbound local accounts are not promoted or demoted by this policy.

Before enabling, create or identify a dedicated **local** administrator. It must
already be verified, active, have a bcrypt password, and have no OIDC binding or
prior managed-role state. Test its local-password login in a private browser and keep
its password in a protected operator vault. Kutt validates the persisted account
but cannot establish that an operator actually knows its password. Keep
`DISALLOW_LOGIN_FORM=false`. Record its numeric database user ID explicitly:

Use the existing administrator **Users > Create user** dialog to create a local
account with role ADMIN and verified status, before enabling mapping. Do not run
the OIDC binding command for this account. Existing local administrators may
create another recovery administrator later; mapped administrators cannot create
unmanaged ADMIN accounts, because that would bypass subsequent IdP demotion.
They can still create ordinary USER accounts. User creation rechecks the actor's
current role and session version transactionally after password hashing.

```dotenv
OIDC_ADMIN_MAPPING_ENABLED=true
OIDC_ADMIN_CLAIM=kutt_roles
OIDC_ADMIN_VALUES=["kutt-admin"]
OIDC_BREAK_GLASS_USER_ID=123
OIDC_ADMIN_MAX_AGE_SECONDS=300
```

The boolean accepts only `true` or `false`. The claim is one literal top-level
name matching `[A-Za-z][A-Za-z0-9_:/.-]{0,127}`; dots do not traverse nested
objects. Email, configured email-claim and
standard identity/protocol claims are forbidden. Values must be a JSON array
of 1-32 unique nonempty strings, at most 256 characters each, no control characters,
within 8192 characters of configuration. Matching is exact and case-sensitive:
no substrings, regexes, coercion, case-folding or trimming. A verified ID-token
claim may be a string or a flat array of up to 64 strings. Empty arrays and missing
or nonmatching claims produce USER. A malformed claim denies login **and commits
demotion of an existing managed account**; it does not create a new account.

Only the ID token validated by the existing asymmetric OIDC code/PKCE strategy
can authorize mapping. Userinfo/profile groups, HTTP headers and email matches
never grant privileges. Existing ownership remains exact issuer plus subject;
matching an existing email still requires an operator-reviewed explicit binding.
An invalid signature, issuer, audience or expired token never changes roles.
Consumed anonymous assertion hashes prevent replay and survive account deletion
until expiry; raw tokens and group lists are not stored. Assertions older than the current policy or last accepted decision are
denied. After demotion, an ADMIN assertion must have a strictly newer `iat`, so
a same-second promotion may require another sign-in a second later.

Administrator grants expire at the earlier of signed token `exp` and signed
`iat + OIDC_ADMIN_MAX_AGE_SECONDS` (300 default; 900, 1800, 3600 also accepted).
Arrival time and cookie renewal cannot extend the grant. All credential paths
consult current persisted roles and grant expiry, not Redis's user cache.
Promotion, demotion and expiry invalidate old browser/local-password sessions,
scoped tokens, legacy keys and recovery tokens. Renewing a still-valid, unchanged
grant with fresh signed evidence does not revoke current credentials. A scoped
token still cannot use administrator endpoints, even when owned by an ADMIN.
An expired grant is demoted on the next authenticated request; no background
polling or external map/group service is used.

Personal/admin link edits and link deletion recheck the current account, session
version and any required administrator grant inside the domain-guarded write
transaction. Expiry or role loss after route authentication cannot authorize a
cross-owner write. Named tokens never inherit administrator access. This does
not replace workspace membership checks or transfer ownership: collaborators
still act through workspace routes using the workspace owner's domain access.
Creators can still trash their own links after a domain grant is revoked.

**Revocation bound:** Kutt cannot observe an IdP group removal until a new signed
login assertion, relevant signed logout, local ban, policy change, or grant expiry.
The maximum residual privilege window is the configured grant age (plus up to
15 seconds of accepted provider clock skew); set accurate clocks. To terminate
access immediately, ban the account or deliver signed back-channel logout.
For a managed identity, a matching subject/SID logout revokes **all** its Kutt
credentials and the mapped administrator grant, not only that browser session.
Unrelated SID notifications and replayed logout messages do not revoke newer
grants. Legacy-off logout behavior for unmanaged accounts is unchanged.

Static misconfiguration rejects startup without echoing configuration values.
Missing, banned, unverified, non-admin or OIDC-bound recovery accounts also reject
startup. Concurrent app processes must have identical mapping configuration:
persisted policy mismatch denies managed authentication, never preserves an old
grant. A change in issuer, client, algorithm, claim, values, grant age or protected
ID resets managed accounts and credentials. Disabling mapping after use also
demotes/revokes them; it is **not** a way to retain previous privileges.

The protected local administrator cannot be banned, deleted (including cascades
or self-service), or bound by `bind-oidc.cjs`. Protection persists when mapping is
disabled. To replace it, first create and verify another local administrator,
test its password, then explicitly change the configured protected ID and restart
all instances consistently. Never delete identity or role-state rows to bypass
these checks. Direct privileged database changes remain operator responsibility;
tampering with the protected account fails managed authorization closed.

### Recovery and rollback

1. Use the tested protected local login during IdP outages or mapping mistakes.
2. Correct the explicit claim/value configuration, or disable mapping and restart
   consistently. Invalid enabled configuration will not start; keep a verified
   prior configuration and database backup. Disabling cannot restore old grants.
3. Reauthenticate managed users using fresh signed assertions after correcting
   the provider policy; do not restore old cookies or API tokens.
4. If the recovery password is lost, use the existing verified local password
   recovery process or a separately authorized, audited database recovery. There
   is no email-to-admin shortcut, emergency public endpoint or automatic fallback.

The additive `20260923000000_oidc_roles.js` migration introduces policy, per-user
decision/expiry and consumed-assertion hash tables. It does not modify role data
until mapping is explicitly enabled at startup. Empty unused state can roll back;
used state refuses downgrade. An old application image is unsafe against a used
mapping database because it ignores expiry. Prefer fix-forward or a verified
compatible restore, reconciling newer writes and rotating/revoking credentials.

`tests/oidc-roles.cjs` uses a disposable asymmetric provider and isolated database;
the full offline suite includes it alongside the legacy-off OIDC suite. Tests do
not modify real Authentik configuration. Production acceptance separately requires
operator-tested recovery credentials, real signed claims/logout through the WAF,
clock synchronization, and a restore test.

Reproduce the isolated checks after building a candidate image:

```sh
docker run --rm --network none --read-only --tmpfs /tmp:rw,nosuid,nodev \
  --cap-drop ALL --security-opt no-new-privileges:true IMAGE node tests/container-smoke.cjs
docker run --rm --network none --read-only --tmpfs /tmp:rw,nosuid,nodev \
  --cap-drop ALL --security-opt no-new-privileges:true IMAGE node tests/oidc-roles.cjs ES256
# Also run oidc-roles.cjs with PS256 and EdDSA; the combined suite includes RS256.
sh tests/search-database.sh IMAGE pg tests/oidc-roles-database.cjs
sh tests/search-database.sh IMAGE mysql2 tests/oidc-roles-database.cjs
sh tests/search-database.sh IMAGE pg tests/oidc-role-writes.cjs
sh tests/search-database.sh IMAGE mysql2 tests/oidc-role-writes.cjs
sh tests/browser-oidc-roles.sh IMAGE
```

The browser wrapper requires Node and Playwright (override `NODE_BINARY` and
`PLAYWRIGHT_MODULE` if needed); it binds only loopback and deletes its own fixture.
It uses a deliberately unavailable example issuer to verify local recovery is
independent of IdP availability, real login-button clicks and native language-form
Origin, all three locales, both themes and 320/390/1440px diagnostics, including a
128-character claim name. External requests and JavaScript errors must be zero.
Signature and code-exchange fixtures run separately against a real local signed
provider, not a browser-mocked authentication response. Native Safari/Firefox,
physical assistive technology and custom templates are separate acceptance gates.

`node tests/oidc-role-writes.cjs` runs a fresh disposable SQLite HTTP fixture
with deterministic expiry, role and session-version changes between real route
authentication and mutation. Both edit routes and deletion are checked under
both API prefixes, including unchanged denied destinations and no history writes
on rejection. `--mapping-off` checks never-enabled local-admin compatibility.
The full container suite runs both modes. Owner, granted-domain and workspace
editor/revocation controls verify that ordinary permissions remain unchanged.
