require("dotenv").config();
const { cleanEnv, num, str, bool, makeValidator } = require("envalid");
const proxyTrust = makeValidator(require("./proxy-trust"));
const strictBoolean = makeValidator(value => {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error("Expected true or false");
});

const supportedDBClients = [
  "pg",
  "pg-native",
  "sqlite3",
  "better-sqlite3",
  "mysql",
  "mysql2"
];

// make sure custom alphabet is not empty
if (process.env.LINK_CUSTOM_ALPHABET === "") {
  delete process.env.LINK_CUSTOM_ALPHABET;
}

// make sure jwt secret is not empty
if (process.env.JWT_SECRET === "") {
  delete process.env.JWT_SECRET;
}

// if is started with the --production argument, then set NODE_ENV to production
if (process.argv.includes("--production")) {
  process.env.NODE_ENV = "production";
}

const spec = {
  PORT: num({ default: 3000 }),
  SITE_NAME: str({ example: "Kutt", default: "Kutt" }),
  DEFAULT_DOMAIN: str({ example: "kutt.to", default: "localhost:3000" }),
  MANAGEMENT_ORIGIN: str({ default: "" }),
  LINK_LENGTH: num({ default: 6 }),
  LINK_CUSTOM_ALPHABET: str({ default: "abcdefghkmnpqrstuvwxyzABCDEFGHKLMNPQRSTUVWXYZ23456789" }),
  TRUST_PROXY: proxyTrust({ default: true }),
  CSP_MODE: str({ choices: ["off", "report-only", "enforce"], default: "off" }),
  DB_CLIENT: str({ choices: supportedDBClients, default: "better-sqlite3" }),
  DB_FILENAME: str({ default: "db/data" }),
  DB_HOST: str({ default: "localhost" }),
  DB_PORT: num({ default: 5432 }),
  DB_NAME: str({ default: "kutt" }),
  DB_USER: str({ default: "postgres" }),
  DB_PASSWORD: str({ default: "" }),
  DB_SSL: bool({ default: false }),
  DB_SSL_CA: str({ default: "" }),
  DB_SSL_CERT: str({ default: "" }),
  DB_SSL_KEY: str({ default: "" }),
  DB_POOL_MIN: num({ default: 0 }),
  DB_POOL_MAX: num({ default: 10 }),
  REDIS_ENABLED: bool({ default: false }),
  REDIS_HOST: str({ default: "127.0.0.1" }),
  REDIS_PORT: num({ default: 6379 }),
  REDIS_PASSWORD: str({ default: "" }),
  REDIS_DB: num({ default: 0 }),
  REDIS_SSL: bool({ default: false }),
  REDIS_SSL_CA: str({ default: "" }),
  REDIS_SSL_CERT: str({ default: "" }),
  REDIS_SSL_KEY: str({ default: "" }),
  DISALLOW_ANONYMOUS_LINKS: bool({ default: true }),
  DISALLOW_REGISTRATION: bool({ default: true }),
  DISALLOW_LOGIN_FORM: bool({ default: false }),
  SERVER_IP_ADDRESS: str({ default: "" }),
  SERVER_CNAME_ADDRESS: str({ default: "" }),
  CUSTOM_DOMAIN_USE_HTTPS: bool({ default: false }),
  JWT_SECRET: str({ devDefault: "securekey" }),
  MAIL_ENABLED: bool({ default: false }),
  MAIL_HOST: str({ default: "" }),
  MAIL_PORT: num({ default: 587 }),
  MAIL_SECURE: bool({ default: false }),
  MAIL_USER: str({ default: "" }),
  MAIL_FROM: str({ default: "", example: "Kutt <support@kutt.to>" }),
  MAIL_PASSWORD: str({ default: "" }),
  OIDC_ENABLED: bool({ default: false }),
  OIDC_ISSUER: str({ default: "" }),
  OIDC_PROMPT: str({ default: "" }),
  OIDC_CLIENT_ID: str({ default: "" }),
  OIDC_CLIENT_SECRET: str({ default: "" }),
  OIDC_ID_TOKEN_SIGNING_ALG: str({ default: "RS256", choices: ["RS256", "PS256", "ES256", "EdDSA"] }),
  OIDC_SCOPE: str({ default: "openid profile email" }),
  OIDC_EMAIL_CLAIM: str({ default: "email" }),
  OIDC_BUTTON_TEXT: str({ default: "Log in with OIDC" }),
  OIDC_PROVIDER_NAME: str({ default: "OIDC" }),
  OIDC_ALLOW_REGISTRATION: bool({ default: true }),
  OIDC_SESSION_MAX_SECONDS: num({ default: 3600, choices: [300, 900, 1800, 3600, 14400, 86400] }),
  OIDC_ADMIN_MAPPING_ENABLED: strictBoolean({ default: false }),
  OIDC_ADMIN_CLAIM: str({ default: "" }),
  OIDC_ADMIN_VALUES: str({ default: "" }),
  OIDC_BREAK_GLASS_USER_ID: str({ default: "" }),
  OIDC_ADMIN_MAX_AGE_SECONDS: num({ default: 300, choices: [300, 900, 1800, 3600] }),
  ENABLE_RATE_LIMIT: bool({ default: false }),
  DESTINATION_ALLOWED_HOSTS: str({ default: "" }),
  REPORT_EMAIL: str({ default: "" }),
  CONTACT_EMAIL: str({ default: "" }),
  NODE_APP_INSTANCE: num({ default: 0 }),
  METRICS_ENABLED: bool({ default: false }),
  METRICS_HOST: str({ default: "127.0.0.1" }),
  METRICS_PORT: num({ default: 9101 }),
  METRICS_TOKEN: str({ default: "" }),
};

require("./env-files")(Object.keys(spec));
if (process.env.JWT_SECRET === "") delete process.env.JWT_SECRET;

const env = cleanEnv(process.env, spec);
require("./transport-tls").validate(env);
require("./destination-policy").compile(env.DESTINATION_ALLOWED_HOSTS);
require("./metrics").validate(env);
require("./management-origin").parse(env.MANAGEMENT_ORIGIN, env);
require("./oidc-role-config").parse(env);

module.exports = env;
