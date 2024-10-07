const knex = require("knex");

const env = require("./env");

const db = knex({
  client: env.DB_CLIENT,
  connection: {
    filename: "db/" + env.DB_FILENAME,
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
  },
  useNullAsDefault: true,
});

db.isSqlite3 = db.client.driverName === "sqlite3" || db.client.driverName === "better-sqlite3";

module.exports = db;
