import knex from "knex";
import env from "./env";
import dbCredentials from "./db-credentials";

const db = knex({
  client: "postgres",
  connection: {
    ...dbCredentials,
    pool: {
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX
    }
  }
});

export default db;
