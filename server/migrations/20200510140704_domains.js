async function up(knex) {
  await knex.schema.alterTable("domains", (table) => {
    // Foreign needs to be temporarily dropped as unique is used as index
    table.dropForeign(["user_id"]);
    table.dropUnique(["user_id"]);
    table
      .foreign("user_id")
      .references("id")
      .inTable("users");
    table.uuid("uuid").defaultTo(knex.fn.uuid());
  });
}

async function down(knex) {
  await knex.schema.alterTable("domains", (table) => {
    table.unique("user_id", {
      indexName: "domains_user_id_unique"
    });
    table.dropColumn("uuid");
  });
}

module.exports = {
  up,
  down
};
