import { cleanEnv, num, str, bool, url, EnvMissingError } from "envalid";
import reporter from "envalid/src/reporter";

const env = cleanEnv(process.env, {
  PORT: num({ default: 3000 }),
  SITE_NAME: str({ example: "Kutt" }),
  DEFAULT_DOMAIN: str({ example: "kutt.it" }),
  LINK_LENGTH: num({ default: 6 }),
  DATABASE_URL: url(),
  DB_HOST: str({ default: "localhost" }),
  DB_PORT: num({ default: 5432 }),
  DB_NAME: str({ default: "postgres" }),
  DB_USER: str(),
  DB_PASSWORD: str(),
  DB_SSL: bool({ default: false }),
  DB_POOL_MIN: num({ default: 2 }),
  DB_POOL_MAX: num({ default: 10 }),
  NEO4J_DB_URI: str({ default: "" }),
  NEO4J_DB_USERNAME: str({ default: "" }),
  NEO4J_DB_PASSWORD: str({ default: "" }),
  REDIS_URL: url(),
  REDIS_HOST: str({ default: "127.0.0.1" }),
  REDIS_PORT: num({ default: 6379 }),
  REDIS_PASSWORD: str({ default: "" }),
  USER_LIMIT_PER_DAY: num({ default: 50 }),
  NON_USER_COOLDOWN: num({ default: 10 }),
  DEFAULT_MAX_STATS_PER_LINK: num({ default: 5000 }),
  DISALLOW_ANONYMOUS_LINKS: bool({ default: false }),
  DISALLOW_REGISTRATION: bool({ default: false }),
  CUSTOM_DOMAIN_USE_HTTPS: bool({ default: false }),
  JWT_SECRET: str(),
  ADMIN_EMAILS: str({ default: "" }),
  RECAPTCHA_SITE_KEY: str({ default: "" }),
  RECAPTCHA_SECRET_KEY: str({ default: "" }),
  GOOGLE_SAFE_BROWSING_KEY: str({ default: "" }),
  GOOGLE_ANALYTICS: str({ default: "" }),
  GOOGLE_ANALYTICS_UNIVERSAL: str({ default: "" }),
  MAIL_HOST: str(),
  MAIL_PORT: num(),
  MAIL_SECURE: bool({ default: false }),
  MAIL_USER: str(),
  MAIL_FROM: str({ default: "", example: "Kutt <support@kutt.it>" }),
  MAIL_PASSWORD: str(),
  REPORT_EMAIL: str({ default: "" }),
  CONTACT_EMAIL: str({ default: "" }),
  SENTRY_PRIVATE_DSN: str({ default: "" }),
  SENTRY_PUBLIC_DSN: str({ default: "" })
}, {
  reporter: ({errors, env}: {errors: { [key: string]: Error }, env: any}) => {
    if (env.DATABASE_URL !== undefined) {
      delete errors['DB_USER'];
      delete errors['DB_PASSWORD'];
    }
    if (env.DB_USER !== undefined && env.DB_PASSWORD !== undefined) {
      delete errors['DATABASE_URL'];
    }
    if (errors['REDIS_URL'] instanceof EnvMissingError) {
      delete errors['REDIS_URL'];
    }
    reporter({errors, env});
  }
});

export default env;
