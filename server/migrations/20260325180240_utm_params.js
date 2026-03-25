async function up(knex) {
  const hasUtmSource = await knex.schema.hasColumn("links", "utm_source");
  if (!hasUtmSource) {
    await knex.schema.alterTable("links", table => {
      table.string("utm_source");
      table.string("utm_medium");
      table.string("utm_campaign");
      table.string("utm_term");
      table.string("utm_content");
    });
  }
}

async function down(knex) {
  const hasUtmSource = await knex.schema.hasColumn("links", "utm_source");
  if (hasUtmSource) {
    await knex.schema.alterTable("links", table => {
      table.dropColumn("utm_source");
      table.dropColumn("utm_medium");
      table.dropColumn("utm_campaign");
      table.dropColumn("utm_term");
      table.dropColumn("utm_content");
    });
  }
}

module.exports = {
  up,
  down
}
