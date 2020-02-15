import env from "./server/env";

module.exports = {
  production: {
    client: "postgresql",
    connection: {
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "server/migrations"
    }
  }
};
