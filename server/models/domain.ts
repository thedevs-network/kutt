import * as Knex from "knex";

export async function createDomainTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable("domains");
  if (!hasTable) {
    await knex.schema.raw('create extension if not exists "uuid-ossp"');
    await knex.schema.createTable("domains", table => {
      table.increments("id").primary();
      table
        .boolean("banned")
        .notNullable()
        .defaultTo(false);
      table
        .integer("banned_by_id")
        .references("id")
        .inTable("users");
      table
        .string("address")
        .unique()
        .notNullable();
      table.string("homepage").nullable();
      table
        .integer("user_id")
        .references("id")
        .inTable("users")
        .onDelete("SET NULL")
        .unique();
      table.timestamps(false, true);
    });
  }
}
