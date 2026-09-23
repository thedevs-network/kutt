# Destination host policy

This optional operator control restricts where short links may redirect. It does
not replace authentication, domain ownership, token scopes, moderation, or the
separate SSRF restrictions used by background HTTP probes.

## Configuration

`DESTINATION_ALLOWED_HOSTS` is a JSON array in the application environment:

```dotenv
DESTINATION_ALLOWED_HOSTS='["example.com","*.trusted.example","xn--bcher-kva.example"]'
```

- Empty/unset: disabled, preserving existing destination behavior.
- `[]`: enabled, denying every destination.
- Exact entries match only that hostname; `example.com` does not include `www`.
- `*.trusted.example` includes nested subdomains, but not `trusted.example` itself.
- Case, a trailing DNS dot and internationalized hostnames are canonicalized.
- Canonical IPv4 and bracketed IPv6 literals are supported as exact entries.
- Schemes, paths, ports, credentials, single-label wildcard suffixes and ambiguous
  numeric IP spellings are not valid entries. The array is limited to 100 entries
  and 30,000 characters. Invalid configuration prevents startup without echoing it.
- When enabled, destinations must use HTTP or HTTPS without embedded credentials.
  This is a **host** policy: any port and path on an allowed host remain permitted.
  It does not perform DNS resolution and cannot control redirects issued by the
  destination website itself. Audit wildcard ownership and destination behavior.

Configure every application process consistently and restart after changes. Do
not publish the management service or remove WAF/SSO to test this feature.

## Coverage And Existing Data

Checks apply to personal/admin/shared-workspace creation and target edits, JSON/CSV
import previews and commits, routing destinations, forwarding configuration and
previews, and custom-domain homepages. Actual public/protected redirects, including
HEAD requests and fallback homepages, recheck the selected destination before
consuming a visit allowance. A rejected existing redirect returns an uncached 410
without a `Location` header. Health probes report `DESTINATION_POLICY_DENIED`
without sending an outbound request.

Existing rows are **not rewritten or deleted**. Owners can inspect/export records,
repair a destination, or edit unrelated metadata. Policy rejection does not grant
access to another owner's link or bypass a token's domain restrictions.

Edit forms may submit an unchanged, now-disallowed stored target while updating
metadata. This exception is checked only after a fresh authorized link lookup;
personal/admin edits omit that target from the write, so a concurrent repair is
not reverted. Actual target changes still require policy approval. Workspace
edits compare against the locked record and retain their existing revision and
membership checks. Missing/foreign records and stale ownership/domain scope do
not qualify for the exception.

Signed-in users can inspect the effective policy at `/settings/destination-policy`.
`GET /api/destination-policy` and `GET /api/v2/destination-policy` expose the same
read-only `{ enabled, hosts }` object to authenticated sessions or tokens with
`links:read`. Responses are private/no-store. There is intentionally no browser/API
policy editor: changing an installation-wide trust boundary is an operator action.
Policy explanations and validation errors are available in English, French and
Spanish using the shared locale catalogs.

## Deployment And Recovery

1. Back up the database, environment and secrets and verify a writable restore.
2. Export/audit all destinations, routing rules and custom-domain homepages before
   enabling a policy. Repair or explicitly approve each necessary host.
3. Exercise the policy against a restored disposable instance, including old links,
   password-protected links, imports, custom-domain roots and shared workspaces.
4. Apply the environment to all processes, restart, and verify authorized edits,
   anonymous allowed redirects and uncached denied redirects through the real WAF.
5. To roll back this feature, clear `DESTINATION_ALLOWED_HOSTS` and restart all
   processes. No database migration or data rollback is required. Do not clear it
   merely to hide an invalid configuration or a genuine untrusted destination.

The homelab default remains disabled until a host policy has been intentionally
approved; shipping this feature does not silently block existing public links.

## Tests

`KUTT_TEST_ONLY=destination-policy node tests/container-smoke.cjs` uses a fresh
isolated database and checks grammar, IDNA, wildcard boundaries, fail-closed startup,
both API prefixes, scopes, CSRF, imports, workspaces, rules, homepages, protected
redirects, counters, health probes, repair and restart rollback. The normal container
suite also includes it. `tests/browser-destination-policy.sh IMAGE` starts a fresh
loopback-only fixture and checks the translated UI and rejected draft recovery at
1440, 390 and 320 pixels in light and dark mode.

The same focused suite includes `tests/destination-policy-edit.cjs` and its
deterministic repair/ownership/domain-scope race checks. Run
`sh tests/browser-destination-policy-edit.sh IMAGE` for actual personal/admin and
native workspace form submissions at 1440/390/320px under enforced CSP, including
unchanged denied targets, rejected changed targets, retained drafts and repair.
This wrapper uses only a fresh loopback fixture and deletes its own container;
Node/Playwright paths can be supplied through `NODE_BINARY`/`PLAYWRIGHT_MODULE`.
