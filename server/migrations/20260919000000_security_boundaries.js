exports.up = async knex => {
  // Capabilities issued before this boundary fix cannot prove their generation.
  await knex("users").update(require("../account-tokens"));
  await knex.schema.createTable("webhook_queue_state", table => {
    table.integer("id").primary();
    table.bigInteger("sequence").notNullable().defaultTo(0);
    table.bigInteger("window_start").notNullable().defaultTo(0);
    table.integer("admitted").notNullable().defaultTo(0);
  });
  await knex("webhook_queue_state").insert({ id: 1 });
  await knex.schema.createTable("webhook_queue_owners", table => {
    table.integer("user_id").unsigned().primary().references("id").inTable("users").onDelete("CASCADE");
    table.bigInteger("last_served").notNullable().defaultTo(0);
    table.bigInteger("window_start").notNullable().defaultTo(0);
    table.integer("admitted").notNullable().defaultTo(0);
  });
  const owners = await knex("webhooks").distinct("user_id");
  for (const owner of owners) await knex("webhook_queue_owners").insert(owner);
};
exports.down = async knex => {
  if (await knex("users").first()) {
    throw new Error("Keep the security boundary schema. Roll back using a compatible verified backup, not by resetting admission counters.");
  }
  await knex.schema.dropTable("webhook_queue_owners");
  await knex.schema.dropTable("webhook_queue_state");
};
