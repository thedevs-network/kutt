async function up(knex) {

  const hasCooldowns = await knex.schema.hasColumn("users", "cooldowns");
  if (hasCooldowns) {
    await knex.schema.alterTable("users", table => {
      table.dropColumn("cooldowns");
    });
  }

  const hasCooldown = await knex.schema.hasColumn("users", "cooldown");
  if (!hasCooldown) {
    await knex.schema.alterTable("users", table => {
      table.datetime("cooldown").nullable();
    });
  }

  const hasMaliciousAttempts = await knex.schema.hasColumn("users", "malicious_attempts");
  if (!hasMaliciousAttempts) {
    await knex.schema.alterTable("users", table => {
      table.integer("malicious_attempts").notNullable().defaultTo(0);
    });
  }
}

async function down(knex) {}

module.exports = {
  up,
  down
};

