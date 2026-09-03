const formats = {
  sqlite3: {
    // second: "%Y-%m-%d %H:%M:%S",
    // minute: "%Y-%m-%d %H:%M:00",
    hour: "%Y-%m-%d %H:00:00",
    // day: "%Y-%m-%d 00:00:00",
  },
  mssql: {
    // second: "yyyy-MM-dd HH:mm:ss",
    // minute: "yyyy-MM-dd HH:mm:00",
    hour: "yyyy-MM-dd HH:00:00",
    // day: "yyyy-MM-dd 00:00:00",
  },
  mysql: {
    // second: "%Y-%m-%d %H:%i:%s",
    // minute: "%Y-%m-%d %H:%i:00",
    hour: "%Y-%m-%d %H:00:00",
    // day: "%Y-%m-%d 00:00:00",
  },
};

const knex = require("../knex");
const { driverName } = knex.client;

const column = "created_at";
const precision = "hour";

const truncatedCreatedAtHour =
  driverName === "sqlite3" || driverName === "better-sqlite3"
    ? knex.raw(`strftime(?, ??)`, [formats.sqlite3[precision], column])
    : driverName === "mssql"
    ? knex.raw(`FORMAT(??, ?)`, [column, formats.mssql[precision]])
    : driverName === "pg" ||
        driverName === "pgnative" ||
        driverName === "cockroachdb"
    ? knex.raw(`date_trunc(?, ?? at time zone 'Z')`, [precision, column])
    : driverName === "oracle" || driverName === "oracledb"
    ? knex.raw(`TRUNC(??, ?)`, [column, precision])
    : driverName === "mysql" || driverName === "mysql2"
    ? knex.raw(`DATE_FORMAT(??, ?)`, [column, formats.mysql[precision]])
    : (() => {
      throw new Error(
        `${driverName} does not support timestamp truncation with precision`,
      );
    })();

module.exports = { truncatedCreatedAtHour };
