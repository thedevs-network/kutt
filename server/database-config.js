module.exports = function databaseConfig(env) {
  const sqlite = ["sqlite3", "better-sqlite3"].includes(env.DB_CLIENT);
  return {
    client: env.DB_CLIENT,
    connection: sqlite ? { filename: env.DB_FILENAME } : {
      host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME,
      user: env.DB_USER, password: env.DB_PASSWORD,
      ssl: require("./transport-tls").options(env, "DB")
    },
    // SQLite retains Knex's single-connection transaction behavior.
    pool: sqlite ? { min: 1, max: 1 } : { min: env.DB_POOL_MIN, max: env.DB_POOL_MAX },
    useNullAsDefault: true
  };
};
