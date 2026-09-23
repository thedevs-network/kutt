#!/bin/sh
set -eu
image=${1:?usage: browser-qr-branding-locales.sh IMAGE}
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
evidence=${KUTT_EVIDENCE_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/kutt-qr-locales.XXXXXX")}
for locale in en fr es; do
  for theme in light dark; do
    KUTT_TEST_LOCALE=$locale KUTT_TEST_THEME=$theme KUTT_EVIDENCE_DIR="$evidence/$locale-$theme" \
      sh "$root/tests/browser-qr-branding.sh" "$image"
  done
done
printf 'QR locale/theme evidence: %s\n' "$evidence"
