# Administrative moderation

Administrators can ban a user, short link or custom/destination domain from the
existing administration tables. Optional checkboxes select related targets.
**Administration > Moderation** lists active bans and a paginated audit, including
destination IP bans created from a link. Each removal has its own confirmation.

## Safety and semantics

- A ban and all selected related bans commit in one transaction. Invalid input,
  unavailable DNS or a protected administrator aborts the entire operation.
  Destination DNS resolution has a three-second deadline before database writes.
- You cannot administratively ban/delete yourself or remove the final active,
  verified administrator. Competing administrative mutations serialize through
  one database row; the rules are checked against fresh locked records.
- Removing a ban restores only that record. Independently banned links, domains,
  users and destination IPs remain banned. The UI never offers cascade unban.
- Banning/unbanning a user increments their authentication generation, invalidates
  sessions/recovery tokens and revokes API credentials. Unbanning does not revive
  old credentials. The user signs in again and creates replacements as needed.
- Destination domain bans preserve existing ownership and homepage metadata.
  Administration cannot claim an already registered domain by inserting it again.
- The audit stores actor ID, target kind/ID, action and UTC time, not passwords,
  tokens, email addresses, link targets or query strings. IDs remain as historical
  references after account deletion. Only administrators can read the audit.
- SQL is authoritative for bans. Cache invalidation is awaited after commit; a
  failed cache invalidation can be retried without duplicating an audit event.
  A transport error is not proof of rollback: review the current state first.

## API

Both `/api` and `/api/v2` expose these administrator-only endpoints. Scoped API
tokens cannot perform moderation, even when an administrator cookie accompanies
them. Browser sessions require the existing same-origin checks. Legacy full
administrator API keys remain supported; new integrations should not create
unnecessarily broad credentials just for moderation.

| Method | Path | Input |
| --- | --- | --- |
| GET | `/moderation` | `entity=user\|domain\|link\|host`, `page` starting at 1 |
| POST | `/users/admin/ban/:id` | Optional `links`, `domains` booleans |
| POST | `/domains/admin/ban/:id` | Optional `links`, `user` booleans |
| POST | `/links/admin/ban/:id` | Optional `host`, `domain`, `user`, `userLinks` booleans |
| POST | `/moderation/:entity/:id/unban` | Empty object; no cascade options |

User/domain/host IDs are positive integers; link IDs are UUIDs. The list returns
`bans`, `events`, `total`, `event_total`, `page`, `limit`, `previous`, `next` and
`entity`. Bans contain `id`, `entity`, `label`; events contain the audit fields
described above. Pages contain at most 25 bans and 25 audit events. The audit is
global, not limited by the selected banned-entry kind.

Use JSON booleans. Existing form strings `on`, `true`, `false`, `1`, `0` and
numeric `1`/`0` are accepted, but arrays, objects, unrecognized strings and unknown
keys are rejected. In particular, string `false` does not enable a cascade.
Expect 400 for malformed input/DNS failure, 401/403 for access denial, 404 for
missing targets and 409 for protected or changed targets. Existing ban responses
remain compatible. Unban returns a JSON confirmation, or 303 for native HTML.

## Upgrade and recovery

Migration `20260922000000_moderation` adds the mutation lock and audit tables.
It does not change existing bans, accounts, credentials or links during migration.
Take a consistent database/secrets/config backup, verify an off-host restore and
exercise candidate migrations plus a disposable write before deployment.

Reload administration after upgrading. The native confirmation pages send
`Referrer-Policy: same-origin` so browsers submit a non-opaque Origin while no
referrer is sent to external sites. Null and foreign origins remain rejected.
Moderation pages are `no-store`. No WAF, SSO or public redirect change is needed.

Prefer forward fixes. Do not drop populated audit tables: migration rollback
refuses if audit records exist. An older image can retain additive tables, but
reintroduces partial-mutation/session-safety defects. Do not restore an older
database just to undo a ban: that would lose newer writes and could revive old
credentials. Use explicit unban and reauthentication instead.

## Verification

`tests/moderation.cjs` runs with the full container regression. Real SQLite,
MySQL and PostgreSQL fixtures exercise competing administrators, final-admin
protection, token/ban races, rollback, cache-retry behavior and guarded downgrade.
`tests/browser-moderation.sh IMAGE` runs keyboard/native confirmation and real
HTMX ban checkboxes at 1440, 390 and 320 pixels, with screenshots and public
redirect checks. The Browser plugin was unavailable; these are regular
Playwright checks, not physical-device acceptance. Publication and deployment
remain tracked separately in [the delivery ledger](COMMUNITY-FEATURE-ROADMAP.md).
