#!/bin/bash


echo "Configuring client"

cat <<EOF > client/config.js
module.exports = {
  /*
    Invisible reCaptcha site key
    Create one in https://www.google.com/recaptcha/intro/
  */
  RECAPTCHA_SITE_KEY: "${RECAPTCHA_SITE_KEY}",

  // Google analytics tracking ID
  GOOGLE_ANALYTICS_ID: "${GOOGLE_ANALYTICS}",

  // Contact email address
  CONTACT_EMAIL: "${CONTACT_EMAIL}",

  // Report email address
  REPORT_EMAIL: "${MAIL_REPORT}",
};
EOF

cat <<EOF > server/config.js
module.exports = {
  PORT: process.env.KUTT_PORT,

  /* The domain that this website is on */
  DEFAULT_DOMAIN: process.env.KUTT_DOMAIN,

  /* Neo4j database credential details */
  DB_URI: 'bolt://' + process.env.NEO4J_HOST,
  DB_USERNAME: process.env.NEO4J_USER,
  DB_PASSWORD: process.env.NEO4J_PASS,

  /* Redis host and port */
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASS,

  /* The daily limit for each user */
  USER_LIMIT_PER_DAY: parseInt(process.env.USER_LIMIT_PER_DAY || 50, 10),

  /* A passphrase to encrypt JWT. Use a long and secure key. */
  JWT_SECRET: process.env.JWT_SECRET,

  /*
    Admin emails so they can access admin actions on settings page
    Array of strings
  */
  ADMIN_EMAILS: JSON.parse(process.env.ADMIN_EMAILS || '[]'),

  /*
    Invisible reCaptcha secret key
    Create one in https://www.google.com/recaptcha/intro/
  */
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY,

  /*
    Google Cloud API to prevent from users from submitting malware URLs.
    Get it from https://developers.google.com/safe-browsing/v4/get-started
  */
  GOOGLE_SAFE_BROWSING_KEY: process.env.GOOGLE_SAFE_BROWSING_KEY,

  /*
    Google Analytics tracking ID for universal analytics.
    Example: UA-XXXX-XX
  */
  GOOGLE_ANALYTICS: process.env.GOOGLE_ANALYTICS,

  /*
    Your email host details to use to send verification emails.
    More info on http://nodemailer.com/
  */
  MAIL_HOST: process.env.MAIL_HOST,
  MAIL_PORT: process.env.MAIL_PORT,
  MAIL_SECURE: process.env.MAIL_SECURE == 'true',
  MAIL_USER: process.env.MAIL_USER,
  MAIL_FROM: process.env.MAIL_FROM, // Example: "Kutt <support@kutt.it>". Leave empty to use MAIL_USER
  MAIL_PASSWORD: process.env.MAIL_PASS,

  /*
    The email address that will receive submitted reports.
  */
  REPORT_MAIL: process.env.MAIL_REPORT,
};
EOF

echo "Building Client"
./node_modules/.bin/next build ./client

echo "Starting"
npm start
