const i18n = require("./i18n");
const { createHmac, timingSafeEqual } = require("node:crypto");
const env = require("./env");

const expiry = link => link.expire_in ? require("./utils").parseDatetime(link.expire_in).toISOString() : null;
const sign = value => createHmac("sha256", env.JWT_SECRET).update("link-expiry-edit-v1\0" + value).digest("hex");

function snapshot(link, input) {
  const data = Buffer.from(JSON.stringify({ id: link.uuid, expiry: expiry(link), input: input || "" })).toString("base64url");
  return data + "." + sign(data);
}

function read(value, id) {
  const fail = () => { throw new (require("./utils").CustomError)(i18n.t("messages.reload_the_editor_before_changing_expiry"), 409); };
  if (typeof value !== "string" || value.length > 2048) return fail();
  const [data, signature, extra] = value.split(".");
  if (extra !== undefined || !/^[a-zA-Z0-9_-]+$/.test(data) || !/^[a-f0-9]{64}$/.test(signature || "") ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(sign(data)))) return fail();
  let state;
  try { state = JSON.parse(Buffer.from(data, "base64url").toString()); } catch { return fail(); }
  if (state.id !== id || typeof state.input !== "string" || !(state.expiry === null || typeof state.expiry === "string")) return fail();
  return state;
}

// A relative duration is an instruction, not a stored timestamp. Only changed
// browser input may issue it again; API clients retain their existing semantics.
async function prepare(req, res, next) {
  if (req.isHTML) {
    const link = await require("./queries").link.find({ uuid: req.params.id, ...(!req.user.admin && { user_id: req.user.id }) }, { fresh: true });
    if (!link) throw new (require("./utils").CustomError)(i18n.t("messages.link_was_not_found"), 404);
    res.locals.expire_in = expiry(link);
    res.locals.relative_expire_in = req.body.expire_in;
    res.locals.expiry_snapshot = req.body.expiry_snapshot;
    if (req.body.expire_in) {
      const state = read(req.body.expiry_snapshot, req.params.id);
      if (typeof req.body.expire_in === "string" && req.body.expire_in.trim() === state.input.trim()) delete req.body.expire_in;
      else req.expiryExpected = state.expiry;
    }
  }
  next();
}

async function save(req, res, link, values) {
  try {
    const [updated] = await require("./queries").link.update({ id: link.id, uuid: link.uuid, user_id: link.user_id ?? null, deleted_at: null,
      ...(req.apiTokenDomain !== undefined && { domain_id: req.apiTokenDomain, archived_domain: null }) }, values,
      { id: req.user.id, apiToken: req.apiToken }, { expiryExpected: req.expiryExpected, request: req });
    if (!updated) throw new (require("./utils").CustomError)(i18n.t("messages.link_changed_ownership_or_is_no_longer_available_reload_the_editor"), 409);
    return updated;
  } catch (error) {
    if (req.isHTML && error.statusCode === 409) {
      const current = await require("./queries").link.find({ uuid: link.uuid, ...(!req.user.admin && { user_id: req.user.id }) }, { fresh: true });
      if (current) {
        const view = require("./utils").sanitize.link_html(current);
        // Refresh only conflict metadata, never another form or its drafts.
        res.locals.expire_in = view.expire_in;
        res.locals.expiry_snapshot = view.expiry_snapshot;
      }
    }
    throw error;
  }
}

function check(link, expected) {
  if (expected !== undefined && expiry(link) !== expected) {
    throw new (require("./utils").CustomError)(i18n.t("messages.expiry_changed_elsewhere_review_the_current_expiry_then_save_again_to"), 409);
  }
}

module.exports = { snapshot, read, prepare, check, save };
