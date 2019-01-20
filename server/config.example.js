module.exports = {
  PORT: 3000,

  /* The domain that this website is on */
  DEFAULT_DOMAIN: 'kutt.it',

  /* Neo4j database credential details */
  DB_URI: 'bolt://localhost',
  DB_USERNAME: '',
  DB_PASSWORD: '',

  /* Redis host and port */
  REDIS_HOST: '127.0.0.1',
  REDIS_PORT: 6379,

  /* The daily limit for each user */
  USER_LIMIT_PER_DAY: 50,

  /* A passphrase to encrypt JWT. Use a long and secure key. */
  JWT_SECRET: 'securekey',

  /*
    Admin emails so they can access admin actions on settings page
    Array of strings
  */
  ADMIN_EMAILS: [],

  /*
    Invisible reCaptcha secret key
    Create one in https://www.google.com/recaptcha/intro/
  */
  RECAPTCHA_SECRET_KEY: '',

  /* 
    Google Cloud API to prevent from users from submitting malware URLs.
    Get it from https://developers.google.com/safe-browsing/v4/get-started
  */
  GOOGLE_SAFE_BROWSING_KEY: '',

  /* 
    Google Analytics tracking ID for universal analytics.
    Example: UA-XXXX-XX
  */
  GOOGLE_ANALYTICS: '',

  /*
    Your email host details to use to send verification emails.
    More info on http://nodemailer.com/
  */
  MAIL_HOST: '',
  MAIL_PORT: 587,
  MAIL_SECURE: false,
  MAIL_USER: '',
  MAIL_FROM: '', // Example: "Kutt <support@kutt.it>". Leave empty to use MAIL_USER
  MAIL_PASSWORD: '',

  /*
    The email address that will receive submitted reports.
  */
  REPORT_MAIL: '',
};
