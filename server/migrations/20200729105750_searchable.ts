import * as Knex from "knex";

export async function up(knex: Knex): Promise<any> {
  const hasSearchable = await knex.schema.hasColumn("links", "searchable");
  if (!hasSearchable) {
    await knex.schema.alterTable("links", table => {
      table.boolean("searchable");
    });
  }
}

export async function down(knex: Knex): Promise<any> {
  // do nothing
}
