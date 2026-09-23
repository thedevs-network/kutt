# Link history, trash and restore

Delete now moves a link to **Trash** instead of permanently deleting it. The
normal list hides trashed links; its Trash link opens a paginated owner-only
view. Restore confirms before reactivating the record. History is available
from Edit and from each trash entry, with paginated chronological audit events.

## Retention and routing

- Trash retains the UUID, target, password hash, analytics, visit quota,
  schedules, expiry and pause state. It has no automatic purge timer.
- Trashed public links return 410, without target disclosure or caching.
  Password submissions cannot bypass trash. Restore does not clear pause,
  expiry, schedules, quota or bans; a restored link can remain unavailable.
- Banned links cannot be restored. Administrators can still moderate and trash
  links through existing administration actions, but history and restore are
  owner-only, including for administrator sessions.
- Aliases are permanently reserved per hostname. Renaming reserves the old
  alias; trash, account removal and domain removal do not release it. A retired
  alias cannot be renamed back or assigned to another link. Restore reactivates
  the existing link's current alias, not an earlier alias.
- Domain deletion with link deletion selected archives its links, recording the
  original hostname. They never fall back to the default domain. Restore requires
  that the original owner currently owns the same non-banned hostname again.
  Domain deletion without that option rejects active links with 409. Existing
  user domain detachment keeps its previous behavior.
- Records already permanently deleted before this feature cannot be recovered,
  nor can the migration reserve aliases absent from the old database. Existing
  records receive a `migrated` baseline; earlier edits cannot be reconstructed.

## API

Both `/api` and `/api/v2` prefixes support:

| Operation | Permission | Result |
| --- | --- | --- |
| `DELETE /links/:id` | `links:delete` | 200; moves to trash, repeat is idempotent |
| `GET /links/trash` | `links:read` | Paginated owner-only trash |
| `GET /links/:id/history` | `links:read` | Paginated owner-only audit events |
| `POST /links/:id/restore` | `links:update` | 200 with the retained link; repeat is idempotent |

List endpoints accept `limit` (1..50, default 25) and `skip` (0..1000000), returning
`total`, `limit`, `skip` and `data`. Another owner's link returns 404; token domain
restrictions apply to history, trash and restore. A default-domain token cannot
gain access when a removed custom domain is archived. Browser cross-origin delete
and restore requests are rejected. Explicit scoped credentials never inherit
administrator access from cookies.

History records creation, changed field names, trash, restore and domain removal,
with UTC time and actor category/source. It does **not** store previous targets,
passwords, hashes or token secrets in the audit payload. It is an audit history,
not a target-version rollback feature. Account deletion still removes that
account's retained links and associated history, while alias reservations remain.

Creation with `reuse: true` ignores trash. Retried idempotent creation for a
trashed link returns 409 and cannot resurrect it. Creating or renaming to a
retired alias returns 409; an already-active alias retains the existing 400 error.
Existing links, users, keys and normal API response fields are preserved. New
responses include nullable ISO `deleted_at`; the deliberate delete behavior
change is 410 on a trashed public URL instead of redirecting to `/404`.

## Migration and recovery

`20260914001000_link_history_trash` adds nullable link columns plus
`link_history` and `link_alias_claims`. Claims are inserted in bounded batches;
duplicate historical hostname/alias pairs fail migration instead of silently
choosing a record. Investigate duplicates and preserve all data before retrying.
Keep `DEFAULT_DOMAIN` stable; a hostname change needs an explicit alias-claim
migration. SQLite is the tested deployment engine; other engines need separate
validation, especially around transactional DDL.

Back up all three tables together. Down migration refuses trash, audit changes,
retired or orphaned alias claims. Do not run `.3` or older on this schema: old
code ignores trash and can expose trashed URLs. Prefer the same verified `.4`
image or fixing forward. A pre-feature backup must be restored in isolation and
all later writes reconciled before any rollback cutover. Never erase current
data or security controls to make downgrade tests pass.

Tests: `tests/link-history.cjs` covers API/state/concurrency/authorization and
`tests/browser-history.cjs` exercises real desktop/mobile delete/history/restore.
Run the browser script only with `KUTT_BROWSER_DISPOSABLE=1` and a fresh loopback
`KUTT_TEST_URL`; it refuses to bootstrap an initialized application.
