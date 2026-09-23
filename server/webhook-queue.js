const i18n = require("./i18n");
const { CustomError } = require("./utils");
const LIMITS = Object.freeze({ ownerPending: 2000, globalPending: 10000, ownerPerMinute: 1000, globalPerMinute: 5000 });

// A real write serializes admission on SQLite and row-locking databases alike.
// Callers retain this lock through their event/delivery transaction commit.
async function lock(db) {
  const changed = await db("webhook_queue_state").where({ id: 1 }).increment("sequence", 1);
  if (!changed) throw new Error(i18n.t("messages.webhook_queue_state_is_unavailable"));
  return db("webhook_queue_state").where({ id: 1 }).forUpdate().first();
}
async function owner(db, userId) {
  const existing = await db("webhook_queue_owners").where({ user_id: userId }).forUpdate().first();
  if (existing) return existing;
  await db("webhook_queue_owners").insert({ user_id: userId });
  return db("webhook_queue_owners").where({ user_id: userId }).forUpdate().first();
}
async function admit(db, userId, count, now = Date.now()) {
  if (!count) return;
  const global = await lock(db), user = await owner(db, userId);
  // Current (locking) reads matter when the caller already opened a MySQL
  // repeatable-read snapshot. An old snapshot must not admit beyond the caps.
  const pending = await db("webhook_deliveries as d").join("webhooks as h", "h.id", "d.webhook_id")
    .whereIn("d.state", ["pending", "delivering"]).select("d.id", "h.user_id").limit(LIMITS.globalPending + 1).forUpdate();
  const total = pending.length, own = pending.filter(row => row.user_id === userId).length;
  const recent = row => now - Number(row.window_start) < 60000;
  const totalAdmitted = recent(global) ? Number(global.admitted) : 0;
  const ownAdmitted = recent(user) ? Number(user.admitted) : 0;
  if (own + count > LIMITS.ownerPending || total + count > LIMITS.globalPending ||
    ownAdmitted + count > LIMITS.ownerPerMinute || totalAdmitted + count > LIMITS.globalPerMinute) {
    const error = new CustomError(i18n.t("messages.webhook_delivery_capacity_reached_retry_later_or_disable_the_backed_up"), 429);
    error.code = "WEBHOOK_CAPACITY";
    throw error;
  }
  await db("webhook_queue_state").where({ id: 1 }).update({ admitted: totalAdmitted + count, window_start: recent(global) ? global.window_start : now });
  await db("webhook_queue_owners").where({ user_id: userId }).update({ admitted: ownAdmitted + count, window_start: recent(user) ? user.window_start : now });
}
module.exports = { LIMITS, lock, owner, admit };
