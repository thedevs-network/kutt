const { parsed: localEnv } = require("dotenv").config();

module.exports = {
  publicRuntimeConfig: {
    CONTACT_EMAIL: localEnv && localEnv.CONTACT_EMAIL,
    SITE_NAME: localEnv && localEnv.SITE_NAME,
    DEFAULT_DOMAIN: localEnv && localEnv.DEFAULT_DOMAIN,
    RECAPTCHA_SITE_KEY: localEnv && localEnv.RECAPTCHA_SITE_KEY,
    GOOGLE_ANALYTICS: localEnv && localEnv.GOOGLE_ANALYTICS,
    REPORT_EMAIL: localEnv && localEnv.REPORT_EMAIL,
    DISALLOW_ANONYMOUS_LINKS: localEnv && localEnv.DISALLOW_ANONYMOUS_LINKS,
    DISALLOW_REGISTRATION: localEnv && localEnv.DISALLOW_REGISTRATION,
    SENTRY_PUBLIC_DSN: localEnv && localEnv.SENTRY_PUBLIC_DSN,
  }
};
