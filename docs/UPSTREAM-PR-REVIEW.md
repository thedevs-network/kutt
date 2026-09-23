# Community Contribution Review

This contribution includes the original managed-link roadmap, its UI/security
fixes and C01-C21 in the [community source guide](COMMUNITY-FEATURE-ROADMAP.md),
prepared for an update to the existing [PR #1046](https://github.com/thedevs-network/kutt/pull/1046).
The selected community features are included here, not deferred to a separate
fork-only branch. This document records proposal lineage and implementation
differences, not operator release chronology or a claim of upstream acceptance.

Follow-up copy and analytics export-contrast fixes preserve the same proposal
lineage. The contribution uses 1,519-key EN/FR/ES catalogs, unchanged machine
values, and existing light/dark controls with rendered contrast and real-download
regressions. Temporary-branch validation does not mean the actual PR has been
updated or accepted; that publication remains separately authorized.

<a id="release-18-acceptance"></a>

## Original Proposal Credits

- [#1016, kkpanfilov: QR copy/download](https://github.com/thedevs-network/kutt/pull/1016).
  Downloads already existed. PNG copying uses the authenticated QR page's
  generated image and selected size, with promise-based encoding, real completion
  feedback and a download fallback. No remote QR service or clipboard read.
  See [QR exports](QR-CODES.md).
- [#1034, utkarshr3144: digit-leading email search](https://github.com/thedevs-network/kutt/pull/1034).
  A shared strict numeric-ID/email filter serves link/domain counts and rows.
  Digit-leading emails are not parsed as numeric user IDs; unsafe IDs return
  no matches. Existing ordinary substring matching is retained.
  See `tests/admin-user-filter.cjs`.
- [#997, seler: UTM campaign fields](https://github.com/thedevs-network/kutt/pull/997).
  Adapted as a shared canonical URL builder rather than parallel database
  columns. Personal/admin/workspace forms retain validation, ownership,
  idempotency and explicit clearing. See [campaigns](CAMPAIGNS.md).

These credits acknowledge the proposals and contributors. They do not imply
verbatim adoption of old patches or endorsement of this implementation.

## Community Feature Lineage

| Included area | Proposal inspiration | Adaptation in this contribution |
| --- | --- | --- |
| C01 Safari analytics | [#1006](https://github.com/thedevs-network/kutt/pull/1006), [#1007](https://github.com/thedevs-network/kutt/pull/1007) | Current parser retained; classify new visits without rewriting history |
| C02 hostname normalization | [#1039](https://github.com/thedevs-network/kutt/pull/1039) author observation | Prefix-only removal across shared callers; no automatic stored-domain repair |
| C03 moderation | [#894](https://github.com/thedevs-network/kutt/pull/894) | Transactional reversible moderation, independent bans, audit and credential invalidation |
| C04 proxy trust | [#1041](https://github.com/thedevs-network/kutt/pull/1041) | Strict peers/CIDRs or bounded hops, preserving legacy booleans |
| C05 CSP | [#1039](https://github.com/thedevs-network/kutt/pull/1039) | Optional staged/enforced nonce policy compatible with current HTMX and custom templates |
| C06 MySQL search | [#992](https://github.com/thedevs-network/kutt/pull/992) | Dialect-safe Unicode filters, counts and real-database regression |
| C07 database TLS | [#969](https://github.com/thedevs-network/kutt/pull/969) | Shared verified transport with bounded file configuration; no verification bypass |
| C08 Redis TLS | [#835](https://github.com/thedevs-network/kutt/pull/835), [#718](https://github.com/thedevs-network/kutt/pull/718) | Same verified configuration for cache, queues and limiting |
| C09 OIDC algorithms | [#1047](https://github.com/thedevs-network/kutt/pull/1047) | Explicit asymmetric allowlist with signed-logout parity |
| C10 custom-domain API | [#985](https://github.com/thedevs-network/kutt/pull/985) | Exact API path boundary; preserve aliases and optional management-host restrictions |
| C11 localization | [#846](https://github.com/thedevs-network/kutt/pull/846), earlier translation proposals | Complete EN/FR/ES catalogs, escaped formatting and request isolation, not DOM rewriting |
| C12 sorting | [#898](https://github.com/thedevs-network/kutt/pull/898), [#879](https://github.com/thedevs-network/kutt/pull/879) | Stable allowlisted ordering, consistent pagination and draft-safe HTMX behavior |
| C13 QR logos | [#1024](https://github.com/thedevs-network/kutt/pull/1024) | Validated raster embedded in PNG/SVG; plain-base64 upload and independent decoding |
| C14 themes | [#838](https://github.com/thedevs-network/kutt/pull/838), [#851](https://github.com/thedevs-network/kutt/pull/851), [#405](https://github.com/thedevs-network/kutt/pull/405) | System/light/dark preference using current tokens and contrast tests |
| C15 OIDC admin mapping | [#966](https://github.com/thedevs-network/kutt/pull/966) | Signed bounded claim mapping with fresh expiry/demotion checks and local recovery admin |
| C16 management host/domain sharing | [#918](https://github.com/thedevs-network/kutt/pull/918) | Separate origin plus explicit per-user grants, never implicit global sharing |
| C17 destination policy | [#973](https://github.com/thedevs-network/kutt/pull/973) | Consistent optional host policy; unchanged-target metadata repair remains authorized |
| C18 metrics | [#986](https://github.com/thedevs-network/kutt/pull/986) | Separate private authenticated listener and bounded non-identifying labels |
| C19 dotted aliases | [#993](https://github.com/thedevs-network/kutt/pull/993) | Interior dots with reserved/traversal limits; case sensitivity retained |
| C20 geography | [#839](https://github.com/thedevs-network/kutt/pull/839), [#831](https://github.com/thedevs-network/kutt/pull/831) | Local interactive map and accessible country table without third-party tracking |
| C21 visit performance | [#822](https://github.com/thedevs-network/kutt/pull/822), [#820](https://github.com/thedevs-network/kutt/pull/820) | Profiling justified an SQLite lookup index, not the proposed batching; durability retained |

The [feature guide](COMMUNITY-FEATURE-ROADMAP.md) links the exact tests and
operational boundaries. [UI/UX validation](UI-UX-REVIEW.md) covers localization,
theme/CSP integration, native grant-revocation warnings and browser limitations.

## Already Covered Or Deliberately Different

The intents of #1042 throttling, #938 bot filtering, #989 duplicate conflicts and
#959 domain-preserving deletion overlap the existing implementation. Preserve its
stronger authorization, retired-alias and public-redirect contracts rather than
replacing them with older handlers. The Node/dependency contribution in
[PR #1045](https://github.com/thedevs-network/kutt/pull/1045) remains separately
reviewable; compatible runtime/dependency changes are retained here.

Global implicit domain sharing, case-insensitive URL identity, unchecked TLS
options, public metrics, historical analytics rewriting and automatic visit
batching are not included. Kubernetes/Helm, subpath hosting and alternate
application schemes remain separate product proposals, not prerequisites for
these workflows.

Validation uses reproducible synthetic fixtures. Provider-specific deployment,
physical devices, private backups and upstream merge decisions are separate
gates. No WAF, authentication or TLS control is weakened to claim compatibility.
