async function up(knex) {
  const hasColumn = await knex.schema.hasColumn("domains", "is_global");
  if (!hasColumn) {
    await knex.schema.alterTable("domains", table => {
      table.boolean("is_global").notNullable().defaultTo(false);
    });
  }
}

async function down(knex) {
  const hasColumn = await knex.schema.hasColumn("domains", "is_global");
  if (hasColumn) {
    await knex.schema.alterTable("domains", table => {
      table.dropColumn("is_global");
    });
  }
}

module.exports = {
  up,
  down
};
