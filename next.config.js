require("dotenv").config();
const env = process.env || {};

module.exports = {
  publicRuntimeConfig: {
    CONTACT_EMAIL: env.CONTACT_EMAIL,
    SITE_NAME: env.SITE_NAME,
    DEFAULT_DOMAIN: env.DEFAULT_DOMAIN,
    RECAPTCHA_SITE_KEY: env.RECAPTCHA_SITE_KEY,
    REPORT_EMAIL: env.REPORT_EMAIL,
    DISALLOW_ANONYMOUS_LINKS: env.DISALLOW_ANONYMOUS_LINKS === "true",
    DISALLOW_REGISTRATION: env.DISALLOW_REGISTRATION === "true"
  }
};
