import { Knex } from "knex";

export async function createLinkTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable("links");

  if (!hasTable) {
    await knex.schema.raw('create extension if not exists "uuid-ossp"');
    await knex.schema.createTable("links", table => {
      knex.raw('create extension if not exists "uuid-ossp"');
      table.increments("id").primary();
      table.string("address").notNullable();
      table.string("description");
      table
        .boolean("banned")
        .notNullable()
        .defaultTo(false);
      table
        .integer("banned_by_id")
        .references("id")
        .inTable("users");
      table
        .integer("domain_id")
        .references("id")
        .inTable("domains");
      table.string("password");
      table.dateTime("expire_in");
      table.string("target", 2040).notNullable();
      table
        .integer("user_id")
        .references("id")
        .inTable("users")
        .onDelete("CASCADE");
      table
        .integer("visit_count")
        .notNullable()
        .defaultTo(0);
      table.timestamps(false, true);
    });
  }

  const hasUUID = await knex.schema.hasColumn("links", "uuid");
  if (!hasUUID) {
    await knex.schema.raw('create extension if not exists "uuid-ossp"');
    await knex.schema.alterTable("links", table => {
      table
        .uuid("uuid")
        .notNullable()
        .defaultTo(knex.raw("uuid_generate_v4()"));
    });
  }
}
