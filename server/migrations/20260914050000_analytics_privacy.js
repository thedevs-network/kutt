async function up(knex) {
  await knex.schema.createTable("link_tracking", table => {
    table.integer("link_id").unsigned().primary().references("id").inTable("links").onDelete("CASCADE");
    table.boolean("enabled").notNullable().defaultTo(true);
    table.bigInteger("revision").notNullable();
  });
  await knex.schema.createTable("analytics_retention", table => {
    table.integer("id").primary();
    table.integer("days").notNullable().defaultTo(0);
    table.bigInteger("revision").notNullable().defaultTo(0);
    table.bigInteger("last_run").nullable();
    table.bigInteger("deleted_buckets").notNullable().defaultTo(0);
    table.string("last_error", 100).nullable();
  });
  await knex("analytics_retention").insert({ id: 1, days: 0, revision: 0 });
}
async function down(knex) {
  if (await knex("link_tracking").first() || await knex("analytics_retention").where("revision", ">", 0).first()) {
    throw new Error("Cannot discard tracking decisions, queue revisions or retention policy. Restore compatible state instead.");
  }
  await knex.schema.dropTable("analytics_retention");
  await knex.schema.dropTable("link_tracking");
}
module.exports = { up, down };
