// this configuration is for migrations only
// and since jwt secret is not required, it's set to a placehodler string to bypass env validation
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = "securekey";
}

const env = require("./server/env");


module.exports = {
  client: env.DB_CLIENT,
  connection: {
    host: env.DB_HOST,
    database: env.DB_NAME,
    user: env.DB_USER,
    port: env.DB_PORT,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL,
  },
  useNullAsDefault: true,
  migrations: {
    tableName: "knex_migrations",
    directory: "server/migrations",
    disableMigrationsListValidation: true,
  }
};
