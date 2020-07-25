const { parsed: localEnv } = require("dotenv").config();

module.exports = {
  publicRuntimeConfig: {
    CONTACT_EMAIL: localEnv.CONTACT_EMAIL,
    SITE_NAME: localEnv.SITE_NAME,
    DEFAULT_DOMAIN: localEnv.DEFAULT_DOMAIN,
    RECAPTCHA_SITE_KEY: localEnv.RECAPTCHA_SITE_KEY,
    GOOGLE_ANALYTICS: localEnv.GOOGLE_ANALYTICS,
    REPORT_EMAIL: localEnv.REPORT_EMAIL
  }
};
