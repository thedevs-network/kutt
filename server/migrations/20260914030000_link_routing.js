async function up(knex) {
  await knex.schema.createTable("link_routing", table => {
    table.integer("link_id").unsigned().primary().references("id").inTable("links").onDelete("CASCADE");
    table.text("rules").notNullable();
    table.bigInteger("revision").notNullable();
  });
}
async function down(knex) {
  if (await knex("link_routing").first()) throw new Error("Cannot discard routing policies/revisions. Restore compatible state instead.");
  await knex.schema.dropTable("link_routing");
}
module.exports = { up, down };
