async function up(knex) {
  await knex.schema.alterTable("links", table => {
    table.string("description");
  });
}

async function down(knex) {
  await knex.schema.alterTable("links", table => {
    table.dropColumn("description");
  });
}

module.exports = {
  up,
  down
};
