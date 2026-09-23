exports.up = async knex => {
  await knex.schema.createTable("management_events", table => {
    table.bigIncrements("sequence").primary();
    table.uuid("id").notNullable().unique();
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("type", 50).notNullable();
    table.text("payload").notNullable();
    table.bigInteger("created_at").notNullable();
    table.index(["user_id", "sequence"]);
  });
  await knex.schema.createTable("webhooks", table => {
    table.uuid("id").primary();
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.string("name", 80).notNullable();
    table.text("url").notNullable();
    table.text("secret").notNullable();
    table.text("events").notNullable();
    table.boolean("enabled").notNullable().defaultTo(true);
    table.bigInteger("revision").notNullable().defaultTo(1);
    table.bigInteger("auth_version").notNullable();
    table.bigInteger("created_at").notNullable();
    table.bigInteger("updated_at").notNullable();
    table.index("user_id");
  });
  await knex.schema.createTable("webhook_deliveries", table => {
    table.uuid("id").primary();
    table.uuid("webhook_id").notNullable().references("id").inTable("webhooks").onDelete("CASCADE");
    table.uuid("event_id").notNullable().references("id").inTable("management_events").onDelete("CASCADE");
    table.bigInteger("revision").notNullable();
    table.string("state", 16).notNullable().defaultTo("pending");
    table.integer("attempts").notNullable().defaultTo(0);
    table.integer("total_attempts").notNullable().defaultTo(0);
    table.bigInteger("next_at").notNullable();
    table.bigInteger("lease_until").nullable();
    table.uuid("lease").nullable();
    table.integer("http_status").nullable();
    table.string("error", 80).nullable();
    table.bigInteger("completed_at").nullable();
    table.bigInteger("created_at").notNullable();
    table.unique(["webhook_id", "event_id"]);
    table.index(["state", "next_at"]);
  });
};
exports.down = async knex => {
  if (await knex("webhooks").first() || await knex("management_events").first()) {
    throw new Error("Webhooks or event history exist. Keep the schema; restore a compatible backup instead of discarding delivery state.");
  }
  await knex.schema.dropTable("webhook_deliveries");
  await knex.schema.dropTable("webhooks");
  await knex.schema.dropTable("management_events");
};
