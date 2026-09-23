# Localization

For branded SSO, set `OIDC_PROVIDER_NAME=Authentik` (or another plain-text
provider name) and leave `OIDC_BUTTON_TEXT` at its default. The catalog translates
the whole sentence around the escaped provider name. Existing custom
`OIDC_BUTTON_TEXT` sentences remain verbatim for backward compatibility; migrate
such configuration to the provider-name setting for multilingual buttons.

C11 provides English (`en`, default), French (`fr`) and Spanish (`es`) for the
bundled web UI, email and user-facing server/browser feedback. All community
features use the same catalogs. Consult the
[community source guide](COMMUNITY-FEATURE-ROADMAP.md) for feature boundaries and
tests; source checks alone do not establish a completed deployment.

## Catalogs And Loading

English, French and Spanish each contain **1,519** stable keys with identical
key sets and placeholder names/multiplicities. English remains the default.
Structural parity is not a substitute for translation-quality review.

- `locales/languages.json` is the allowlisted locale-to-native-name registry.
- `locales/en.json`, `fr.json` and `es.json` contain flat, stable message keys.
- `server/i18n-catalogs.js` loads once at startup and rejects invalid registrations,
  missing keys, placeholder mismatches, HTML, raw interpolation and nested messages.
- `static/scripts/i18n-core.js` is the shared Node/browser adapter for pinned
  i18next 26.4.2 and the platform `Intl` formatters. No remote translation service,
  browser language pack or runtime network dependency is used.
- Each translator has a fixed locale. `AsyncLocalStorage` selects the current
  request translator; there is no process-global `changeLanguage()` call. Template
  block accumulators are also request-scoped. Background work defaults to English.

The validated preference cookie wins over `Accept-Language`; otherwise an
unsupported preference/header falls back to English. Regional language headers
such as `fr-CA` negotiate to the bundled base language. `Content-Language` and
`Vary: Accept-Language, Cookie` identify negotiated responses.

The native header selector posts to `/language`, accepts only registered locales,
requires an exact same-origin `Origin`, and redirects with 303 to a validated
relative path. It rejects missing, opaque `null` and foreign origins. The one-year
`kutt_locale` cookie is HttpOnly, SameSite=Lax, path `/`, and Secure on HTTPS. It is
a browser preference, not an account credential or persisted user-profile field.

Rendered HTML uses `Referrer-Policy: same-origin`: native form submissions retain
a valid same-origin Origin, while external sites receive no referrer. The origin
guard is not relaxed to accept `null`. Public redirects and JSON responses retain
the ordinary Helmet policy unless another existing handler changes it.

## Writing Messages

Keep existing keys stable when wording changes. New features should use semantic
keys such as `moderation.appeal_submitted`, not concatenate fragments or generate
keys from translated text. Existing `ui.*` and `messages.*` keys identify the
initial extraction and must not be regenerated during merges.

```js
const i18n = require("./i18n");
throw new CustomError(i18n.t("messages.link_was_not_found"), 404);
const message = i18n.t("library.selected", { count: 2 });
```

```hbs
<p>{{t "ui.edit_value" value1=address}}</p>
<button title="{{t 'ui.copy'}}">{{> icons/copy}}</button>
<time datetime="{{created_at}}">{{date created_at}}</time>
<span>{{localizedLabel "role" role}}</span>
```

```js
output.textContent = window.KuttI18n.t("ui.edit_value", { value1: address });
output.textContent = window.KuttI18n.failure(error);
```

Messages are **plain text**, not trusted HTML. The adapter deliberately returns
unescaped text so every output boundary escapes exactly once: normal Handlebars
mustaches for HTML, `textContent` for browser nodes, JSON serialization for APIs.
Never use triple mustaches, `SafeString`, `innerHTML`, inline handlers or inline
JSON to insert a translated message. Interpolated values cannot override i18next
language/options and are never recursively interpreted as translation syntax.
Named placeholders must have identical names and multiplicity in all catalogs.

Use i18next plural suffixes (`_one`, `_other`, `_many`) with a numeric `count`.
French and Spanish can select `_many` for millions. Counts returned as strings by
SQL drivers are normalized; an explicitly missing count renders as zero so an
error partial still renders. Use `number()` for display quantities, `date()` for
localized dates, and `utcDate`/an explicit UTC option for UTC-labelled displays.
HTML `datetime`, numeric inputs, datetime-local inputs and other machine fields
remain unformatted. Catalogs can supply a separately formatted number placeholder
when grouping is needed.

Request-dependent messages must be translated inside the request, not when a
module is imported. Express-validator messages use callbacks for this reason.
Mail rendering captures a fixed translator before asynchronous delivery; callers
outside a request can use `i18n.run(locale, callback)` or pass a fixed translator
to `server/mail/render.js`. It does not infer a recipient's language from email.

## Compatibility Boundaries

- IDs, role/scope values, API field names, status codes, event types, URL identity,
  DNS proofs, token values and cryptographic inputs are not translated.
- `lifecycle_status` keeps its historical English API value; `lifecycle_label` is
  the display value. Health target names used in hashes remain unchanged;
  `display_name` and action text are translated on read.
- Relative expiry editor values keep the original `ms` grammar and signed input
  snapshot. Only the read-only expiry label is localized. Input examples such as
  `2 days` are syntax examples, not localized duration parsers.
- User-entered names, destinations, descriptions and operator-customized OIDC
  button text remain user content. Browser-native date pickers/validation chrome
  follow the browser/OS locale, not application catalogs.
- The signed Apple Shortcut remains byte-for-byte unchanged, including its
  embedded English prompts. Translating that artifact requires a separate
  credential-free signing/native acceptance cycle; do not edit signed bytes.

## Custom Templates

`custom/views` still precedes bundled views. Bundled partials now finish loading
before custom partials, and the server waits for both before listening, making
override precedence deterministic. Custom content is never rewritten.

Custom templates can use the same helpers and `locale`, `languages` and
`locale_return` locals. The `localizedLabel` name intentionally does not shadow
ordinary `label` fields. A custom layout must add these **external** scripts,
in order, before page-specific and bundled UI scripts:

```hbs
<script nonce="{{cspNonce}}" src="/locales/i18next.js"></script>
<script nonce="{{cspNonce}}" src="/scripts/i18n-core.js"></script>
<script nonce="{{cspNonce}}" src="/locales/{{locale}}.js"></script>
```

Also use `<html lang="{{locale}}">`, the bundled header selector (or its native
form equivalent), `/css/i18n.css`, and optionally
`/locales/{{locale}}.webmanifest`. Existing customized layouts do not automatically
gain these assets; review them during integration. Custom CSS remains later in
the stylesheet order. Only bundled, validated catalogs are served, as external
JavaScript with HTML-sensitive characters escaped; no raw catalog JSON is
injected into HTML. Locale-specific manifests retain the existing install identity.
Keep the nonce helper when [CSP](CSP.md) is enabled; trusted self-hosted scripts
still require the current document nonce. Do not copy a nonce between requests.

The bundled layout also retains C14's early theme script before styles and loads
`theme.css` after `i18n.css`, before custom styles. The footer's `theme_picker`
partial uses `theme.appearance`, `theme.system`, `theme.light` and `theme.dark`.
The `system`/`light`/`dark` radio values, root attributes and `kutt.theme` storage
values remain literal. See [Appearance](THEMES.md) for custom-layout theme setup.

## Adding A Language

1. Register its native name and a valid locale code in `locales/languages.json`.
2. Copy the English catalog and translate every value, retaining stable keys and
   placeholders. Keep diagnostic codes and examples of API syntax literal.
3. Include all plural categories needed by the new locale; add corresponding
   keys to every catalog to preserve exact parity. Verify `Intl` support in the
   supported Node and browser runtimes.
4. Translate the downloadable Shortcut guide when adding a supported language.
5. Run the unit/HTTP/browser gates below, including long text, quotes, accents,
   errors, native forms, HTMX fragments, mail, and hostile interpolated values.

## Verification

Use disposable instances only, never a deployed database or a real `.env`.

```sh
docker build -t kutt-i18n-test:c11 .
docker run --rm --network none --read-only --tmpfs /tmp \
  kutt-i18n-test:c11 node tests/i18n.cjs
docker run --rm --network none --read-only --tmpfs /tmp \
  -e KUTT_TEST_ONLY=i18n kutt-i18n-test:c11 node tests/container-smoke.cjs
docker run --rm --network none --read-only --tmpfs /tmp \
  kutt-i18n-test:c11 node tests/container-smoke.cjs
```

`tests/browser-i18n.cjs` requires a **fresh loopback-only** app, Playwright Chromium,
`KUTT_BROWSER_DISPOSABLE=1`, `KUTT_TEST_URL=http://127.0.0.1:<port>` and an external
`KUTT_EVIDENCE_DIR`. Set `PLAYWRIGHT_MODULE` if Playwright is not on Node's module
path. It refuses initialized instances, uses synthetic credentials and writes
screenshots outside the repository. It covers three languages at 1440, 390 and
320 pixels, native selector submissions, login validation, populated management
pages, hostile content, HTMX edits, machine expiry values and plural bulk notices.
It also checks translated theme labels and unchanged machine values, and verifies
that a dark preference survives native language-form submissions on login,
settings and library pages without changing the strict Origin guard.

Unit/HTTP tests cover key/placeholder parity, fail-closed loading, template
compilation, escaping, custom precedence, 90 concurrent locale contexts,
Node/browser formatter parity, plural categories, mail rendering, concurrent
localized requests, cookie negotiation, null/foreign-origin rejection,
open-redirect rejection, allowlisted assets and locale-independent edit signatures.
SMTP delivery, physical mobile devices, native Safari/Firefox and production
custom layouts remain separate acceptance surfaces. Use
`sh tests/browser-i18n.sh IMAGE` to start and remove a guarded disposable container automatically, with
`NODE_BINARY` and `PLAYWRIGHT_MODULE` overrides when needed.

## Reviewed Copy And Feature Boundaries

Reviewed copy uses formal Spanish management prompts, names the affected entry
in moderation errors, and states the geography denominator naturally in French
and Spanish: all recorded visits in the active report, including unmapped visits.
`tests/i18n.cjs` pins this wording and nonrecursive escaped interpolation.
`tests/i18n-community.cjs` checks all three locales under both API prefixes and
native HTML error pages. Catalog-only changes also trigger the Docker smoke CI.

Only display text is localized. Moderation API/audit `entity` and `action` values,
IDs, timestamps, sorting parameters, alias bytes and theme preference values stay
literal. Translation does not relax independent bans, credential revocation,
last-admin safeguards, transactional ownership checks or signed edit revisions.
The analytics export-contrast correction uses existing theme classes; it does
not alter catalogs, interpolation, filters or API formats.

## Localized Browser Fixtures

`tests/browser-i18n.cjs` covers 22 routes at three widths in three languages
(198 layouts). Feature suites accept `KUTT_TEST_LOCALE=en|fr|es`, defaulting to
English. For a disposable image built according to the test guide:

```sh
KUTT_TEST_LOCALE=fr sh tests/browser-moderation.sh kutt-test
KUTT_TEST_LOCALE=es sh tests/browser-list-sorting.sh kutt-test
KUTT_TEST_LOCALE=fr sh tests/browser-dotted-aliases.sh kutt-test
KUTT_TEST_LOCALE=fr sh tests/browser-theme.sh kutt-test
KUTT_TEST_LOCALE=es KUTT_TEST_CSP_MODE=enforce sh tests/browser-geography.sh kutt-test
```

Set `NODE_BINARY` / `PLAYWRIGHT_MODULE` when needed, `KUTT_BROWSER_PORT` to a free
loopback port and `KUTT_EVIDENCE_DIR` outside the repository. Each wrapper creates
and removes its own fresh container and refuses initialized application data.
The theme suite checks 90 layouts per locale, plus System/media/keyboard,
cross-tab behavior, storage denial, contrast, chart pixels and QR printing styles.
The geography suite checks six light/dark/width layouts per locale, percentage
text wrapping, export contrast and actual keyboard CSV/JSON downloads.

These are reproducible source/fixture checks, not an operator deployment ledger.
Signed Apple Shortcut prompts remain English; custom content and browser/OS
chrome are outside catalog rewriting. SMTP delivery, physical devices,
Safari/Firefox, live TLS/IdP/WAF behavior and custom layouts require their own
acceptance. See [tests](../tests/README.md) and the
[community source guide](COMMUNITY-FEATURE-ROADMAP.md).
