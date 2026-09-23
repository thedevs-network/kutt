const i18n = require("../i18n");
const redis = require("../redis");
const utils = require("../utils");
const knex = require("../knex");
const env = require("../env");
const filterAdminUser = require("./admin-user-filter");

async function find(match) {
  if (match.address && env.REDIS_ENABLED) {
    const cachedDomain = await redis.client.get(redis.key.domain(match.address));
    if (cachedDomain) return JSON.parse(cachedDomain);
  }

  const domain = await knex("domains").where(match).first();

  if (domain && env.REDIS_ENABLED) {
    const key = redis.key.domain(domain.address);
    redis.client.set(key, JSON.stringify(domain), "EX", 60 * 15);
  }

  return domain;
}

function get(match) {
  return knex("domains").where(match);
}

// Claims must not overwrite an owner or a ban acquired while DNS was checked.
async function claim({ address, homepage, user }) {
  address = address.toLowerCase();
  if (require("../management-origin").reserved(address)) throw new utils.CustomError(i18n.t("domain_grants.management_reserved"), 400);
  const domain = await knex.transaction(async db => {
    await require("../domain-access").lock(db);
    const current = await db("users").where({ id: user.id }).forUpdate().first();
    if (!current || current.banned || !current.verified || Number(current.auth_version) !== Number(user.auth_version)) {
      throw new utils.CustomError(i18n.t("messages.sign_in_again"), 401);
    }
    await db("domains").insert({ address, user_id: null, banned: false }).onConflict("address").ignore();
    const changed = await db("domains").where({ address, user_id: null, banned: false })
      .update({ user_id: user.id, homepage, updated_at: utils.dateToUTC(new Date()) });
    if (!changed) throw new utils.CustomError(i18n.t("messages.domain_is_already_owned_or_unavailable"), 409);
    const claimed = await db("domains").where({ address, user_id: user.id }).first();
    await require("../domain-access").invalidate(db, claimed);
    return claimed;
  });
  if (env.REDIS_ENABLED) redis.remove.domain(domain);
  return domain;
}

async function release(id, userId, user) {
  const domain = await knex.transaction(async db => {
    await require("../domain-access").lock(db);
    if (user) await require("../domain-access").request(db, { user }, null);
    const changed = await db("domains").where({ id, user_id: userId }).update({ user_id: null, updated_at: utils.dateToUTC(new Date()) });
    const released = changed ? await db("domains").where({ id }).first() : null;
    if (released) await require("../domain-access").invalidate(db, released);
    return released;
  });
  if (domain && env.REDIS_ENABLED) redis.remove.domain(domain);
  return domain;
}

async function add(params) {
  params.address = params.address.toLowerCase();
  if (require("../management-origin").reserved(params.address)) throw new utils.CustomError(i18n.t("domain_grants.management_reserved"), 400);
  let existingDomain;
  const domain = await knex.transaction(async db => {
    await require("../domain-access").lock(db);
    existingDomain = await db("domains").where("address", params.address).first();
    const fields = { address: params.address, homepage: params.homepage, user_id: params.user_id,
      banned: !!params.banned, banned_by_id: params.banned_by_id };
    if (existingDomain) {
      if (fields.banned || fields.user_id !== existingDomain.user_id) await require("../domain-access").invalidate(db, existingDomain);
      await db("domains").where({ id: existingDomain.id }).update({ ...fields, updated_at: params.updated_at || utils.dateToUTC(new Date()) });
    } else await db("domains").insert(fields);
    return db("domains").where({ address: params.address }).first();
  });

  if (env.REDIS_ENABLED) {
    redis.remove.domain(existingDomain);
    redis.remove.domain(domain);
  }

  return domain;
}

async function update(match, update) {
  // if the domains' adddress is changed,
  // make sure to delete the original domains from cache 
  let domains = []
  if (env.REDIS_ENABLED && update.address) {
    domains = await knex("domains").select("*").where(match);
  }
  
  if (update.address && require("../management-origin").reserved(update.address)) throw new utils.CustomError(i18n.t("domain_grants.management_reserved"), 400);
  const updated_domains = await knex.transaction(async db => {
    await require("../domain-access").lock(db);
    const rows = await db("domains").where(match);
    for (const row of rows) {
      if (update.banned === true || update.user_id !== undefined && update.user_id !== row.user_id || update.address && update.address !== row.address) {
        await require("../domain-access").invalidate(db, row);
      }
    }
    await db("domains").where(match).update({ ...update, updated_at: utils.dateToUTC(new Date()) });
    return db("domains").whereIn("id", rows.map(row => row.id));
  });

  if (env.REDIS_ENABLED) {
    domains.forEach(redis.remove.domain);
    updated_domains.forEach(redis.remove.domain);
  }

  return updated_domains;
}

function normalizeMatch(match) {
  const newMatch = { ...match };

  if (newMatch.address) {
    newMatch["domains.address"] = newMatch.address;
    delete newMatch.address;
  }

  if (newMatch.user_id) {
    newMatch["domains.user_id"] = newMatch.user_id;
    delete newMatch.user_id;
  }

  if (newMatch.uuid) {
    newMatch["domains.uuid"] = newMatch.uuid;
    delete newMatch.uuid;
  }

  if (newMatch.banned !== undefined) {
    newMatch["domains.banned"] = newMatch.banned;
    delete newMatch.banned;
  }

  return newMatch;
}


const selectable_admin = [
  "domains.id",
  "domains.address",
  "domains.homepage",
  "domains.banned",
  "domains.created_at",
  "domains.updated_at",
  "domains.user_id",
  "domains.uuid",
  "users.email as email",
  "links_count"
];


async function getAdmin(match, params) {
  const query = knex("domains").select(...selectable_admin);

  Object.entries(normalizeMatch(match)).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  query
    .offset(params.skip)
    .limit(params.limit)
    .fromRaw("domains")
    .groupBy(1)
    .groupBy("l.links_count")
    .groupBy("users.email");
  require("../list-sort").apply(query, params, "domains");

  filterAdminUser(query, "domains.user_id", params?.user);

  if (params?.search) {
    query[knex.compatibleILIKE](
      knex.raw("concat_ws(' ', domains.address, domains.homepage)"),
      "%" + params.search + "%"
    );
  }

  if (params?.links !== undefined) {
    query.andWhere("links_count", params?.links ? "is not" : "is", null);
  }

  query.leftJoin(
    knex("links").select("domain_id").count("* as links_count").groupBy("domain_id").as("l"),
    "domains.id",
    "l.domain_id"
  );

  query.leftJoin("users", "domains.user_id", "users.id");

  return query;
}

async function totalAdmin(match, params) {
  const query = knex("domains");

  Object.entries(normalizeMatch(match)).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });
  
  filterAdminUser(query, "domains.user_id", params?.user);

  if (params?.search) {
    query[knex.compatibleILIKE](
      knex.raw("concat_ws(' ', domains.address, domains.homepage)"),
      "%" + params.search + "%"
    );
  }

  if (params?.links !== undefined) {
    query.leftJoin(
      knex("links").select("domain_id").count("* as links_count").groupBy("domain_id").as("l"),
      "domains.id",
      "l.domain_id"
    );
    query.andWhere("links_count", params?.links ? "is not" : "is", null);
  }

  query.leftJoin("users", "domains.user_id", "users.id");
  query.count("* as count");

  const [{ count }] = await query;

  return typeof count === "number" ? count : parseInt(count);
}

async function remove(domain, { trashLinks = false, actor = {} } = {}) {
  const deletedDomain = await knex.transaction(async db => {
    await require("../domain-access").lock(db);
    if (actor.auth_version !== undefined) await require("../moderation").lock(db, actor);
    await require("../domain-access").invalidate(db, domain);
    const links = await db("links").where({ domain_id: domain.id });
    if (links.some(link => link.deleted_at == null) && !trashLinks) {
      throw new utils.CustomError(i18n.t("messages.this_domain_has_active_links_select_link_deletion_to_move_them"), 409);
    }
    for (const link of links) {
      await require("../link-history").trash(db, link, actor);
      await require("../link-history").record(db, link, "domain_removed", [], actor);
      await db("links").where({ id: link.id }).update({ archived_domain: domain.address, domain_id: null });
    }
    return db("domains").where("id", domain.id).delete();
  });
  
  if (env.REDIS_ENABLED) {
    redis.remove.domain(domain);
  }
  
  return !!deletedDomain;
}

module.exports = {
  add,
  claim,
  release,
  find,
  get,
  getAdmin,
  remove,
  totalAdmin,
  update,
}
