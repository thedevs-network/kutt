import env from "./env";

const credentials = {
  host: env.DB_HOST,
  database: env.DB_NAME,
  user: env.DB_USER,
  port: env.DB_PORT,
  password: env.DB_PASSWORD,
  ssl: env.DB_SSL
} as const;

export default credentials;