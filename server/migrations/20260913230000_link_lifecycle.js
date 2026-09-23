exports.up = async knex => {
  await knex.schema.alterTable("links", table => {
    table.boolean("paused").notNullable().defaultTo(false);
    table.bigInteger("starts_at");
    table.bigInteger("ends_at");
    table.integer("max_visits");
    table.bigInteger("redirect_count").notNullable().defaultTo(0);
  });
};

exports.down = async knex => {
  const controlled = await knex("links").where("paused", true)
    .orWhereNotNull("starts_at").orWhereNotNull("ends_at").orWhereNotNull("max_visits").first();
  if (controlled) throw new Error("Remove lifecycle policies explicitly before dropping their schema.");
  await knex.schema.alterTable("links", table => {
    table.dropColumns("paused", "starts_at", "ends_at", "max_visits", "redirect_count");
  });
};
