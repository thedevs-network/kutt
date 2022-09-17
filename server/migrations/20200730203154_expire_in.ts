import * as Knex from "knex";
import * as models from "../models";

export async function up(knex: Knex): Promise<any> {
  models.TableName.setPrefix("");
  const hasExpireIn = await knex.schema.hasColumn("links", "expire_in");
  if (!hasExpireIn) {
    await knex.schema.alterTable("links", table => {
      table.dateTime("expire_in");
    });
  }
}

export async function down(): Promise<any> {
  return null;
}
