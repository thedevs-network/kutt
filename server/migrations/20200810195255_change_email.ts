import * as Knex from "knex";
import * as models from "../models";

export async function up(knex: Knex): Promise<any> {
  models.TableName.setPrefix("");
  const hasChangeEmail = await knex.schema.hasColumn(
    "users",
    "change_email_token"
  );
  if (!hasChangeEmail) {
    await knex.schema.alterTable("users", table => {
      table.dateTime("change_email_expires");
      table.string("change_email_token");
      table.string("change_email_address");
    });
  }
}

export async function down(): Promise<any> {
  return null;
}
