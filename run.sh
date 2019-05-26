echo "run: configuring client"

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

echo "run: building Client"
npm run build

echo "run: starting ..."
npm start
