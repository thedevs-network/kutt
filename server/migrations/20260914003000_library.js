async function up(knex) {
  await knex.schema.createTable("library_labels", table => {
    table.uuid("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("kind", 16).notNullable();
    table.string("name", 80).notNullable();
    table.string("name_key", 160).notNullable();
    table.unique(["user_id", "kind", "name_key"]);
  });
  await knex.schema.createTable("library_link_labels", table => {
    table.integer("link_id").unsigned().notNullable().references("id").inTable("links").onDelete("CASCADE");
    table.uuid("label_id").notNullable().references("id").inTable("library_labels").onDelete("CASCADE");
    table.primary(["link_id", "label_id"]);
    table.index("label_id");
  });
  await knex.schema.createTable("library_filters", table => {
    table.uuid("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("name", 80).notNullable();
    table.string("name_key", 160).notNullable();
    table.text("filters").notNullable();
    table.unique(["user_id", "name_key"]);
  });
}

async function down(knex) {
  if (await knex("library_labels").first() || await knex("library_filters").first()) {
    throw new Error("Cannot discard library organization. Export or restore compatible state first.");
  }
  await knex.schema.dropTable("library_filters");
  await knex.schema.dropTable("library_link_labels");
  await knex.schema.dropTable("library_labels");
}

module.exports = { up, down };
