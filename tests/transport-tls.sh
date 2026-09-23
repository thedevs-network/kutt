#!/bin/sh
set -eu
image=${1:?candidate image required}
engine=${2:?mysql2 pg or redis required}
case "$engine" in mysql2|pg|redis) ;; *) exit 2;; esac
private=$(mktemp -d)
cleanup() {
  for cidfile in "$private"/*.id; do
    [ -s "$cidfile" ] || continue
    id=$(cat "$cidfile")
    case "$id" in *[!a-f0-9]*|'') ;; *) [ "${#id}" -eq 64 ] && docker rm -f "$id" >/dev/null 2>&1 || true ;; esac
  done
  rm -rf "$private"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
sh tests/tls-fixtures.sh "$private/certs"
wait_script='while [ ! -e /tmp/tls/ready ]; do sleep 0.1; done; exec /usr/local/bin/docker-entrypoint.sh "$@"'
for variant in server wrong expired plain; do
  # Only public test certificates and ephemeral client keys are copied. Nothing
  # from an application data directory or operator configuration is mounted.
  mkdir "$private/current"
  cp "$private/certs/ca.crt" "$private/certs/unknown-ca.crt" "$private/certs/client.crt" "$private/certs/client.key" "$private/current/"
  name=$variant
  [ "$variant" != plain ] || name=server
  cp "$private/certs/$name.crt" "$private/current/server.crt"
  cp "$private/certs/$name.key" "$private/current/server.key"
  cidfile="$private/server-$variant.id"
  if [ "$engine" = mysql2 ]; then
    if [ "$variant" = plain ]; then set -- --tls-version=; else
      set -- --ssl-ca=/tmp/tls/ca.crt --ssl-cert=/tmp/tls/server.crt --ssl-key=/tmp/tls/server.key --require-secure-transport=ON
    fi
    docker run -d --cidfile "$cidfile" --network none --read-only --cap-drop ALL --user mysql \
      --security-opt no-new-privileges:true --tmpfs /tmp:mode=1777 --tmpfs /var/lib/mysql:mode=1777 --tmpfs /var/run/mysqld:mode=1777 \
      -e MYSQL_ROOT_PASSWORD=disposable-tls-only -e MYSQL_DATABASE=kutt_tls_regression -e MYSQL_USER=kutt -e MYSQL_PASSWORD=disposable-tls-only \
      --entrypoint sh mysql:8.4@sha256:85b9bf2e29cf836ecb8c2a15a935d4ba0c606631dff1dd79531a11983c638f2a \
      -c "$wait_script" fixture mysqld --datadir=/var/lib/mysql/fixture "$@" >/dev/null
  elif [ "$engine" = pg ]; then
    if [ "$variant" = plain ]; then set --; else
      printf '%s\n' 'local all all trust' 'hostssl all all 127.0.0.1/32 scram-sha-256 clientcert=verify-full' 'hostssl all all ::1/128 scram-sha-256 clientcert=verify-full' > "$private/current/pg_hba.conf"
      set -- -c ssl=on -c ssl_cert_file=/tmp/tls/server.crt -c ssl_key_file=/tmp/tls/server.key -c ssl_ca_file=/tmp/tls/ca.crt -c hba_file=/tmp/tls/pg_hba.conf
    fi
    docker run -d --cidfile "$cidfile" --network none --read-only --cap-drop ALL --user postgres \
      --security-opt no-new-privileges:true --tmpfs /tmp:mode=1777 --tmpfs /var/lib/postgresql/data:mode=1777 --tmpfs /var/run/postgresql:mode=1777 \
      -e POSTGRES_DB=kutt_tls_regression -e POSTGRES_USER=kutt -e POSTGRES_PASSWORD=disposable-tls-only -e PGDATA=/var/lib/postgresql/data/fixture \
      --entrypoint sh postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24 \
      -c "$wait_script" fixture postgres "$@" >/dev/null
  else
    if [ "$variant" = plain ]; then set -- --port 6379; else
      set -- --port 0 --tls-port 6379 --tls-cert-file /tmp/tls/server.crt --tls-key-file /tmp/tls/server.key --tls-ca-cert-file /tmp/tls/ca.crt --tls-auth-clients yes
    fi
    docker run -d --cidfile "$cidfile" --network none --read-only --cap-drop ALL --user 999:999 \
      --security-opt no-new-privileges:true --tmpfs /tmp:mode=1777 --tmpfs /data \
      --entrypoint sh redis:8-alpine@sha256:ba6e394f6acc2a695ef1b6944f161b9ca813711739be68319fa0db3470673f1d -c "$wait_script" fixture redis-server --bind 127.0.0.1 --save '' --appendonly no "$@" >/dev/null
  fi
  id=$(cat "$cidfile")
  docker exec "$id" mkdir -m 700 /tmp/tls
  COPYFILE_DISABLE=1 tar --format=ustar -C "$private/current" -cf - . | docker exec -i "$id" tar -xf - -C /tmp/tls
  docker exec "$id" touch /tmp/tls/ready
  attempt=0
  while :; do
    if [ "$engine" = mysql2 ]; then
      if docker exec -e MYSQL_PWD=disposable-tls-only "$id" mysql --get-server-public-key -h 127.0.0.1 -u kutt -e 'SELECT 1' kutt_tls_regression >/dev/null 2>&1; then break; fi
    elif [ "$engine" = pg ]; then
      if docker exec "$id" pg_isready -h 127.0.0.1 -U kutt -d kutt_tls_regression >/dev/null 2>&1; then break; fi
    else
      # TCP readiness only here; the client test must independently verify TLS.
      if docker logs "$id" 2>&1 | grep -q 'Ready to accept connections'; then break; fi
    fi
    attempt=$((attempt + 1))
    [ "$attempt" -lt 90 ] || { docker logs --tail 25 "$id"; exit 1; }
    [ "$(docker inspect "$id" --format '{{.State.Running}}')" = true ] || { docker logs --tail 25 "$id"; exit 1; }
    sleep 1
  done
  if [ "$engine" = mysql2 ] && [ "$variant" != plain ]; then
    docker exec -e MYSQL_PWD=disposable-tls-only "$id" mysql -u root -e "ALTER USER 'kutt'@'%' REQUIRE X509"
  fi
  appfile="$private/app-$variant.id"
  docker run -d --cidfile "$appfile" --init --network "container:$id" --read-only --tmpfs /tmp:mode=1777 \
    --cap-drop ALL --security-opt no-new-privileges:true -e KUTT_TLS_TEST=isolated --entrypoint sh "$image" \
    -c 'while [ ! -e /tmp/tls/ready ]; do sleep 0.1; done; exec node tests/transport-tls.cjs "$@"' fixture "$engine" "$variant" >/dev/null
  app=$(cat "$appfile")
  docker exec "$app" mkdir -m 700 /tmp/tls
  COPYFILE_DISABLE=1 tar --format=ustar -C "$private/certs" -cf - ca.crt unknown-ca.crt client.crt client.key server.key | docker exec -i "$app" tar -xf - -C /tmp/tls
  docker exec "$app" touch /tmp/tls/ready
  code=$(docker wait "$app")
  docker logs "$app"
  [ "$code" = 0 ] || exit 1
  docker rm -f "$app" "$id" >/dev/null
  rm -rf "$private/current"
done
