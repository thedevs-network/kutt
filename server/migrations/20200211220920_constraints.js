const models = require("../models");

async function up(knex) {
  await models.createUserTable(knex);
  await models.createIPTable(knex);
  await models.createDomainTable(knex);
  await models.createHostTable(knex);
  await models.createLinkTable(knex);
  await models.createVisitTable(knex);

  await Promise.all([
    knex.schema.alterTable('domains', (table) => {
      table.dropForeign('ignored', 'domains_user_id_foreign');
      table.foreign('user_id')
        .references('id')
        .inTable('users')
        .onDelete('SET NULL')
        .withKeyName('domains_user_id_foreign');
    }),
    knex.schema.alterTable('links', (table) => {
      table.dropForeign('ignored', 'links_user_id_foreign');
      table.foreign('user_id')
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
        .withKeyName('links_user_id_foreign');
    }),
    knex.schema.alterTable('visits', (table) => {
      table.dropForeign('ignored', 'visits_link_id_foreign');
      table.foreign('link_Id')
        .references('id')
        .inTable('links')
        .onDelete('CASCADE')
        .withKeyName('visits_link_id_foreign');
    }),
  ]);
}

async function down() {
  // do nothing
}

module.exports = {
  up,
  down
}
