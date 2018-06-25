module.exports = {
  PORT: 3000,

  /* The domain that this website is on */
  DEFAULT_DOMAIN: 'localhost:3000',

  /* Neo4j database credential details */
  DB_URI: 'bolt://neo4j:7687',
  DB_USERNAME: '',
  DB_PASSWORD: '',

  /* A passphrase to encrypt JWT. Use a long and secure key. */
  JWT_SECRET: 'securekey',

  /*
    Invisible reCaptcha secret key
    Create one in https://www.google.com/recaptcha/intro/
  */
  RECAPTCHA_SECRET_KEY: '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe',

  /* 
    Google Cloud API to prevent from users from submitting malware URLs.
    Get it from https://developers.google.com/safe-browsing/v4/get-started
  */
  GOOGLE_SAFE_BROWSING_KEY: 'AIzaSyAn1xYOSr1xfe3gfKjYupp2dNouwU7oL5Y',

  /*
    Your email host details to use to send verification emails.
    More info on http://nodemailer.com/
  */
  MAIL_HOST: 'smtp.ethereal.email',
  MAIL_PORT: 587,
  MAIL_SECURE: false,
  MAIL_USER: 'likyqc3fcjtgdnfd@ethereal.email',
  MAIL_PASSWORD: 'fjmhsR8zJQZ3BKQath',
};
