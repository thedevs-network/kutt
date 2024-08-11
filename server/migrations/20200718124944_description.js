async function up(knex) {
  const hasDescription = await knex.schema.hasColumn("links", "description");
  if (!hasDescription) {
    await knex.schema.alterTable("links", table => {
      table.string("description");
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
