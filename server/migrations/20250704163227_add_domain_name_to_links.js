/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function up(knex) {
  const hasDomainName = await knex.schema.hasColumn("links", "domain_name");

  if (!hasDomainName) {
    await knex.schema.alterTable("links", function(table) {
      table.string("domain_name").nullable();
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function down(knex) {
  const hasDomainName = await knex.schema.hasColumn("links", "domain_name");

  if (hasDomainName) {
    await knex.schema.alterTable("links", function(table) {
      table.dropColumn("domain_name");
    });
  }
}

module.exports = { up, down };
