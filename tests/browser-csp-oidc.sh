#!/bin/sh
set -eu
image=${1:?usage: browser-csp-oidc.sh IMAGE}
node=${NODE_BINARY:-node}
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
evidence=${KUTT_EVIDENCE_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/kutt-csp-oidc.XXXXXX")}
port=$("$node" -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')
provider_port=$("$node" -e 'const s=require("node:net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')
[ "$port" != "$provider_port" ]
origin="http://127.0.0.1:$port"
provider="http://127.0.0.1:$provider_port"
cid=
cleanup() { if [ -n "$cid" ]; then docker rm -f "$cid" >/dev/null; fi; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
cid=$(docker run -d --read-only --cap-drop ALL --security-opt no-new-privileges:true --tmpfs /tmp:mode=1777 \
  -p "127.0.0.1:$port:3000" -p "127.0.0.1:$provider_port:$provider_port" \
  -e PORT=3000 -e NODE_ENV=development -e "DEFAULT_DOMAIN=127.0.0.1:$port" -e KUTT_BROWSER_DISPOSABLE=1 \
  -e "KUTT_TEST_URL=$origin" -e "KUTT_TEST_PROVIDER_URL=$provider" \
  -e DB_CLIENT=better-sqlite3 -e DB_FILENAME=/tmp/kutt-smoke-csp-oidc.sqlite -e REDIS_ENABLED=false \
  -e MAIL_ENABLED=false -e OIDC_ENABLED=true -e "OIDC_ISSUER=$provider" \
  -e OIDC_CLIENT_ID=csp-fixture -e OIDC_CLIENT_SECRET=csp-synthetic-only -e 'OIDC_BUTTON_TEXT=Sign in with Test Provider' \
  -e DISALLOW_ANONYMOUS_LINKS=true -e DISALLOW_REGISTRATION=true -e DISALLOW_LOGIN_FORM=true \
  -e ENABLE_RATE_LIMIT=false -e TRUST_PROXY=false -e NODE_APP_INSTANCE=1 -e CSP_MODE=enforce \
  --entrypoint sh "$image" -c 'export JWT_SECRET=$(node -e "console.log(require(\"crypto\").randomBytes(48).toString(\"hex\"))"); node node_modules/knex/bin/cli.js migrate:latest && { node tests/fixtures/oidc-error-provider.cjs & exec node server/server.js; }')
printf 'Browser evidence: %s\n' "$evidence"
KUTT_BROWSER_DISPOSABLE=1 KUTT_TEST_URL="$origin" KUTT_TEST_PROVIDER_URL="$provider" KUTT_EVIDENCE_DIR="$evidence" \
  "$node" "$root/tests/browser-oidc-validation.cjs"
