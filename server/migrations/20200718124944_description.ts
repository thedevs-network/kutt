import * as Knex from "knex";
import * as models from "../models";

export async function up(knex: Knex): Promise<any> {
  models.TableName.setPrefix("");
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
