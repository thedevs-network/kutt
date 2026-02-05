#!/bin/sh
set -e

if [ -n "$TZ" ] && [ ! -f /etc/localtime ]; then
  ln -s "/usr/share/zoneinfo/$TZ" /etc/localtime
  echo "$TZ" > /etc/timezone
fi

exec "$@"
