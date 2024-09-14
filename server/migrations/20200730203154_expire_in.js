async function up(knex) {
  await knex.schema.alterTable("links", table => {
    table.dateTime("expire_in");
  });
}

async function down(knex) {
  await knex.schema.alterTable("links", table => {
    table.dropColumn("expire_in");
  });
}

module.exports = {
  up,
  down
};
