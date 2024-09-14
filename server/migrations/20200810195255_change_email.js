async function up(knex) {
  await knex.schema.alterTable("users", table => {
    table.dateTime("change_email_expires");
    table.string("change_email_token");
    table.string("change_email_address");
  });
}

async function down(knex) {
  await knex.schema.alterTable('users', table => {
    table.dropColumn("change_email_expires");
    table.dropColumn("change_email_token");
    table.dropColumn("change_email_address");
  });
}

module.exports = {
  up,
  down
};

