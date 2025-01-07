require("dotenv").config();
const { cleanEnv, num, str, bool } = require("envalid");

const supportedDBClients = [
  "pg",
  "pg-native",
  "sqlite3",
  "better-sqlite3",
  "mysql",
  "mysql2"
];

const env = cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  SITE_NAME: str({ example: "Kutt", default: "Kutt" }),
  DEFAULT_DOMAIN: str({ example: "kutt.it", default: "localhost:3000" }),
  LINK_LENGTH: num({ default: 6 }),
  DB_CLIENT: str({ choices: supportedDBClients, default: "sqlite3" }),
  DB_FILENAME: str({ default: "data" }),
  DB_HOST: str({ default: "localhost" }),
  DB_PORT: num({ default: 5432 }),
  DB_NAME: str({ default: "kutt" }),
  DB_USER: str({ default: "postgres" }),
  DB_PASSWORD: str({ default: "" }),
  DB_SSL: bool({ default: false }),
  DB_POOL_MIN: num({ default: 0 }),
  DB_POOL_MAX: num({ default: 10 }),
  REDIS_ENABLED: bool({ default: false }),
  REDIS_HOST: str({ default: "127.0.0.1" }),
  REDIS_PORT: num({ default: 6379 }),
  REDIS_PASSWORD: str({ default: "" }),
  REDIS_DB: num({ default: 0 }),
  DISALLOW_ANONYMOUS_LINKS: bool({ default: true }),
  DISALLOW_REGISTRATION: bool({ default: true }),
  SERVER_IP_ADDRESS: str({ default: "" }),
  SERVER_CNAME_ADDRESS: str({ default: "" }),
  CUSTOM_DOMAIN_USE_HTTPS: bool({ default: false }),
  JWT_SECRET: str({ devDefault: "securekey" }),
  MAIL_ENABLED: bool({ default: false }),
  MAIL_HOST: str({ default: "" }),
  MAIL_PORT: num({ default: 587 }),
  MAIL_SECURE: bool({ default: false }),
  MAIL_USER: str({ default: "" }),
  MAIL_FROM: str({ default: "", example: "Kutt <support@kutt.it>" }),
  MAIL_PASSWORD: str({ default: "" }),
  ENABLE_RATE_LIMIT: bool({ default: false }),
  REPORT_EMAIL: str({ default: "" }),
  CONTACT_EMAIL: str({ default: "" }),
  NODE_APP_INSTANCE: num({ default: 0 }),
});

module.exports = env;
