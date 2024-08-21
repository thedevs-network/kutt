import dbCredentials from "./server/db-credentials";

module.exports = {
  production: {
    client: "postgresql",
    connection: {
      ...dbCredentials
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "server/migrations"
    }
  }
};
