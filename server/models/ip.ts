import * as Knex from "knex";
import { TableName } from ".";

export async function createIPTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable(TableName.ip);
  if (!hasTable) {
    await knex.schema.createTable(TableName.ip, table => {
      table.increments("id").primary();
      table
        .string("ip")
        .unique()
        .notNullable();
      table.timestamps(false, true);
    });
  }
}
