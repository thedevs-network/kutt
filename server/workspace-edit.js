const i18n = require("./i18n");
const { createHmac, timingSafeEqual } = require("node:crypto");
const env = require("./env");
const { CustomError } = require("./utils");

// Opaque edit state, not a counter: personal edits must invalidate workspace
// drafts too. Visit counts and worker timestamps deliberately do not.
function revision(link) {
  const fields = ["uuid", "user_id", "domain_id", "archived_domain", "address", "target",
    "description", "password", "paused", "starts_at", "ends_at", "max_visits", "expire_in", "deleted_at", "banned"];
  const value = fields.map(field => [field, link[field] ?? null]);
  return createHmac("sha256", env.JWT_SECRET).update("workspace-link-edit-v1\0" + JSON.stringify(value)).digest("hex");
}

function check(link, expected) {
  if (expected === undefined) return; // Legacy partial-update API compatibility.
  if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected)) {
    throw new CustomError(i18n.t("messages.reload_the_editor_before_saving_this_link"), 409);
  }
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(revision(link)))) {
    const error = new CustomError(i18n.t("messages.this_link_changed_elsewhere_review_the_saved_values_and_your_draft"), 409);
    error.workspaceEditConflict = true;
    throw error;
  }
}

function draft(body) {
  const result = {};
  for (const key of ["target", "address", "description", "starts_at", "ends_at", "max_visits"]) {
    if (typeof body[key] === "string") result[key] = body[key].slice(0, 2040);
  }
  result.paused = body.paused === "on" || body.paused === "true";
  result.clear_password = body.clear_password === "on";
  result.password_reentry = typeof body.password === "string" && body.password.length > 0;
  return result;
}

module.exports = { revision, check, draft };
