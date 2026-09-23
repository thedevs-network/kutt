exports.up = async function (knex) {
  await knex.schema.createTable("api_tokens", table => {
    table.string("id", 36).primary();
    table.integer("user_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    table.string("name", 80).notNullable();
    table.string("token_hash", 64).notNullable().unique();
    table.string("prefix", 13).notNullable();
    table.text("scopes").notNullable();
    table.bigInteger("created_at").notNullable();
    table.bigInteger("expires_at");
    table.bigInteger("revoked_at");
    table.bigInteger("last_used_at");
    table.index(["user_id", "created_at"]);
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("api_tokens");
};
