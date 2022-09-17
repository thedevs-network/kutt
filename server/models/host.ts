import * as Knex from "knex";
import { TableName } from ".";

export async function createHostTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable(TableName.host);
  if (!hasTable) {
    await knex.schema.createTable(TableName.host, table => {
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
        .inTable(TableName.user);
      table.timestamps(false, true);
    });
  }
}
