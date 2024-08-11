async function up(knex) {
  const hasExpireIn = await knex.schema.hasColumn("links", "expire_in");
  if (!hasExpireIn) {
    await knex.schema.alterTable("links", table => {
      table.dateTime("expire_in");
    });
  }
}

async function down() {
  return null;
}

module.exports = {
  up,
  down
}
