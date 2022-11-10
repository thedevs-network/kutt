import { Knex } from "knex";

export async function up(knex: Knex): Promise<any> {
  const hasDescription = await knex.schema.hasColumn("links", "description");
  if (!hasDescription) {
    await knex.schema.alterTable("links", table => {
      table.string("description");
    });
  }
}

export async function down(): Promise<any> {
  return null;
}
