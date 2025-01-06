const env = require("../env");

const isMySQL = env.DB_CLIENT === "mysql" || env.DB_CLIENT === "mysql2";

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function up(knex) {
  // make apikey unique
  await knex.schema.alterTable("users", function(table) {
    table.unique("apikey");
  });
  
  // IF NOT EXISTS is not available on MySQL So if you're
  // using MySQL you should make sure you don't have these indexes already 
  const ifNotExists = isMySQL ? "" : "IF NOT EXISTS";

  // create them separately because one string with break lines didn't work on MySQL
  await Promise.all([
    knex.raw(`CREATE INDEX ${ifNotExists} links_domain_id_index ON links (domain_id);`),
    knex.raw(`CREATE INDEX ${ifNotExists} links_user_id_index ON links (user_id);`),
    knex.raw(`CREATE INDEX ${ifNotExists} links_address_index ON links (address);`),
    knex.raw(`CREATE INDEX ${ifNotExists} links_expire_in_index ON links (expire_in);`),
    knex.raw(`CREATE INDEX ${ifNotExists} domains_address_index ON domains (address);`),
    knex.raw(`CREATE INDEX ${ifNotExists} domains_user_id_index ON domains (user_id);`),
    knex.raw(`CREATE INDEX ${ifNotExists} hosts_address_index ON hosts (address);`),
    knex.raw(`CREATE INDEX ${ifNotExists} visits_link_id_index ON visits (link_id);`),
  ]);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function down(knex) {
  await knex.schema.alterTable("users", function(table) {
    table.dropUnique(["apikey"]);
  });

  await Promise.all([
    knex.raw(`DROP INDEX links_domain_id_index;`),
    knex.raw(`DROP INDEX links_user_id_index;`),
    knex.raw(`DROP INDEX links_address_index;`),
    knex.raw(`DROP INDEX links_expire_in_index;`),
    knex.raw(`DROP INDEX domains_address_index;`),
    knex.raw(`DROP INDEX domains_user_id_index;`),
    knex.raw(`DROP INDEX hosts_address_index;`),
    knex.raw(`DROP INDEX visits_link_id_index;`),
  ]);
};

module.exports = {
  up, 
  down,
}