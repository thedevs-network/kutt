const { parsed: localEnv } = require("dotenv").config();

module.exports = {
  publicRuntimeConfig: {
    CONTACT_EMAIL: "your@email.com",
    SITE_NAME: "Kutt",
    DEFAULT_DOMAIN: "your-domain.com",
    RECAPTCHA_SITE_KEY: null,
    REPORT_EMAIL: "your@email.com",
    DISALLOW_ANONYMOUS_LINKS: false,
    DISALLOW_REGISTRATION: false
  }
};