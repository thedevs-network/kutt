/* eslint-disable global-require */
/* eslint-disable import/no-unresolved */
const fs = require('fs');
const path = require('path');

const hasServerConfig = fs.existsSync(path.resolve(__dirname, 'config.js'));
const hasClientConfig = fs.existsSync(path.resolve(__dirname, '../client/config.js'));

if (hasServerConfig && hasClientConfig) {
  const serverConfig = require('./config.js');
  const clientConfig = require('../client/config.js');
  let envTemplate = fs.readFileSync(path.resolve(__dirname, '../.template.env'), 'utf-8');

  const configs = {
    PORT: serverConfig.PORT || 3000,
    DEFAULT_DOMAIN: serverConfig.DEFAULT_DOMAIN || 'localhost:3000',
    DB_URI: serverConfig.DB_URI || 'bolt://localhost',
    DB_USERNAME: serverConfig.DB_USERNAME,
    DB_PASSWORD: serverConfig.DB_PASSWORD,
    REDIS_DISABLED: serverConfig.REDIS_DISABLED || false,
    REDIS_HOST: serverConfig.REDIS_HOST || '127.0.0.1',
    REDIS_PORT: serverConfig.REDIS_PORT || 6379,
    REDIS_PASSWORD: serverConfig.REDIS_PASSWORD,
    USER_LIMIT_PER_DAY: serverConfig.USER_LIMIT_PER_DAY || 50,
    JWT_SECRET: serverConfig.JWT_SECRET || 'securekey',
    ADMIN_EMAILS: serverConfig.ADMIN_EMAILS.join(','),
    RECAPTCHA_SITE_KEY: clientConfig.RECAPTCHA_SITE_KEY,
    RECAPTCHA_SECRET_KEY: serverConfig.RECAPTCHA_SECRET_KEY,
    GOOGLE_SAFE_BROWSING_KEY: serverConfig.GOOGLE_SAFE_BROWSING_KEY,
    GOOGLE_ANALYTICS: serverConfig.GOOGLE_ANALYTICS || clientConfig.GOOGLE_ANALYTICS,
    MAIL_HOST: serverConfig.MAIL_HOST,
    MAIL_PORT: serverConfig.MAIL_PORT,
    MAIL_SECURE: serverConfig.MAIL_SECURE,
    MAIL_USER: serverConfig.MAIL_USER,
    MAIL_FROM: serverConfig.MAIL_FROM,
    MAIL_PASSWORD: serverConfig.MAIL_PASSWORD,
    REPORT_MAIL: serverConfig.REPORT_MAIL,
    CONTACT_EMAIL: clientConfig.CONTACT_EMAIL,
  };

  Object.keys(configs).forEach(c => {
    envTemplate = envTemplate.replace(new RegExp(`{{${c}}}`, 'gm'), configs[c] || '');
  });

  fs.writeFileSync(path.resolve(__dirname, '../.env'), envTemplate);
  fs.renameSync(path.resolve(__dirname, 'config.js'), path.resolve(__dirname, 'old.config.js'));
  fs.renameSync(
    path.resolve(__dirname, '../client/config.js'),
    path.resolve(__dirname, '../client/old.config.js')
  );
}
