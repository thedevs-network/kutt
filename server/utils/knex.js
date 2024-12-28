
function knexUtils(knex) {
  function truncatedTimestamp(columnName, precision = "hour") {
    switch (knex.client.driverName) {
      case "sqlite3":
      case "better-sqlite3":
        // SQLite uses strftime for date truncation
        const sqliteFormats = {
          second: "%Y-%m-%d %H:%M:%S",
          minute: "%Y-%m-%d %H:%M:00",
          hour: "%Y-%m-%d %H:00:00",
          day: "%Y-%m-%d 00:00:00",
        };
        return knex.raw(`strftime('${sqliteFormats[precision]}', ${columnName})`); // Default to 'hour'
      case "mssql":
        // For MSSQL, we can use FORMAT or CONVERT to truncate the timestamp
        const mssqlFormats = {
          second: "yyyy-MM-dd HH:mm:ss",
          minute: "yyyy-MM-dd HH:mm:00",
          hour: "yyyy-MM-dd HH:00:00",
          day: "yyyy-MM-dd 00:00:00",
        };
        return knex.raw(`FORMAT(${columnName}, '${mssqlFormats[precision]}'`);
      case "pg":
      case "pgnative":
      case "cockroachdb":
        // PostgreSQL has the `date_trunc` function, which is ideal for this task
        return knex.raw(`date_trunc(?, ${columnName} at time zone 'Z')`, [precision]);
      case "oracle":
      case "oracledb":
        // Oracle truncates dates using the `TRUNC` function
        return knex.raw(`TRUNC(${columnName}, ?)`, [precision]);
      case "mysql":
      case "mysql2":
        // MySQL can use the DATE_FORMAT function to truncate
        const mysqlFormats = {
          second: "%Y-%m-%d %H:%i:%s",
          minute: "%Y-%m-%d %H:%i:00",
          hour: "%Y-%m-%d %H:00:00",
          day: "%Y-%m-%d 00:00:00",
        };
        return knex.raw(`DATE_FORMAT(${columnName}, '${mysqlFormats[precision]}')`);
      default:
        throw new Error(`${this.client.driverName} does not support timestamp truncation with precision`);
    }
  }

  return {
    truncatedTimestamp
  }
}

module.exports = {
  knexUtils
}
