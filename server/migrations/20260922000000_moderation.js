exports.up = async db => {
  await db.schema.createTable("admin_mutation_state", table => {
    table.integer("id").primary();
    table.bigInteger("sequence").notNullable().defaultTo(0);
  });
  await db("admin_mutation_state").insert({ id: 1 });
  await db.schema.createTable("moderation_events", table => {
    table.increments("id").primary();
    table.integer("actor_id").unsigned().notNullable();
    table.string("entity", 12).notNullable();
    table.string("entity_id", 64).notNullable();
    table.string("action", 12).notNullable();
    table.bigInteger("created_at").notNullable().index();
  });
};
exports.down = async db => {
  if (await db("moderation_events").first()) throw new Error("Preserve the moderation audit. Restore a verified compatible backup instead.");
  await db.schema.dropTable("moderation_events");
  await db.schema.dropTable("admin_mutation_state");
};
