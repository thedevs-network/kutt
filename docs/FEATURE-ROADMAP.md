# Kutt fork roadmap

Public redirects stay separate from authenticated management. WAF, native OIDC,
data and existing integrations must survive each deployment. The completed
feature series is submitted in upstream PR #1046; the dependency-security PR is
separate. Subsequent enhancements are tracked in [the community review](UPSTREAM-PR-REVIEW.md).

## Release gates

Implement one feature, run regression and applicable rendered-UI tests, publish
an immutable fork version, take a consistent production database backup, deploy
that exact version, verify protected management and public redirects, and record
rollback instructions. Checked items have passed deployment gates. Never publish
secrets, local configuration or application data.

## Foundation

- [x] Named, hashed, scoped, expiring, individually revocable API tokens (`v3.2.6-sr94.1`, deployed and verified 2026-09-13).
- [x] Token domain restrictions and idempotent link creation (`v3.2.6-sr94.2`, deployed and verified 2026-09-13).
- [x] Link pause, scheduled start/end, maximum visits and request-time expiry (`v3.2.6-sr94.3`, deployed and verified 2026-09-13).
- [x] History, trash and restore without silently reusing retired aliases (`v3.2.6-sr94.4`, deployed and verified 2026-09-14).
- [x] Stable OIDC identities, access revocation and authentication diagnostics (`v3.2.6-sr94.5`, deployed and verified 2026-09-14).

## Everyday management

- [x] Tags, collections, saved filters and ownership-safe bulk actions (`v3.2.6-sr94.6.1`, deployed and verified 2026-09-14).
- [x] CSV/JSON import/export with dry run and explicit alias-conflict handling (`v3.2.6-sr94.7`, deployed and verified 2026-09-14).
- [x] QR code PNG/SVG export and print (`v3.2.6-sr94.8.1`, deployed and verified 2026-09-14).
- [x] Shared workspaces with owner/editor/viewer permissions (`v3.2.6-sr94.9`, deployed and verified 2026-09-14).

## Advanced routing and operations

- [x] Ordered device/language/country/query rules with redirect test preview (`v3.2.6-sr94.10.1`, deployed and verified 2026-09-14).
- [x] Analytics date ranges, exports, tag summaries and consistent bot filtering (`v3.2.6-sr94.11`, deployed and verified 2026-09-14).
- [x] Per-link tracking opt-outs and configurable analytics retention (`v3.2.6-sr94.12`, deployed and verified 2026-09-14).
- [x] Signed asynchronous webhooks and authenticated live updates (`v3.2.6-sr94.13`, deployed and verified 2026-09-14).
- [x] Multi-segment aliases and allowlisted query/path forwarding (`v3.2.6-sr94.14.1`, deployed and verified 2026-09-14).
- [x] SSRF-safe destination health checks and actionable monitoring (`v3.2.6-sr94.15`, deployed and verified 2026-09-14).
- [x] Scoped-token iOS Shortcut example (`v3.2.6-sr94.16`, deployed and verified 2026-09-15 Europe/Paris).

Unicode aliases and extra database engines are optional follow-ups. Each item
needs tests and migration/rollback notes before completion. The completed feature
series is submitted as [upstream PR #1046](https://github.com/thedevs-network/kutt/pull/1046)
on `feature/managed-links-roadmap`. Its September 18-19 update also includes the
selected community improvements and all 25
confirmed UI/UX fixes through `v3.2.6-sr94.39.2`, with publication, deployment and
verified pre/post recovery. All four explicit user-assisted acceptance gates
subsequently passed. Release `.40` closes the finalized seven-finding security
review with exact-image regression, desktop/mobile DNS ownership UI, real public
DNS/WAF verification, monitored deployment and pre/post writable NAS restores.
See [the UI/UX ledger](UI-UX-REVIEW.md) for exact release/evidence identities and
optional physical printing/Shortcut limits. Optional deferred community
proposals are still excluded. Maintainer review/merge is not claimed.

## Final Roadmap Deployment Evidence

- [Release .16](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.16)
  and [passing release CI](https://github.com/RobinMJD/kutt/actions/runs/34905728970).
  Runtime source is `e5df9b1`; later closure commits change documentation only.
  Source digest: `sha256:c4288e8344b0a9e8b6d2139e1ce085713601c69d657f573c3f056b7e10834c3c`.
- Exact hardened wrapper regressions, configuration checks, fresh Redis worker
  tests and desktop/mobile workflows passed. The optional signed Shortcut is
  credential-free; native macOS dummy-fixture execution passed. Physical iPhone
  acceptance remains untested and is not needed to run the server.
- The final source review produced nine findings, all patched with targeted
  regression tests. Its recorded coverage is partial, not a claim of exhaustive
  security certification. Fresh exact-image scanning found zero critical/high
  and three medium BusyBox package matches for CVE-2025-60876, with no vendor fix
  listed. Findings were not suppressed; see [security maintenance](SECURITY-MAINTENANCE.md).
- Consistent pre-release and clean post-release snapshots were copied off-host
  to NAS, fully restored with byte verification, and migration/integrity/foreign
  key/write-tested in the exact wrapper. Original secrets were separately
  preserved; the isolated write checker uses a dummy secret, not live webhook
  delivery. Original user/link/configuration fingerprints remain unchanged.
- Full public HTTPS/WAF regression and real Authentik signed logout/replay
  passed. Disposable fixtures were removed. Public redirects remain public;
  native OIDC management and WAF protections were not weakened.
- Two post-restart samples 65 seconds apart passed: exact image, healthy,
  zero restarts, three fresh probes, no Kutt alerts, failed units or unhealthy
  containers. Whole-lab validation passed with existing unrelated template
  warnings. SQLite is fully regression-tested; PostgreSQL/MariaDB configuration
  validation is not a full feature-parity claim.
- `.16` adds no migration. Do not roll back across earlier feature migrations
  without their documented recovery checks. An image-only `.16` to `.15`
  rollback reintroduces security defects; fix forward where possible.

## Fifteenth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.15)
  and [passing release CI](https://github.com/RobinMJD/kutt/actions/runs/34853923934).
  Source commit `4df2b46`; main CI also passed. Source image digest:
  `sha256:c62473aa23efe41d9c65f4f304653b883cecdea546993622b45254ed37c9a143`.
- Full source and exact-wrapper regressions passed: opt-in configuration,
  owner/domain/token/CSRF boundaries, revisions, leases, crash/restart recovery,
  stale-result rejection, DNS pinning/private-address denial, bounded HEAD-only
  checks, classification and unchanged redirect/analytics behavior. Exact-image
  desktop/mobile workflows passed with reviewed screenshots and no overflow.
- Fresh NAS backup was byte-restored, migrated and write-tested on the exact
  wrapper. Original records, integrity and foreign keys remain unchanged.
  Full public WAF regression, real asynchronous public HTTPS HEAD, and real
  Authentik signed logout/replay passed. Disposable fixtures were removed; a
  clean post-release backup was copied to NAS (not separately restored).
- A restricted periodic collector exports only aggregate metrics. Tested and
  loaded alerts cover missing/failed collection, stalled worker, attention and
  overdue checks. All four rules are healthy and inactive after deployment.
  Repeated health samples passed: healthy/zero restarts, three fresh probes,
  no Kutt alerts, failed units or unhealthy containers. Whole-lab validation
  passed with existing unrelated warnings. Scan: zero critical/high, six medium,
  one low, retained for the final security pass.
- Recovery must preserve monitor configuration, authorization versions and
  worker state. Restore isolated before reviewing outbound destinations; see
  [destination health recovery](DESTINATION-HEALTH.md#migration-and-recovery).

## Fourteenth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.14.1)
  and [passing release CI](https://github.com/RobinMJD/kutt/actions/runs/34850132212).
  Source commit `9ed67e2`; main CI also passed. Source image digest:
  `sha256:692c9ab3aa8397b2de217d54003fbe715dfa1966065302eb1a21ca2b0efa16f4`.
- Full source and exact-wrapper regressions passed, including nested aliases,
  child/tombstone precedence, bounded allowlists, query precedence, protected and
  Basic/HEAD/routing/quota paths, authorization, conflicts, restart, transfer and
  guarded downgrade. Exact-image desktop/mobile controls and protected forwarding
  passed with reviewed screenshots, no overflow and no browser errors.
- The `.14` public test exposed CRS 930120 matching the JSON field name
  `forwarding_path`. `.14.1` uses `suffix_path`, retains legacy application
  compatibility and rejects conflicting fields. No WAF rule was relaxed.
- Fresh NAS backup was byte-restored, migrated and write-tested on the exact
  wrapper. Original record fingerprints, integrity and foreign keys are unchanged.
  Full public regression and real Authentik signed logout/replay passed. Disposable
  fixtures were removed; a clean post-release backup was copied to NAS.
- Two post-restart samples passed: exact image, healthy/zero restarts, three
  fresh probes and no Kutt alerts, failed units or unhealthy containers. Whole-lab
  validation passed with existing unrelated warnings. Scan: zero critical/high,
  six medium and one low, retained for the final security pass.
- Preserve the new policy tables and aliases on recovery. Older images cannot
  safely route this database; see [forwarding recovery](FORWARDING.md).

## Thirteenth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.13)
  and [passing release CI](https://github.com/RobinMJD/kutt/actions/runs/34842758878).
  Source commit `bf3395f`; main CI also passed. Source image digest:
  `sha256:5f1aea343bd4e059538ed8a934abf936f6c5c802bc0e430eac6fd649a982d62b`.
- Source and exact hardened-image suites passed: owner/scoped/domain/CSRF
  boundaries, transactional outbox, encrypted one-time signing material,
  HMAC/tamper/replay-age verification, public-only pinned DNS/TLS, retry limits,
  crash leases, cancellation, restart, private SSE revocation and guarded
  downgrade. Desktop/mobile editing, delivery history, live events, rotation,
  conflicts and error/retry passed with reviewed screenshots and no overflow.
- Fresh NAS backup restore was byte-verified, migrated and write-tested on the
  exact wrapper. Original user/link/SSO identity fingerprints, integrity and
  foreign keys are unchanged. All disposable test users/hooks/events were removed.
- Full public WAF regression passed, including authenticated SSE and real
  asynchronous synthetic HTTPS 204 delivery. The deliberate loopback receiver
  was denied by CRS 931100 before application validation; the acceptance test
  now recognizes that specific WAF denial and verifies no configuration change.
  No WAF or application protection was weakened. Real Authentik signed logout,
  replay and revoked-cookie denial passed.
- Two post-restart health samples passed: exact image, healthy/zero restarts,
  three fresh probes, no Kutt alerts, failed units or unhealthy containers.
  Whole-lab validation passed with existing unrelated template warnings.
  Clean post-release backup copied to NAS (not separately restored). Wrapper
  scan: zero critical/high, six medium and one low, retained for final review.
- Restore requires the database and original JWT encryption secret, isolated
  outbound delivery and receiver-event reconciliation. Image-only downgrade can
  lose events and ignores new controls; see [recovery restrictions](WEBHOOKS.md#migration-and-recovery).

## Twelfth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.12)
  and [passing release CI](https://github.com/RobinMJD/kutt/actions/runs/34838219177).
  Source commit `1b62772`; main CI also passed. Source image digest:
  `sha256:619856a003e332d038241530daee5a25b53c7fc0976a408566d8bd63c93881be`.
- Full source and hardened-image regressions passed: tracking generations,
  stale/legacy queue handling, transactional policy rechecks, public quotas,
  owner/domain/token/CSRF boundaries, transfer preservation, signed retention
  previews, acknowledgement, UTC cutoff, bounded purge rollback/recovery,
  cache exclusion and guarded downgrade. Desktop/mobile native controls,
  conflicts, loading, preview, save, error/retry and reload passed with reviewed
  screenshots and no browser errors or overlapping controls.
- Fresh NAS pre-release restore was byte-verified, migrated and write-tested on
  the exact wrapper. Original user/link/identity fingerprints, integrity and
  foreign keys remain unchanged. All disposable production fixtures were removed.
- Public WAF tests passed for privacy and all prior features. Real Authentik
  signed logout/replay and revoked-cookie rejection passed. Retention was only
  read/previewed in production: days/revision/deleted buckets remain zero.
- Two post-restart health samples passed: exact image, healthy/zero restarts,
  three fresh probes, no Kutt alerts, failed units or unhealthy containers.
  Whole-lab validation passed with existing unrelated template warnings.
  Clean post-release backup copied to NAS (not separately restored). Wrapper
  scan: zero critical/high, six medium, one low, retained for final review.
- Older images ignore privacy policies. Do not image-only roll back after using
  these controls; see [privacy recovery restrictions](PRIVACY.md#migration-backup-and-rollback).

## Eleventh deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.11)
  and [passing release CI](https://github.com/RobinMJD/kutt/actions/runs/34834648451).
  Source commit `65bf004`; main CI passed too. Source image digest:
  `sha256:1cea0e722bd4aecf80564354526925f93517b618f6455946ded3750cfff3baf1`.
- Full source and hardened-image suites passed: UTC dates, private filters and
  exports, tag overlap, owner/admin/domain/token boundaries, malformed aggregates,
  consistent bot filtering, concurrent atomic counters, object-property referrers,
  legacy stats, restart and lossless index downgrade/reapply. Prior feature and
  OIDC regressions passed. Desktop/mobile charts, filters, tables, exports and
  empty/error/retry states passed with reviewed readable screenshots.
- Fresh pre-release NAS restore was byte-verified, migrated and write-tested on
  the exact wrapper. Original user/link/identity fingerprints, integrity and
  foreign keys remained unchanged; all disposable live fixtures were removed.
- Public WAF tests passed for analytics and every previous feature. Real
  Authentik-signed logout and replay passed, including revoked-cookie rejection.
  WAF/SSO and public redirect behavior were not weakened.
- Two post-restart health samples passed: exact image, zero restarts, three fresh
  probes, no Kutt alerts, failed units or unhealthy/restarting containers. Clean
  post-release backup was copied to the NAS (not separately restored). Wrapper
  scan: zero critical/high, six medium, one low, retained for final review.

## Tenth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.10.1)
  and [passing release CI](https://github.com/RobinMJD/kutt/actions/runs/34830876322).
  Source commit `a31713f`; main CI also passed. The immutable `.10` was superseded
  by `.10.1` after final review found a long-query compatibility edge case for
  default-only password-protected links. Both paths now have regression coverage.
- Source digest: `sha256:593c3cacb0a11839ab424b0163ecf49af33e79874a653b3cf6c5d86d33cd5d2e`.
  Full hardened-image regressions cover ordered/typed conditions, preview without
  visits/quota, protected and Basic paths, transfer, owner/domain/token/CSRF
  boundaries, concurrent revision conflicts, forced transactional rollback,
  restart persistence and guarded downgrade. Existing feature/OIDC suites pass.
- Exact-image desktop/mobile editing, priority, draft preview, save/reload,
  native password redirect, conflict recovery and fallback passed, with reviewed
  screenshots, no overflow and no browser runtime errors.
- Fresh NAS pre-release backup was byte-verified, migrated and write-tested on
  the exact wrapper. Original user/link/identity fingerprints remain unchanged;
  integrity and foreign keys are clean. All disposable fixtures were removed.
- Public HTTPS/WAF tests passed for the new feature, legacy compatibility and
  all previous workflows. Real Authentik-signed logout/replay passed and the
  revoked cookie was rejected. No WAF/SSO protections were relaxed.
- Two post-restart health samples passed: exact image, healthy/zero restarts,
  three fresh internal/public/Synology probes, no Kutt alerts, failed units or
  unhealthy/restarting containers. Post-release backup copied to the NAS (not
  separately restored). Wrapper scan: zero critical/high, six medium, one low.

## First deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.1).
- [Passing release CI](https://github.com/RobinMJD/kutt/actions/runs/34776637819).
- Production source image digest: `sha256:6e51b77fa2a6cb6ed15778d5bd7af68085560b3f166bf71f4851d9f94d303974`.
- Isolated SQLite regressions, schema rollback/reapply and migration of an
  off-host restored production database passed. No existing user/link loss.
- Browser create/copy/reload/revoke passed at 1440x1000 and 390x844. Mobile layout
  was corrected after screenshot review. No browser runtime errors remained.
- Public HTTPS tests passed through the existing WAF: OIDC initiation accepted,
  anonymous management denied, scoped CRUD/revocation enforced, cookie privilege
  escalation denied, and public short-link redirects preserved.
- Healthy production container, zero restarts and three successful probes after
  deployment. No WAF/SSO policy relaxation or newly published backend ports.

## Second deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.2)
  and [passing CI](https://github.com/RobinMJD/kutt/actions/runs/34778278203).
- Source digest: `sha256:79c259f3cd0c1ada72bc8ecf50b829f0cb08ddbeb6f1aab6fc39f8554941314b`.
- Restricted-domain authorization, concurrent retries, restart replay, conflicts,
  schema rollback/reapply, legacy compatibility and desktop/mobile UI passed.
- An off-host backup was restored, byte-verified and migrated on the exact
  hardened release image with integrity, foreign-key and write checks passing.
- Live HTTPS/WAF checks passed for domain denial, identical idempotent replay,
  deletion/revocation, cookie non-escalation and public redirects. Existing data
  was retained. Container healthy, zero restarts, all three probes successful.
- Wrapper scan: zero critical/high, six medium and one low findings.

## Third deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.3)
  and [passing CI](https://github.com/RobinMJD/kutt/actions/runs/34780009689).
- Source digest: `sha256:dde17fa796ae69eb40359de65fc80368daf6e1e433dc930d2b406ddd2c51c448`.
- Hardened-image regressions passed: concurrent redirect caps, password paths,
  schedules, expiry retention, ownership/CSRF, old idempotency keys and guarded
  schema rollback/reapply. Desktop/mobile editing passed without browser errors.
- Off-host pre-upgrade backup restore was byte-verified, migrated and write-tested
  on the exact hardened image, retaining existing users and links.
- Live HTTPS/WAF checks passed for pause/resume and quota exhaustion, plus previous
  domain/replay/revocation/public-redirect tests. Production healthy, zero restarts,
  three green probes, no Kutt alerts, no failed units or unhealthy containers.
- Wrapper scan: zero critical/high, six medium and one low findings. Existing
  WAF, SSO and backend isolation were unchanged.

## Fourth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.4)
  and [passing CI](https://github.com/RobinMJD/kutt/actions/runs/34805030917).
- Source digest: `sha256:cfeacf1b9a48f1157f88e740c1fdd0e4819b5e62ad49a3d6a79a32ae326b3f4c`.
- Hardened-image tests passed for populated migration, duplicate-conflict
  transactional rollback, guarded downgrade, audit privacy, owner/domain/token
  boundaries, concurrent alias claims, trash/restore and retained policies.
- Desktop/mobile delete, history and restore passed with no runtime errors or
  overflow. Long targets wrap correctly. Explicit false on domain deletion is
  regression-tested to preserve active links.
- Off-host backup restore was byte-verified, migrated and write-tested on the
  exact published wrapper, retaining existing users and links.
- Live HTTPS tests passed through the unchanged WAF: history/trash/restore,
  reserved aliases, retained quota, plus existing token/retry/public routing and
  OIDC initiation checks. Healthy, zero restarts, three green probes, no new
  failed units/unhealthy containers or Kutt alerts. Post-deployment backup copied
  to the NAS. Wrapper scan: zero critical/high, six medium and one low.

## Fifth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.5)
  and [passing CI](https://github.com/RobinMJD/kutt/actions/runs/34807339095).
- Source digest: `sha256:b77f825babceffcea01035a9a92fd9a54098db8a985f2b5a981fce58e7b9739f`.
- Exact hardened-image regressions passed for real mock-provider signatures,
  code/PKCE, stable identities, verified-email collision refusal, revocation,
  replay, absolute session expiry, ownership/CSRF, outage recovery and guarded
  downgrade. Desktop/mobile security-page and copied-cookie invalidation passed.
- NAS backup restore was byte-verified, migrated, identity-bound and write-tested
  on the exact wrapper. The accompanying provider database dump also restored
  successfully in an isolated container. Original user and link were preserved.
- Authentik's real HTTP client delivered signed logout and replay through the
  public WAF; both returned 200 and the revoked cookie returned 401. Ordinary
  users could not see administrator diagnostics. Existing public HTTPS smoke
  tests also passed. No WAF/SSO controls were relaxed.
- Production healthy, zero restarts, three green probes, no failed units or
  unhealthy containers. Consistent post-release backup copied to the NAS.
  Wrapper scan: zero critical/high, six medium and one low findings.

## Sixth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.6.1)
  and [passing CI](https://github.com/RobinMJD/kutt/actions/runs/34810123564).
- Source digest: `sha256:47b97811699c57097ffa60eb7a1c429067948b4a5393319a407303cd8bfad766`.
  The immutable `.6` artifact was superseded before deployment to fix archived
  custom-domain display; `.6.1` includes regression coverage for that case.
- Exact hardened-image tests passed for labels/collections, saved AND filters,
  literal search, owner/domain/token/CSRF boundaries, transaction rollback after
  a forced second-row failure, restart persistence and guarded downgrade.
- Desktop/mobile creation, assignment, filters, selection, rename, deletion,
  pause/resume and trash passed. Screenshots showed no overflow or runtime errors.
- NAS restore was byte-verified, migrated and write-tested on the exact wrapper,
  retaining the original user and link. A post-release backup was copied to NAS.
- Live WAF tests passed for native forms, saved filters, scoped bulk operations,
  domain denial and existing public redirect/token/history/lifecycle behavior.
  Real Authentik-signed logout and replay passed; revoked cookies were rejected.
- Production healthy, zero restarts, original user/link/identity retained,
  integrity and foreign keys clean, three green probes and no Kutt alerts or
  failed units/unhealthy containers. Wrapper scan: zero critical/high, six medium
  and one low findings. WAF, SSO, secrets and backend isolation are unchanged.

## Seventh deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.7)
  and [passing CI](https://github.com/RobinMJD/kutt/actions/runs/34812610404).
- Source digest: `sha256:d78d0363df77e1e019259ee4d7e2173d322c0ab1e04bd89b6a70f119e069e4e5`.
- Exact hardened-image tests passed for CSV/JSON round trips, reversible formula
  escaping, dry-run no-write, signed confirmation, atomic rollback, concurrent
  retry/restart replay, password/lifecycle preservation and owner/domain/token
  boundaries. Limits, receipt expiry and guarded downgrade also passed.
- Desktop/mobile file selection, previews, confirmation, downloads, errors and
  existing library workflows passed. Screenshots verified readable previews,
  no overflow or overlapping navigation; no browser runtime errors remained.
- NAS restore was byte-verified, migrated and write-tested on the exact wrapper,
  retaining the original user and link. A post-release snapshot was copied to NAS.
- Live HTTPS/WAF tests passed for import UI, scoped dry run/import/replay,
  private CSV/JSON exports, imported public redirects and prior feature behavior.
  Real Authentik-signed logout/replay and revoked-cookie rejection passed.
- Production healthy, zero restarts, original user/link/identity retained,
  clean integrity/foreign keys, three green probes and no Kutt alerts or failed
  units/unhealthy containers after the health interval. Whole-lab validation
  passed with pre-existing unrelated environment-template warnings. Wrapper scan:
  zero critical/high, six medium and one low; WAF/SSO/isolation unchanged.

## Eighth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.8.1)
  and [passing CI](https://github.com/RobinMJD/kutt/actions/runs/34815596416).
- Source digest: `sha256:2eb264bea9aa1b2b2f79f395bd89e893b35cd82a6f8d056d18c6470ceb281720`.
  Immutable `.8` failed release CI before image publication/deployment because
  the QR library rounded certain PNG dimensions. `.8.1` fixes it with an exact
  integer canvas and deterministic regression; the original tag was not reused.
- Exact hardened-image regressions passed for PNG pixels/quiet zone/dimensions,
  SVG headers, owner/domain/token/cookie boundaries, password/lifecycle privacy,
  zero visit side effects and restart/revocation, plus all earlier features.
- Desktop/mobile navigation, settings, downloads independently decoded with
  jsQR, print/PDF and image-load failure/recovery passed. Screenshots showed
  readable, non-overlapping controls. Physical printer/phone acceptance is not
  inferred from automated browser checks.
- Fresh NAS restore was byte-verified, migrated and write-tested on the exact
  release wrapper. A post-release snapshot was copied to NAS. Public HTTPS/WAF
  tests passed for the QR page, PNG dimensions,
  SVG attachment and authorization, plus prior features and real Authentik
  signed logout/replay with revoked-cookie denial.
- Production healthy, zero restarts, original user/link/identity retained,
  clean integrity/foreign keys, three green probes and no Kutt alerts or failed
  units/unhealthy containers after a health interval. Whole-lab validation
  passed with existing unrelated environment-template warnings. Wrapper scan:
  zero critical/high, six medium and one low. WAF/SSO/isolation unchanged.

## Ninth deployment evidence

- [Published release](https://github.com/RobinMJD/kutt/releases/tag/v3.2.6-sr94.9)
  and [passing CI](https://github.com/RobinMJD/kutt/actions/runs/34824263532).
- Source digest: `sha256:4331621a776b505f7b280cc43faefbb49158252ae6a5f31bbf2c110c6a4bc1be`.
- Exact-wrapper regressions passed owner/editor/viewer roles, accepted invitations,
  immediate revocation, personal/domain isolation, scoped-token/cookie boundaries,
  CSRF, concurrent edits, forced transactional rollback, persistence, retained
  public links after workspace closure and guarded migration downgrade.
- Desktop/mobile create/invite/accept/share/edit/role/revoke/close workflows passed,
  including long destinations, clipboard, trash/restore and readable layouts.
- Fresh NAS backup restore was byte-verified, migrated and write-tested on the
  exact wrapper. A cleaned post-deployment snapshot was copied to NAS.
- Public HTTPS tests passed through unchanged WAF/SSO, including workspace roles,
  scoped writes, revocation and preserved redirects. Authentik signed logout and
  replay passed. Negative tests initially triggered the existing WAF error-rate
  ban; only the test-origin/service ban was removed, and tests now share pacing
  below that threshold. No protection or authorization assertion was disabled.
- Original user/link/identity retained, clean integrity/foreign keys, no remaining
  disposable workspaces/accounts, healthy with zero restarts, three green probes,
  no Kutt alerts or failed units/unhealthy containers. Whole-lab validation passed
  with existing unrelated environment-template warnings. Grype: zero critical/
  high, six medium and one low (valid database dated 2026-09-13).

PostgreSQL/MySQL application support and human MFA acceptance remain separate
validation work; application deployment evidence is for SQLite. Unchecked items
above remain subject to all release gates.
