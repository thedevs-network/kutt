async function up(knex) {
  await knex.schema.alterTable("users", table => table.integer("auth_version").notNullable().defaultTo(0));
  await knex.schema.createTable("oidc_identities", table => {
    table.string("id", 64).primary();
    table.text("issuer").notNullable();
    table.string("subject").notNullable();
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.bigInteger("created_at").notNullable();
    table.index("user_id");
  });
  await knex.schema.createTable("oidc_logout_events", table => {
    table.string("id", 64).primary();
    table.text("issuer").notNullable();
    table.string("subject").nullable();
    table.string("sid").nullable();
    table.bigInteger("received_at").notNullable();
    table.bigInteger("expires_at").notNullable().index();
  });
}

async function down(knex) {
  if (await knex("oidc_identities").first() || await knex("oidc_logout_events").first() ||
      await knex("users").where("auth_version", ">", 0).first()) {
    throw new Error("Cannot discard identity bindings or session revocation state. Use a compatible image.");
  }
  await knex.schema.dropTable("oidc_logout_events");
  await knex.schema.dropTable("oidc_identities");
  await knex.schema.alterTable("users", table => table.dropColumn("auth_version"));
}

module.exports = { up, down };
