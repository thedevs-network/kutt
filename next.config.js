const { parsed: localEnv } = require("dotenv").config();

module.exports = {
  publicRuntimeConfig: {
    CONTACT_EMAIL: localEnv && localEnv.CONTACT_EMAIL,
    SITE_NAME: localEnv && localEnv.SITE_NAME,
    DEFAULT_DOMAIN: localEnv && localEnv.DEFAULT_DOMAIN,
    RECAPTCHA_SITE_KEY: localEnv && localEnv.RECAPTCHA_SITE_KEY,
    GOOGLE_ANALYTICS: localEnv && localEnv.GOOGLE_ANALYTICS,
    REPORT_EMAIL: localEnv && localEnv.REPORT_EMAIL
  }
};
