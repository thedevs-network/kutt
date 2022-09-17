import * as Knex from "knex";
import { TableName } from ".";

export async function createVisitTable(knex: Knex) {
  const hasTable = await knex.schema.hasTable(TableName.visit);
  if (!hasTable) {
    await knex.schema.createTable(TableName.visit, table => {
      table.increments("id").primary();
      table.jsonb("countries").defaultTo("{}");
      table
        .dateTime("created_at")
        .notNullable()
        .defaultTo(knex.fn.now());
      table.dateTime("updated_at").defaultTo(knex.fn.now());
      table
        .integer("link_id")
        .references("id")
        .inTable(TableName.link)
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
    });
  }

  const hasUpdatedAt = await knex.schema.hasColumn(
    TableName.visit,
    "updated_at"
  );
  if (!hasUpdatedAt) {
    await knex.schema.alterTable(TableName.visit, table => {
      table.dateTime("updated_at").defaultTo(knex.fn.now());
    });
  }
}
