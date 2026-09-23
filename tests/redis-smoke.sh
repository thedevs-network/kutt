#!/bin/sh
set -eu
image=${1:?candidate image required}
name="kutt-redis-test-$$"
private_dir=$(mktemp -d)
cidfile="$private_dir/container.id"
cleanup() {
  if [ -s "$cidfile" ]; then
    id=$(cat "$cidfile")
    case "$id" in *[!a-f0-9]*|'') ;; *) [ "${#id}" -eq 64 ] && docker rm -f "$id" >/dev/null 2>&1 || true ;; esac
  fi
  rm -rf "$private_dir"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
docker run -d --cidfile "$cidfile" --name "$name" --network none --read-only --tmpfs /data --cap-drop ALL \
  --user 999:999 --security-opt no-new-privileges:true redis:8-alpine \
  redis-server --save '' --appendonly no --bind 127.0.0.1 >/dev/null
id=$(cat "$cidfile")
attempt=0
until docker exec "$id" redis-cli ping | grep -q PONG; do
  attempt=$((attempt + 1))
  [ "$attempt" -lt 30 ] || exit 1
  sleep 1
done
docker run --rm --init --network "container:$id" --read-only --tmpfs /tmp:mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges:true -e KUTT_REDIS_TEST=isolated \
  --entrypoint node "$image" tests/redis-smoke.cjs
