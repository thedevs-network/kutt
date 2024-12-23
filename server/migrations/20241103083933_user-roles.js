const { ROLES } = require("../consts");

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function up(knex) {
  const hasRole = await knex.schema.hasColumn("users", "role");
  if (!hasRole) {
    await knex.transaction(async function(trx) {
      await trx.schema.alterTable("users", table => {
        table
          .enu("role", [ROLES.USER, ROLES.ADMIN])
          .notNullable()
          .defaultTo(ROLES.USER);
      });
      if (typeof process.env.ADMIN_EMAILS === "string") {
        const adminEmails = process.env.ADMIN_EMAILS.split(",").map((e) => e.trim());
        const adminRoleQuery = trx("users").update("role", ROLES.ADMIN);
        adminEmails.forEach((adminEmail, index) => {
          if (index === 0) {
            adminRoleQuery.where("email", adminEmail);
          } else {
            adminRoleQuery.orWhere("email", adminEmail);
          }
        });
        await adminRoleQuery;
      }
    });
  }
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
async function down(knex) {};

module.exports = {
  up,
  down,
}
