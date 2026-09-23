const i18n = require("./i18n");
const knex = require("./knex");
const { CustomError } = require("./utils");
const { rateLimit } = require("./handlers/helpers.handler");

// One budget across Basic GET/HEAD and both public password-form API aliases.
// Keep this security boundary even when optional management throttles are off.
const guard = rateLimit({ window: 60, limit: 10, always: true,
  key: req => "protected-link:" + req.protectedLinkId });
async function attempt(req, res, link) {
  req.protectedLinkId = link.id;
  await new Promise((resolve, reject) => guard(req, res, error => error ? reject(error) : resolve()));
}
async function available(link) {
  if (link.banned || link.deleted_at || link.archived_domain) return false;
  if (link.domain_id == null) return true;
  return !!await knex("domains").where({ id: link.domain_id, banned: false }).first();
}
async function requireAvailable(link) {
  if (!await available(link)) throw new CustomError(i18n.t("ui.this_short_link_is_not_currently_available"), 410);
}
module.exports = { attempt, available, requireAvailable };
