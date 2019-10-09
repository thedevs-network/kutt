import * as Knex from "knex";

export async function createHostTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable("hosts");
  if (!hasTable) {
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
        .references("id")
        .inTable("users");
      table.timestamps(false, true);
    });
  }
}
