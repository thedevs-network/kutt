const knex = require("knex");

const env = require("./env");

const db = knex({
  client: "postgres",
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL,
    pool: {
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX
    }
  }
});

module.exports = db;
