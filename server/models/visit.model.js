async function createVisitTable(knex) {
  const hasTable = await knex.schema.hasTable("visits");
  if (!hasTable) {
    await knex.schema.createTable("visits", table => {
      table.increments("id").primary();
      table.jsonb("countries");
      table
        .dateTime("created_at")
        .notNullable()
        .defaultTo(knex.fn.now());
      table.dateTime("updated_at").defaultTo(knex.fn.now());
      table
        .integer("link_id")
        .unsigned();
      table
        .foreign("link_id")
        .references("id")
        .inTable("links")
        .onDelete("CASCADE")
        .withKeyName("visits_link_id_foreign");
      table
        .integer("user_id")
        .unsigned();
      table
        .foreign("user_id")
        .references("id")
        .inTable("users")
        .onDelete("CASCADE")
        .withKeyName("visits_user_id_foreign");
      table.jsonb("referrers");
      table
        .integer("total")
        .notNullable()
        .defaultTo(0);
      table
        .integer("br_chrome")
        .notNullable()
        .defaultTo(0);
      table
        .integer("br_edge")
        .notNullable()
        .defaultTo(0);
      table
        .integer("br_firefox")
        .notNullable()
        .defaultTo(0);
      table
        .integer("br_ie")
        .notNullable()
        .defaultTo(0);
      table
        .integer("br_opera")
        .notNullable()
        .defaultTo(0);
      table
        .integer("br_other")
        .notNullable()
        .defaultTo(0);
      table
        .integer("br_safari")
        .notNullable()
        .defaultTo(0);
      table
        .integer("os_android")
        .notNullable()
        .defaultTo(0);
      table
        .integer("os_ios")
        .notNullable()
        .defaultTo(0);
      table
        .integer("os_linux")
        .notNullable()
        .defaultTo(0);
      table
        .integer("os_macos")
        .notNullable()
        .defaultTo(0);
      table
        .integer("os_other")
        .notNullable()
        .defaultTo(0);
      table
        .integer("os_windows")
        .notNullable()
        .defaultTo(0);
    });
  }

  const hasUpdatedAt = await knex.schema.hasColumn("visits", "updated_at");
  if (!hasUpdatedAt) {
    await knex.schema.alterTable("visits", table => {
      table.dateTime("updated_at").defaultTo(knex.fn.now());
    });
  }
}

module.exports = {
  createVisitTable
}