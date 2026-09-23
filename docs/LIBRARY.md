# Library organization and bulk changes

Release `3.2.6-sr94.6.1`, deployed and verified on 2026-09-14. See the
[roadmap evidence](FEATURE-ROADMAP.md#sixth-deployment-evidence).

## Management

Open **Library** above the recent-links table. Tags and collections are private
named labels; a link can belong to multiple collections and have multiple tags.
They do not grant access or transfer ownership. See [Workspaces](WORKSPACES.md)
for shared links. Search matches literal substrings in alias, target and description.
Tag and collection filters combine with AND. State distinguishes **Not in trash**,
**Paused**, **Not paused** and **In trash**. Not paused does not imply an available
redirect: a link may be scheduled, expired or at its visit limit.
The current lifecycle status remains visible on each result. Trashed links from
removed custom domains keep their original hostname; they are never presented
as links on the default domain. The initial `.6` artifact was superseded before
production deployment to correct this archived-host display case.

Expand **Tags, collections and saved filters** to create, rename or remove labels
and save the current search. Saved filters can be renamed, replaced with the
current selection, or removed. A referenced label cannot be removed until its
saved filter is updated/removed: deleting it must not silently broaden a query.
Names are Unicode-normalized and case-insensitively unique within each kind and
account. Limits: 80 characters/name, 100 tags, 100 collections, 50 saved filters.

Select individual links or the current page, then add/remove a label, pause,
resume, or move to trash. Selection never implicitly includes other pages. Trash
requires browser confirmation and preserves history, aliases, policies and
organization for restore. Removing a label or collection never deletes links.

After a successful bulk action, the page shows the server-confirmed action and
selected-link count, focuses that result and clears selection. Counts include
already-applied operations, so the result does not claim every row changed or
became available. Pending Apply prevents a second submission. Native POST/303/GET
navigation prevents refresh from repeating the action. The short-lived result
cookie is signed, user-bound, HttpOnly and SameSite Strict (Secure on HTTPS),
cleared after display, and contains no link content. Invalid/expired receipts or
failed mutations never show a success message. This feedback is not an access
credential. These UX-004 changes are under release validation, not yet deployed.

## API

Routes work under `/api` and `/api/v2`; JSON requests/responses use the same
session or `X-API-Key` authentication as the existing links API.

| Method and path | Input/result | Scoped permission |
| --- | --- | --- |
| `GET /library` | `q`, `tag`, `collection`, `state`, `sort`, `direction`, `page` or `saved` query; `{data,total,page,limit,filters,labels,saved_filters}` | `links:read` |
| `POST /library/labels` | `{kind:"tag"\|"collection",name}`; `{id,kind,name}` | `links:update` |
| `PATCH /library/labels/:id` | `{kind,name}`; same result | `links:update` |
| `DELETE /library/labels/:id` | 204; 409 if saved-filter reference exists | `links:update` |
| `POST /library/filters` | `{name,filters:{q,tag,collection,state,sort,direction}}`; `{id,name,filters}` | `links:update` |
| `PATCH /library/filters/:id` | Same input; replaces name and criteria | `links:update` |
| `DELETE /library/filters/:id` | 204 | `links:update` |
| `POST /library/bulk` | `{ids:[link UUIDs],action,label_id?}`; `{affected,action}` | `links:update`, or `links:delete` for trash |

Bulk actions: `add_label`, `remove_label`, `pause`, `resume`, `trash`. The first
two require `label_id`. Accepts 1-100 distinct UUIDs. A successful response counts
matched links, including already-applied operations; retries do not duplicate
relations or unchanged audit events. No permanent deletion or bulk restore API
is added. Existing single-link restore remains supported.

State query values and existing saved filters remain backward-compatible:
`active` means not in trash, `paused` means paused and not trashed, `unpaused`
means not paused and not trashed, and `trash` means in trash. Only the displayed
filter labels change; lifecycle status is evaluated independently.

Pages contain at most 50 links, newest first by default. [Sorting](LIST-SORTING.md)
also supports alias, destination, creation timestamp and views, with a stable
tie-breaker and preserved saved-filter state. A saved-filter ID resolves only
within the authenticated account. Domain-restricted tokens see only their own
in-scope links and assigned labels; the account-wide label/filter catalogs are
omitted. Such tokens cannot manage labels/filters or load a saved filter, but
can filter in-scope links and assign an already-known owned label. Labels never
expand token domain permissions. No administrator-wide bypass exists here.
Explicit API keys never gain rights from an accompanying browser session.
The HTML library requires a session and rejects API credentials.

Mutation requests enforce same-origin browser checks. Missing/foreign objects
are never made accessible to satisfy a bulk selection. The HTML library sets
`Referrer-Policy: same-origin` so native forms retain their origin without sending
referrers to other sites. Opaque/null origins are still rejected. Missing objects
return 404 without disclosing their owner. Malformed input returns 400, conflicts
409. Bulk operations validate the entire selection and update it in one database
transaction; missing, trashed, banned, foreign or out-of-domain rows roll back
everything. Redis invalidation occurs only after commit. Audit entries record
field names rather than tag names, URLs or other private values. Responses are
`Cache-Control: no-store`.

## Migration, rollback and validation

Migration `20260914003000_library.js` adds `library_labels`,
`library_link_labels` and `library_filters` with ownership indexes, unique
constraints and cascading relations. It does not rewrite existing links, tokens,
users or secrets. User/link deletion removes corresponding organization rows;
soft-deleted links retain labels. Downgrade refuses to discard nonempty library
data. Prefer fix-forward; a backup restore must reconcile subsequent writes.
Do not downgrade below the OIDC security release to bypass session controls.

The container regression covers owner/domain/token boundaries, literal search,
Unicode collisions, saved-filter references, CSRF, forced mid-batch rollback,
restart persistence, retained policies/history and guarded downgrade. Rendered
desktop/mobile tests exercise create/assign/filter/save, selection, pause/resume,
rename and trash. Production deployment also requires an off-host restored
database migration, public WAF smoke and monitoring checks. SQLite is the
validated application database; other engines remain a separate gate.
