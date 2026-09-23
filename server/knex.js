const knex = require("knex");

const env = require("./env");

const isSQLite = env.DB_CLIENT === "sqlite3" || env.DB_CLIENT === "better-sqlite3";
const isPostgres = env.DB_CLIENT === "pg" || env.DB_CLIENT === "pg-native";
const isMySQL = env.DB_CLIENT === "mysql" || env.DB_CLIENT === "mysql2";

const db = knex(require("./database-config")(env));

db.isPostgres = isPostgres;
db.isSQLite = isSQLite;
db.isMySQL = isMySQL;

// MySQL's whereLike forces utf8_bin, which is invalid for utf8mb4 columns.
db.compatibleILIKE = isPostgres || isMySQL ? "andWhereILike" : "andWhereLike";

module.exports = db;
