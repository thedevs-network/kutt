#!/bin/bash

echo "entrypoint.sh"
# creates .env file for next.config.js
for param in \
    CONTACT_EMAIL \
    SITE_NAME \
    DEFAULT_DOMAIN \
    RECAPTCHA_SITE_KEY \
    GOOGLE_ANALYTICS \
    REPORT_EMAIL \
    DISALLOW_ANONYMOUS_LINKS \
    DISALLOW_REGISTRATION \
    SENTRY_PUBLIC_DSN \
    DISALLOW_DOMAIN \
    ; do
    if [ -n "${!param}" ] ; then
        echo "$param=\"${!param}\"" >>.env
    fi
done

echo "Running $@"
exec "$@"