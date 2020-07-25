const env = require("./production-server/env").default;

module.exports = {
  publicRuntimeConfig: {
    CONTACT_EMAIL: env.CONTACT_EMAIL,
    SITE_NAME: env.SITE_NAME,
    DEFAULT_DOMAIN: env.DEFAULT_DOMAIN,
    RECAPTCHA_SITE_KEY: env.RECAPTCHA_SITE_KEY,
    GOOGLE_ANALYTICS: env.GOOGLE_ANALYTICS,
    REPORT_EMAIL: env.REPORT_EMAIL
  }
};
