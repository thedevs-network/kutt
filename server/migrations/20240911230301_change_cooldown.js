async function up(knex) {
  await knex.schema.alterTable("users", table => {
    table.dropColumn("cooldowns");
    table.datetime("cooldown").nullable();
    table.integer("malicious_attempts").defaultTo(0);
  });
}

async function down(knex) {
  await knex.schema.alterTable("users", table => {
    table.dropColumn("cooldown");
    table.json("cooldowns").defaultTo("[]");
    table.dropColumn("malicious_attempts");
  });
}

module.exports = {
  up,
  down
};

