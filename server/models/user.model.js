const { ROLES } = require("../consts");

async function createUserTable(knex) {
  const hasTable = await knex.schema.hasTable("users");
  if (!hasTable) {
    await knex.schema.createTable("users", table => {
      table.increments("id").primary();
      table.string("apikey");
      table
        .boolean("banned")
        .notNullable()
        .defaultTo(false);
      table
        .integer("banned_by_id")
        .unsigned()
        .references("id")
        .inTable("users");
      table
        .string("email")
        .unique()
        .notNullable();
      table
        .enu("role", [ROLES.USER, ROLES.ADMIN])
        .notNullable()
        .defaultTo(ROLES.USER);
      table.string("password").notNullable();
      table.dateTime("reset_password_expires");
      table.string("reset_password_token");
      table.dateTime("change_email_expires");
      table.string("change_email_token");
      table.string("change_email_address");
      table.dateTime("verification_expires");
      table.string("verification_token");
      table
        .boolean("verified")
        .notNullable()
        .defaultTo(false);
      table.timestamps(false, true);
    });
  }
}

module.exports = {
  createUserTable
};