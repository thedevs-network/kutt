async function up(knex) {
  await knex.schema.createTable("workspaces", table => {
    table.uuid("id").primary();
    table.integer("owner_id").unsigned().notNullable().references("id").inTable("users").onDelete("RESTRICT");
    table.string("name", 80).notNullable();
    table.string("name_key", 160).notNullable();
    table.bigInteger("created_at").notNullable();
    table.bigInteger("revision").notNullable().defaultTo(0);
    table.unique(["owner_id", "name_key"]);
  });
  await knex.schema.createTable("workspace_members", table => {
    table.uuid("id").primary();
    table.uuid("workspace_id").notNullable().references("id").inTable("workspaces").onDelete("CASCADE");
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("role", 16).notNullable();
    table.bigInteger("created_at").notNullable();
    table.bigInteger("accepted_at").nullable();
    table.unique(["workspace_id", "user_id"]);
    table.index("user_id");
  });
  await knex.schema.createTable("workspace_links", table => {
    table.uuid("workspace_id").notNullable().references("id").inTable("workspaces").onDelete("CASCADE");
    table.integer("link_id").unsigned().notNullable().references("id").inTable("links").onDelete("CASCADE");
    table.bigInteger("created_at").notNullable();
    table.primary(["workspace_id", "link_id"]);
    table.index("link_id");
  });
}

async function down(knex) {
  if (await knex("workspaces").first()) throw new Error("Cannot discard workspace membership/sharing. Close workspaces or restore compatible state first.");
  await knex.schema.dropTable("workspace_links");
  await knex.schema.dropTable("workspace_members");
  await knex.schema.dropTable("workspaces");
}

module.exports = { up, down };
