const { parsed: localEnv } = require("dotenv").config();

module.exports = {
  publicRuntimeConfig: {
    CONTACT_EMAIL: "pedro.silva@pinely.eu",
    SITE_NAME: "Kutt",
    DEFAULT_DOMAIN: "localhost.com",
    RECAPTCHA_SITE_KEY: null,
    REPORT_EMAIL: "pedro.silva@pinely.eu",
    DISALLOW_ANONYMOUS_LINKS: false,
    DISALLOW_REGISTRATION: false
  }
};