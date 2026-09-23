exports.up = async knex => {
  await knex.schema.createTable("link_health", table => {
    table.integer("link_id").unsigned().primary().references("id").inTable("links").onDelete("CASCADE");
    table.integer("user_id").unsigned().notNullable().references("id").inTable("users").onDelete("CASCADE");
    table.boolean("enabled").notNullable().defaultTo(false);
    table.integer("interval_hours").notNullable().defaultTo(24);
    table.bigInteger("revision").notNullable().defaultTo(0);
    table.bigInteger("auth_version").notNullable();
    table.bigInteger("next_at").nullable();
    table.bigInteger("requested_at").nullable();
    table.bigInteger("checked_at").nullable();
    table.uuid("lease").nullable();
    table.bigInteger("lease_until").nullable();
    table.string("source_hash", 64).nullable();
    table.string("state", 30).notNullable().defaultTo("pending");
    table.text("results").notNullable().defaultTo("[]");
    table.index(["enabled", "next_at"]);
    table.index("user_id");
  });
  await knex.schema.createTable("health_worker", table => {
    table.integer("id").primary();
    table.bigInteger("heartbeat_at").nullable();
    table.bigInteger("next_claim_at").notNullable().defaultTo(0);
  });
  await knex("health_worker").insert({ id: 1, next_claim_at: 0 });
};
exports.down = async knex => {
  if (await knex("link_health").first()) throw new Error("Destination monitoring configuration exists. Keep it or restore a compatible backup; do not silently discard monitoring.");
  await knex.schema.dropTable("link_health");
  await knex.schema.dropTable("health_worker");
};
