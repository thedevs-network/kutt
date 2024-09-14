// NOTE:
//  This file should not be modified.
//  Create a new migration to update the schema.

async function up(knex) {
  await knex.schema.createTable("users", table => {
    table.increments("id").primary();
    table.string("apikey");
    table
      .boolean("banned")
      .notNullable()
      .defaultTo(false);
    table
      .integer("banned_by_id")
      .unsigned()
      .references("id")
      .inTable("users");
    table
      .json("cooldowns")
      .defaultTo("[]");
    table
      .string("email")
      .unique()
      .notNullable();
    table.string("password").notNullable();
    table.dateTime("reset_password_expires");
    table.string("reset_password_token");
    table.dateTime("verification_expires");
    table.string("verification_token");
    table
      .boolean("verified")
      .notNullable()
      .defaultTo(false);
    table.timestamps(false, true);
  });

  await knex.schema.createTable("ips", table => {
    table.increments("id").primary();
    table
      .string("ip")
      .unique()
      .notNullable();
    table.timestamps(false, true);
  });

  await knex.schema.createTable("domains", table => {
    table.increments("id").primary();
    table
      .boolean("banned")
      .notNullable()
      .defaultTo(false);
    table
      .integer("banned_by_id")
      .unsigned()
      .references("id")
      .inTable("users");
    table
      .string("address")
      .unique()
      .notNullable();
    table.string("homepage").nullable();
    table
      .integer("user_id")
      .unsigned()
      .references("id")
      .inTable("users")
      .onDelete("SET NULL")
      .unique()
    table.timestamps(false, true);
  });

  await knex.schema.createTable("hosts", table => {
    table.increments("id").primary();
    table
      .string("address")
      .unique()
      .notNullable();
    table
      .boolean("banned")
      .notNullable()
      .defaultTo(false);
    table
      .integer("banned_by_id")
      .unsigned()
      .references("id")
      .inTable("users");
    table.timestamps(false, true);
  });

  await knex.schema.createTable("links", table => {
    table.increments("id").primary();
    table
      .uuid("uuid")
      .notNullable()
      .defaultTo(knex.fn.uuid());
    table.string("address").notNullable();
    table
      .boolean("banned")
      .notNullable()
      .defaultTo(false);
    table
      .integer("banned_by_id")
      .unsigned()
      .references("id")
      .inTable("users");
    table
      .integer("domain_id")
      .unsigned()
      .references("id")
      .inTable("domains");
    table.string("password");
    table.string("target", 2040).notNullable();
    table
      .integer("user_id")
      .unsigned()
      .references("id")
      .inTable("users")
      .onDelete("CASCADE");
    table
      .integer("visit_count")
      .notNullable()
      .defaultTo(0);
    table.timestamps(false, true);
  });

  await knex.schema.createTable("visits", table => {
    table.increments("id").primary();
    table.jsonb("countries").defaultTo("{}");
    table
      .integer("link_id")
      .unsigned()
      .references("id")
      .inTable("links")
      .notNullable()
      .onDelete("CASCADE");
    table.jsonb("referrers").defaultTo("{}");
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
    table.timestamps(false, true);
  });
}

async function down(knex) {
  await knex.schema.dropTable('visits');
  await knex.schema.dropTable('links');
  await knex.schema.dropTable('hosts');
  await knex.schema.dropTable('domains');
  await knex.schema.dropTable('ips');
  await knex.schema.dropTable('users');

}

module.exports = {
  up,
  down
}
