import env from "./server/env";

module.exports = {
  production: {
    client: "postgresql",
    connection: {
      host: env.DB_HOST,
      database: env.DB_NAME,
      user: env.DB_USER,
      port: env.DB_PORT,
      password: env.DB_PASSWORD,
      ...(env.DB_SSL ? {
        ssl: {
          rejectUnauthorized: false
        }
      } : {}),
    },
    migrations: {
      tableName: "knex_migrations",
      directory: "server/migrations"
    }
  }
};
