async function up(knex) {
  await knex.schema.createTable("link_imports", table => {
    table.uuid("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("input_hash", 64).notNullable();
    table.bigInteger("created_at").notNullable();
    table.text("result").notNullable();
    table.index(["user_id", "created_at"]);
  });
}

async function down(knex) {
  if (await knex("link_imports").first()) throw new Error("Cannot discard import replay receipts. Retain a compatible image or restore coordinated state.");
  await knex.schema.dropTable("link_imports");
}

module.exports = { up, down };
