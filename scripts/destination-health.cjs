// Private SQLite operator probe. No targets, identifiers, tokens or secrets leave
// this process. A failed read must be alerted on, never converted to zero counts.
const Database = require("better-sqlite3");
function read(filename, now = Date.now()) {
  const db = new Database(filename, { readonly: true, fileMustExist: true });
  try {
    const worker = db.prepare("SELECT heartbeat_at FROM health_worker WHERE id=1").get();
    if (!worker) throw new Error("Missing health worker record");
    const row = db.prepare(`SELECT COUNT(*) enabled,
      COALESCE(SUM(CASE WHEN h.state IN ('attention','configuration_invalid','authorization_required') OR h.auth_version<>u.auth_version OR u.banned=1 OR u.verified=0 THEN 1 ELSE 0 END),0) attention,
      COALESCE(SUM(CASE WHEN h.next_at<? AND (h.lease IS NULL OR h.lease_until<=?) THEN 1 ELSE 0 END),0) overdue
      FROM link_health h JOIN users u ON u.id=h.user_id WHERE h.enabled=1`).get(now - 900000, now);
    return { worker_age_seconds: worker.heartbeat_at == null ? -1 : Math.max(0, Math.floor((now - Number(worker.heartbeat_at)) / 1000)), ...row };
  } finally { db.close(); }
}
if (require.main === module) {
  try {
    require("dotenv").config();
    require("../server/env-files")(["DB_CLIENT", "DB_FILENAME"]);
    if (process.env.DB_CLIENT && !["sqlite3", "better-sqlite3"].includes(process.env.DB_CLIENT)) throw new Error("SQLite required");
    if (!process.env.DB_FILENAME) throw new Error("DB_FILENAME required");
    console.log(JSON.stringify(read(process.env.DB_FILENAME)));
  } catch { console.error("Destination monitoring status unavailable"); process.exitCode = 1; }
}
module.exports = read;
