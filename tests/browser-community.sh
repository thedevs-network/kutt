#!/bin/sh
set -eu
image=${1:?usage: browser-community.sh IMAGE}
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
evidence=${KUTT_EVIDENCE_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/kutt-community-browser.XXXXXX")}
export KUTT_TEST_CSP_MODE=enforce
for suite in csp dialogs list-sorting logout-navigation validation domain-proof date-time; do
  KUTT_EVIDENCE_DIR="$evidence/csp-$suite" sh "$root/tests/browser-csp.sh" "$image" "$suite"
done
KUTT_EVIDENCE_DIR="$evidence/csp-oidc" sh "$root/tests/browser-csp-oidc.sh" "$image"
KUTT_EVIDENCE_DIR="$evidence/qr" sh "$root/tests/browser-qr-branding-locales.sh" "$image"
KUTT_EVIDENCE_DIR="$evidence/policy" sh "$root/tests/browser-destination-policy.sh" "$image"
KUTT_EVIDENCE_DIR="$evidence/policy-edit" sh "$root/tests/browser-destination-policy-edit.sh" "$image"
KUTT_EVIDENCE_DIR="$evidence/oidc-roles" sh "$root/tests/browser-oidc-roles.sh" "$image"
KUTT_EVIDENCE_DIR="$evidence/domain-grants" sh "$root/tests/browser-domain-grants.sh" "$image"
for locale in en fr es; do
  KUTT_TEST_LOCALE="$locale" KUTT_EVIDENCE_DIR="$evidence/geography-$locale" sh "$root/tests/browser-geography.sh" "$image"
done
