import * as Knex from "knex";
import { TableName } from ".";

export async function createDomainTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable(TableName.domain);
  if (!hasTable) {
    await knex.schema.raw('create extension if not exists "uuid-ossp"');
    await knex.schema.createTable(TableName.domain, table => {
      table.increments("id").primary();
      table
        .boolean("banned")
        .notNullable()
        .defaultTo(false);
      table
        .integer("banned_by_id")
        .references("id")
        .inTable(TableName.user);
      table
        .string("address")
        .unique()
        .notNullable();
      table.string("homepage").nullable();
      table
        .integer("user_id")
        .references("id")
        .inTable(TableName.user)
        .onDelete("SET NULL");
      table
        .uuid("uuid")
        .notNullable()
        .defaultTo(knex.raw("uuid_generate_v4()"));
      table.timestamps(false, true);
    });
  }
}
