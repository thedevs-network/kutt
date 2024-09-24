const env = require("./server/env");

module.exports = {
  production: {
    client: env.DB_CLIENT,
    connection: {
      filename: "db/" + env.DB_FILENAME,
      host: env.DB_HOST,
      database: env.DB_NAME,
      user: env.DB_USER,
      port: env.DB_PORT,
      password: env.DB_PASSWORD,
      ssl: env.DB_SSL,
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "server/migrations",
      disableMigrationsListValidation: true,
    }
  }
};
