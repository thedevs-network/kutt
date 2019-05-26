module.exports = {
  PORT: 3000,

  /* The domain that this website is on */
  DEFAULT_DOMAIN: process.env.KUTT_DOMAIN || 'kutt.it',

  /* Neo4j database credential details */
  DB_URI: process.env.NEO4J_HOST || 'bolt://localhost',
  DB_USERNAME: process.env.NEO4J_USER || '',
  DB_PASSWORD: process.env.NEO4J_PASS || '',

  /* Redis host and port */
  REDIS_DISABLED: process.env.REDIS_DISABLED === "true" || false,
  REDIS_HOST:  process.env.REDIS_HOST || '127.0.0.1',
  REDIS_PORT: process.env.REDIS_PORT || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASS || '',

  /* The daily limit for each user */
  USER_LIMIT_PER_DAY: process.env.USER_LIMIT_PER_DAY || 50,

  /* A passphrase to encrypt JWT. Use a long and secure key. */
  JWT_SECRET: process.env.JWT_SECRET || 'securekey',

  /*
    Admin emails so they can access admin actions on settings page
    Array of strings
  */
  ADMIN_EMAILS: JSON.parse(process.env.ADMIN_EMAILS || '[]'),

  /*
    Invisible reCaptcha secret key
    Create one in https://www.google.com/recaptcha/intro/
  */
  RECAPTCHA_SECRET_KEY: process.env.RECAPTCHA_SECRET_KEY || '',

  /* 
    Google Cloud API to prevent from users from submitting malware URLs.
    Get it from https://developers.google.com/safe-browsing/v4/get-started
  */
  GOOGLE_SAFE_BROWSING_KEY: process.env.GOOGLE_SAFE_BROWSING_KEY || '',

  /* 
    Google Analytics tracking ID for universal analytics.
    Example: UA-XXXX-XX
  */
  GOOGLE_ANALYTICS: process.env.GOOGLE_ANALYTICS || '',

  /*
    Your email host details to use to send verification emails.
    More info on http://nodemailer.com/
  */
  MAIL_HOST: process.env.MAIL_HOST || '',
  MAIL_PORT: process.env.MAIL_PORT || 587,
  MAIL_SECURE: process.env.MAIL_SECURE === "true" || false,
  MAIL_USER: process.env.MAIL_USER || '',
  MAIL_FROM: process.env.MAIL_FROM ||'', // Example: "Kutt <support@kutt.it>". Leave empty to use MAIL_USER
  MAIL_PASSWORD: process.env.MAIL_PASS || '',

  /*
    The email address that will receive submitted reports.
  */
  REPORT_MAIL: process.env.MAIL_REPORT || '',
};
