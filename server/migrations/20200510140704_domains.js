const models = require("../models");

async function up(knex) {
  await models.createUserTable(knex);
  await models.createIPTable(knex);
  await models.createDomainTable(knex);
  await models.createHostTable(knex);
  await models.createLinkTable(knex);
  await models.createVisitTable(knex);

  await Promise.all([
    async () => {
      try {
        await knex.schema.alterTable("domains", (table) => {
          table.dropUnique([], "domains_user_id_unique");
        });
      } catch (ignored) {
      }
    },
    await knex.schema.alterTable("domains", (table) => {
      table.uuid("uuid").defaultTo(knex.fn.uuid());
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
