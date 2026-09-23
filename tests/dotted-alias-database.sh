#!/bin/sh
set -eu
image=${1:?candidate image required}
engine=${2:?mysql2 or pg required}
case "$engine" in mysql2|pg) ;; *) exit 2;; esac
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
if [ "$engine" = mysql2 ]; then
  port=3306
  docker run -d --cidfile "$cidfile" --network none --read-only --cap-drop ALL --user mysql \
    --security-opt no-new-privileges:true --tmpfs /tmp:mode=1777 --tmpfs /var/lib/mysql:mode=1777 \
    --tmpfs /var/run/mysqld:mode=1777 -e MYSQL_ROOT_PASSWORD=disposable-dotted-only \
    -e MYSQL_DATABASE=kutt_dotted_regression -e MYSQL_USER=kutt -e MYSQL_PASSWORD=disposable-dotted-only \
    mysql:8.4@sha256:85b9bf2e29cf836ecb8c2a15a935d4ba0c606631dff1dd79531a11983c638f2a \
    --datadir=/var/lib/mysql/fixture >/dev/null
else
  port=5432
  docker run -d --cidfile "$cidfile" --network none --read-only --cap-drop ALL --user postgres \
    --security-opt no-new-privileges:true --tmpfs /tmp:mode=1777 --tmpfs /var/lib/postgresql/data:mode=1777 \
    --tmpfs /var/run/postgresql:mode=1777 -e POSTGRES_DB=kutt_dotted_regression -e POSTGRES_USER=kutt \
    -e POSTGRES_PASSWORD=disposable-dotted-only -e PGDATA=/var/lib/postgresql/data/fixture \
    postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 >/dev/null
fi
id=$(cat "$cidfile")
attempt=0
while :; do
  if [ "$engine" = mysql2 ]; then
    if docker exec "$id" mysql -h 127.0.0.1 -u kutt -pdisposable-dotted-only -e 'SELECT 1' kutt_dotted_regression >/dev/null 2>&1; then break; fi
  else
    if docker exec "$id" pg_isready -h 127.0.0.1 -U kutt -d kutt_dotted_regression >/dev/null 2>&1; then break; fi
  fi
  attempt=$((attempt + 1))
  [ "$attempt" -lt 90 ] || { docker logs --tail 20 "$id"; exit 1; }
  sleep 1
done
docker run --rm --init --network "container:$id" --read-only --tmpfs /tmp:mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges:true -e KUTT_DATABASE_DISPOSABLE=1 \
  -e "DB_CLIENT=$engine" -e DB_HOST=127.0.0.1 -e "DB_PORT=$port" -e DB_NAME=kutt_dotted_regression \
  -e DB_USER=kutt -e DB_PASSWORD=disposable-dotted-only \
  --entrypoint node "$image" tests/dotted-alias-database.cjs
