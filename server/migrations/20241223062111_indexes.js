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

  await knex.raw(`
    CREATE INDEX ${ifNotExists} links_domain_id_index ON links (domain_id);
    CREATE INDEX ${ifNotExists} links_user_id_index ON links (user_id);
    CREATE INDEX ${ifNotExists} links_address_index ON links (address);
    CREATE INDEX ${ifNotExists} links_expire_in_index ON links (expire_in);
    CREATE INDEX ${ifNotExists} domains_address_index ON domains (address);
    CREATE INDEX ${ifNotExists} domains_user_id_index ON domains (user_id);
    CREATE INDEX ${ifNotExists} hosts_address_index ON hosts (address);
    CREATE INDEX ${ifNotExists} visits_link_id_index ON visits (link_id);
  `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function down(knex) {
  await knex.schema.alterTable("users", function(table) {
    table.dropUnique(["apikey"]);
  });

  await knex.raw(`
    DROP INDEX links_domain_id_index;
    DROP INDEX links_user_id_index;
    DROP INDEX links_address_index;
    DROP INDEX links_expire_in_index;
    DROP INDEX domains_address_index;
    DROP INDEX domains_user_id_index;
    DROP INDEX hosts_address_index;
    DROP INDEX visits_link_id_index;
  `);
};

module.exports = {
  up, 
  down,
}