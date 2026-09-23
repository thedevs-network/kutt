# Campaign parameters

Released and deployed in .18, inspired by [upstream PR #997](https://github.com/thedevs-network/kutt/pull/997).
See the [acceptance record](UPSTREAM-PR-REVIEW.md#release-18-acceptance).

## UI

Personal link creation (advanced options), personal/admin inline editing, and
workspace create/edit forms contain a Campaign parameters disclosure. It loads
Source, Medium, Campaign, Term and Content from the current destination URL.
Apply parameters updates that URL; Clear parameters removes those five keys.
The existing Create/Update/Save action persists it. Enter in a campaign field
applies the draft, not the form. Merely opening the controls changes nothing.
Changing the destination reloads the displayed campaign values. Errors preserve
the destination; no preview request contacts the destination or saves a link.

## API

Existing POST/PATCH `/api/links` and `/api/v2/links` (including the existing admin
PATCH route) accept optional `utm_source`, `utm_medium`, `utm_campaign`,
`utm_term`, `utm_content` fields. Workspace link POST/PATCH accepts them too.
An explicit `target` is required whenever any campaign field is supplied,
including PATCH. Existing updates that omit campaign fields are unchanged.

```json
{
  "target": "https://example.com/product?variant=blue#details",
  "utm_source": "newsletter",
  "utm_medium": "email",
  "utm_campaign": "summer sale"
}
```

- Strings are at most 255 printable characters each. Unicode and spaces are
  encoded as URL query values; no HTML or template interpretation occurs.
- Omitted keys preserve existing values. Explicit empty string or null removes
  all occurrences of that key. A supplied value replaces duplicate occurrences.
- HTTP(S) destinations only when using this builder; embedded credentials are
  rejected. The complete encoded URL must fit the existing 2040-character limit.
- Other query keys, repeated unrelated parameters and fragments are preserved
  semantically. URLSearchParams may canonicalize query encoding. Do not use the
  builder on signed URLs whose signature depends on the exact query bytes.
- Normal ownership, admin, workspace role, scoped-key, CSRF, domain and ban checks
  still apply. Campaigns add no new endpoint, scope, remote fetch or access grant.
- Cookie-authenticated legacy link mutations now enforce the same origin guard
  as newer management features. Foreign/null origins and cross-site fetches are
  rejected; valid explicit API keys keep their existing client behavior. Invalid
  keys cannot fall back to a cookie. Non-browser requests without Origin retain
  compatibility. This is defense in depth alongside cookies, CORS and the WAF.
- Normalization precedes idempotency/reuse; changing a campaign changes the
  effective target and cannot incorrectly replay a prior request's result.

## Storage, redirects and recovery

There are no campaign columns, migration, new dependency or secret. The canonical
`links.target` stores the complete destination, so existing backup/restore,
JSON/CSV transfer, QR generation, link health, password/Basic gates, privacy and
lifecycle remain on the same path. History records the changed `target` field
name, never its potentially sensitive query values.

A routing rule's destination replaces the base destination entirely. Put any
desired campaign parameters in that rule's URL; base campaigns are not silently
copied to other destinations. Forwarding keeps the existing precedence: saved
destination parameters win over visitor query strings, even for allowed keys.
This is campaign URL construction, not a new campaign-level analytics dashboard.

Rollback to .17 preserves campaign URLs as ordinary destinations. No data
downgrade or stripping is needed. Older API clients remain compatible. Such a
rollback loses the legacy cookie-origin hardening too; prefer fixing forward.

Tests: `tests/campaign.cjs` (both API aliases, malformed inputs, authorization,
idempotency, workspace roles, redirect paths, forwarding/routing precedence,
transfer, history, trash/restore and restart), `tests/browser-campaign.cjs`
(desktop/mobile create/edit/admin/workspace controls and error recovery), plus
the full release regression suite. Browser plugin unavailable: Playwright uses
a fresh loopback-only disposable instance, never a production login bypass.
