#!/bin/sh
set -eu
image=${1:?candidate image required}
node=${NODE_BINARY:-node}
port=${KUTT_BROWSER_PORT:-31166}
case "$port" in ''|*[!0-9]*) exit 2;; esac
[ "$port" -ge 1024 ] && [ "$port" -le 65535 ]
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
evidence=${KUTT_EVIDENCE_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/kutt-domain-grants-browser.XXXXXX")}
cid=
cleanup() { code=$?; if [ -n "$cid" ]; then if [ "$code" -ne 0 ]; then docker logs --tail 35 "$cid" >&2; fi; docker rm -f "$cid" >/dev/null; fi; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cid=$(docker run -d --read-only --cap-drop ALL --security-opt no-new-privileges:true --tmpfs /tmp:mode=1777 \
  -p "127.0.0.1:$port:3000" -e PORT=3000 -e "DEFAULT_DOMAIN=127.0.0.1:$port" -e "MANAGEMENT_ORIGIN=http://localhost:$port" \
  -e NODE_ENV=development -e CSP_MODE=enforce -e KUTT_BROWSER_DISPOSABLE=1 -e NODE_OPTIONS=--require=/kutt/tests/domain-proof-offline.cjs \
  -e DB_CLIENT=better-sqlite3 -e DB_FILENAME=/tmp/kutt-smoke-domain-grants.sqlite -e REDIS_ENABLED=false \
  -e MAIL_ENABLED=false -e OIDC_ENABLED=false -e DISALLOW_ANONYMOUS_LINKS=true -e DISALLOW_REGISTRATION=true \
  -e DISALLOW_LOGIN_FORM=false -e ENABLE_RATE_LIMIT=false -e TRUST_PROXY=false -e NODE_APP_INSTANCE=1 \
  --entrypoint sh "$image" -c 'export JWT_SECRET=$(node -e "console.log(require(\"crypto\").randomBytes(48).toString(\"hex\"))"); node node_modules/knex/bin/cli.js migrate:latest && exec node server/server.js')
attempt=0
until curl -fsS "http://127.0.0.1:$port/api/health" >/dev/null 2>&1; do
  attempt=$((attempt+1)); [ "$attempt" -lt 60 ] || exit 1; sleep 1
done
KUTT_BROWSER_DISPOSABLE=1 KUTT_BROWSER_CONTAINER="$cid" KUTT_TEST_URL="http://localhost:$port" KUTT_EVIDENCE_DIR="$evidence" \
  "$node" "$root/tests/browser-domain-grants.cjs"
printf 'Browser evidence: %s\n' "$evidence"
