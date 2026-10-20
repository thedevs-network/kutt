async function up(knex) {
  // SQLite does not enforce VARCHAR lengths, so existing columns need no change.
  if (["sqlite3", "better-sqlite3"].includes(knex.client.config.client)) return;

  await knex.schema.alterTable("links", table => {
    table.text("target", "longtext").notNullable().alter();
  });
}

async function down() {
  // Keep the expanded column to preserve URLs longer than the original limit.
}

module.exports = {
  up,
  down
};
