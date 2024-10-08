const models = require("../models");

async function up(knex) {
  await models.createUserTable(knex);
  await models.createIPTable(knex);
  await models.createDomainTable(knex);
  await models.createHostTable(knex);
  await models.createLinkTable(knex);
  await models.createVisitTable(knex);

  // drop unique user id constraint only if database is postgres
  // because other databases use the new version of the app and they start fresh with the correct model
  // if i use table.dropUnique() method it would throw error on fresh install because the constraint does not exist
  // and if it throws error, the rest of the transactions fail as well
  if (knex.client.driverName === "pg") {
    knex.raw(`
      ALTER TABLE domains
      DROP CONSTRAINT IF EXISTS domains_user_id_unique
    `)
  }

  const hasUUID = await knex.schema.hasColumn("domains", "uuid");

  if (!hasUUID) {
    await knex.schema.alterTable("domains", (table) => {
       table.uuid("uuid").notNullable().defaultTo(knex.fn.uuid());
     });
   }
}

async function down() {
  // do nothing
}

module.exports = {
  up,
  down
}
