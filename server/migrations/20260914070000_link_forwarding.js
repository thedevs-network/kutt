async function up(knex) {
  await knex.schema.createTable("link_forwarding", table => {
    table.integer("link_id").unsigned().primary().references("id").inTable("links").onDelete("CASCADE");
    table.text("policy").notNullable();
    table.bigInteger("revision").notNullable();
  });
}
async function down(knex) {
  if (await knex("link_forwarding").first() || await knex("links").where("address", "like", "%/%").first()) {
    throw new Error("Cannot discard forwarding policies or nested aliases. Restore compatible state instead.");
  }
  await knex.schema.dropTable("link_forwarding");
}
module.exports = { up, down };
