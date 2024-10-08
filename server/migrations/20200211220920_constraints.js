const models = require("../models");

async function up(knex) {
  await models.createUserTable(knex);
  await models.createIPTable(knex);
  await models.createDomainTable(knex);
  await models.createHostTable(knex);
  await models.createLinkTable(knex);
  await models.createVisitTable(knex);
}

async function down() {
  // do nothing
}

module.exports = {
  up,
  down
}
