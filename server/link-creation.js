const i18n = require("./i18n");
const { createHash, createHmac } = require("node:crypto");
const knex = require("./knex");
const env = require("./env");
const { CustomError } = require("./utils");

const RETENTION_MS = 24 * 60 * 60 * 1000;

async function run(req, operation) {
  const authorize = async db => {
    await require("./domain-access").lock(db);
    await require("./domain-access").request(db, req, req.body.fetched_domain?.id ?? null, "links:create");
  };
  const key = req.get("Idempotency-Key");
  if (key === undefined) return knex.transaction(async db => { await authorize(db); return operation(db); });
  if (!req.user || req.isHTML || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    throw new CustomError(i18n.t("messages.idempotency_key_requires_an_authenticated_json_request_and_8_128_safe"), 400);
  }
  const body = req.body;
  const { expire_in: ignoredLegacyExpiry, ...lifecycle } = req.linkLifecycle || {};
  const input = {
    target: body.target, customurl: body.customurl || null, description: body.description || null,
    password: body.password || null, reuse: body.reuse === true || body.reuse === "true",
    domain: body.fetched_domain?.uuid || "default", expire_in: req.linkExpiryInput || null,
    ...(Object.keys(lifecycle).length && { lifecycle })
  };
  // A keyed digest prevents offline guessing of short link passwords from a DB dump.
  const requestHash = createHmac("sha256", env.JWT_SECRET).update(JSON.stringify(input)).digest("hex");
  const match = { user_id: req.user.id, key_hash: createHash("sha256").update(key).digest("hex") };
  return knex.transaction(async db => {
    await authorize(db);
    await db("link_creation_requests").where({ user_id: req.user.id })
      .where("created_at", "<", Date.now() - RETENTION_MS).delete();
    // Reserving the key and inserting the link share one commit. A competing
    // request waits for that commit; a crashed/failed request leaves no reservation.
    await db("link_creation_requests").insert({
      ...match, request_hash: requestHash, created_at: Date.now()
    }).onConflict(["user_id", "key_hash"]).ignore();
    const row = await db("link_creation_requests").where(match).first();
    if (row.request_hash !== requestHash) {
      throw new CustomError(i18n.t("messages.idempotency_key_was_already_used_with_a_different_request"), 409);
    }
    if (row.response) {
      const link = await db("links").where({ uuid: row.link_uuid, user_id: req.user.id }).first();
      if (!link || link.deleted_at != null || link.banned || (req.apiTokenDomain !== undefined && link.domain_id !== req.apiTokenDomain)) {
        throw new CustomError(i18n.t("messages.the_original_link_is_no_longer_available_this_key_cannot_recreate"), 409);
      }
      return { data: JSON.parse(row.response), status: row.status, replayed: true };
    }
    const { count } = await db("link_creation_requests").where({ user_id: req.user.id }).count("* as count").first();
    if (Number(count) > 1000) throw new CustomError(i18n.t("messages.daily_idempotency_key_limit_reached"), 429);
    const result = await operation(db);
    await db("link_creation_requests").where(match).update({
      link_uuid: result.data.id, response: JSON.stringify(result.data), status: result.status
    });
    return result;
  });
}

module.exports = { run };
