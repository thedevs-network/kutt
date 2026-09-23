exports.up = async function (knex) {
  await knex.schema.alterTable("api_tokens", table => {
    // UUID, not a nullable FK: deleting a domain must never widen access.
    table.string("domain_scope", 36).notNullable().defaultTo("all");
  });
  await knex.schema.createTable("link_creation_requests", table => {
    table.integer("user_id").unsigned().notNullable()
      .references("id").inTable("users").onDelete("CASCADE");
    table.string("key_hash", 64).notNullable();
    table.string("request_hash", 64).notNullable();
    table.string("link_uuid", 36);
    table.text("response");
    table.integer("status");
    table.bigInteger("created_at").notNullable();
    table.primary(["user_id", "key_hash"]);
    table.index("created_at");
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("link_creation_requests");
  await knex.schema.alterTable("api_tokens", table => table.dropColumn("domain_scope"));
};
