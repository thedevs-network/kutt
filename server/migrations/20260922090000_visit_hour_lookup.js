const name = "visits_link_utc_hour_index";
const sqlite = db => ["sqlite3", "better-sqlite3"].includes(db.client.config.client);

async function up(db) {
  if (sqlite(db)) await db.raw(`CREATE INDEX ?? ON ?? (??, strftime('%Y-%m-%d %H:00:00', ??))`, [name, "visits", "link_id", "created_at"]);
}

async function down(db) {
  if (sqlite(db)) await db.raw("DROP INDEX ??", [name]);
}

module.exports = { up, down };
