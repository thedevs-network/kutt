const env = require("../env");

const isMySQL = env.DB_CLIENT === "mysql" || env.DB_CLIENT === "mysql2";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function up(knex) {
  // IF NOT EXISTS is not available on MySQL So if you're
  // using MySQL you should make sure you don't have these indexes already 
  const ifNotExists = isMySQL ? "" : "IF NOT EXISTS";

  await knex.raw(`
    CREATE INDEX ${ifNotExists} visits_user_id_index ON visits (user_id);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function down(knex) {
  await knex.raw(`
    DROP INDEX visits_user_id_index;
  `);
};

module.exports = {
  up, 
  down,
}