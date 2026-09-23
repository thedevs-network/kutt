const i18n = require("../i18n");
const bcrypt = require("bcryptjs");

const utils = require("../utils");
const redis = require("../redis");
const knex = require("../knex");
const env = require("../env");
const history = require("../link-history");
const filterAdminUser = require("./admin-user-filter");
const sorting = require("../list-sort");

const CustomError = utils.CustomError;

const selectable = [
  "links.id",
  "links.address",
  "links.banned",
  "links.created_at",
  "links.domain_id",
  "links.updated_at",
  "links.password",
  "links.description",
  "links.expire_in",
  "links.target",
  "links.visit_count",
  "links.user_id",
  "links.uuid",
  "links.paused",
  "links.starts_at",
  "links.ends_at",
  "links.max_visits",
  "links.redirect_count",
  "links.deleted_at",
  "links.archived_domain",
  knex.raw("coalesce(domains.address, links.archived_domain) as domain")
];

const selectable_admin = [
  ...selectable,
  "users.email as email"
];

function normalizeMatch(match) {
  const newMatch = { ...match };

  if (newMatch.address) {
    newMatch["links.address"] = newMatch.address;
    delete newMatch.address;
  }

  if (Object.hasOwn(newMatch, "user_id")) {
    newMatch["links.user_id"] = newMatch.user_id;
    delete newMatch.user_id;
  }

  if (newMatch.id) {
    newMatch["links.id"] = newMatch.id;
    delete newMatch.id;
  }

  if (newMatch.uuid) {
    newMatch["links.uuid"] = newMatch.uuid;
    delete newMatch.uuid;
  }

  if (newMatch.banned !== undefined) {
    newMatch["links.banned"] = newMatch.banned;
    delete newMatch.banned;
  }

  return newMatch;
}

async function total(match, params) {
  const normalizedMatch = normalizeMatch(match);
  const query = knex("links");
  query[params?.trash ? "whereNotNull" : "whereNull"]("links.deleted_at");
  
  Object.entries(normalizedMatch).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  if (params?.search) {
    query[knex.compatibleILIKE](
      knex.raw("concat_ws(' ', description, links.address, target, domains.address)"), 
      "%" + params.search + "%"
    );
  }
  query.leftJoin("domains", "links.domain_id", "domains.id");
  query.count("* as count");
  
  const [{ count }] = await query;

  return typeof count === "number" ? count : parseInt(count);
}

async function totalAdmin(match, params) {
  const query = knex("links");
  query.whereNull("links.deleted_at");

  Object.entries(normalizeMatch(match)).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });
  
  filterAdminUser(query, "links.user_id", params?.user);

  if (params?.search) {
    query[knex.compatibleILIKE](
      knex.raw("concat_ws(' ', description, links.address, target)"),
      "%" + params.search + "%"
    );
  }

  if (params?.domain) {
    query[knex.compatibleILIKE]("domains.address", "%" + params.domain + "%");
  }
  
  query.leftJoin("domains", "links.domain_id", "domains.id");
  query.leftJoin("users", "links.user_id", "users.id");
  query.count("* as count");

  const [{ count }] = await query;

  return typeof count === "number" ? count : parseInt(count);
}

async function get(match, params) {
  const query = knex("links")
    .select(...selectable)
    .where(normalizeMatch(match))
    .offset(params.skip)
    .limit(params.limit);
  sorting.apply(query, params);
  query[params?.trash ? "whereNotNull" : "whereNull"]("links.deleted_at");
  
  if (params?.search) {
    query[knex.compatibleILIKE](
      knex.raw("concat_ws(' ', description, links.address, target, domains.address)"), 
      "%" + params.search + "%"
    );
  }
  
  query.leftJoin("domains", "links.domain_id", "domains.id");

  return query;
}

async function getAdmin(match, params) {
  const query = knex("links").select(...selectable_admin);
  query.whereNull("links.deleted_at");

  Object.entries(normalizeMatch(match)).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  sorting.apply(query, params);
  query
    .offset(params.skip)
    .limit(params.limit)
  
  filterAdminUser(query, "links.user_id", params?.user);

  if (params?.search) {
    query[knex.compatibleILIKE](
      knex.raw("concat_ws(' ', description, links.address, target)"),
      "%" + params.search + "%"
    );
  }

  if (params?.domain) {
    query[knex.compatibleILIKE]("domains.address", "%" + params.domain + "%");
  }
  
  query.leftJoin("domains", "links.domain_id", "domains.id");
  query.leftJoin("users", "links.user_id", "users.id");

  return query;
}

async function find(match, { fresh = false, includeTrash = false } = {}) {
  if (!fresh && !includeTrash && match.address && match.domain_id !== undefined && env.REDIS_ENABLED) {
    const key = redis.key.link(match.address, match.domain_id);
    const cachedLink = await redis.client.get(key);
    if (cachedLink) return JSON.parse(cachedLink);
  }
  
  const lookup = knex("links")
    .select(...selectable)
    .where(normalizeMatch(match))
    .leftJoin("domains", "links.domain_id", "domains.id")
    .first();
  if (!includeTrash) lookup.whereNull("links.deleted_at");
  if (match.address) lookup.whereNull("links.archived_domain");
  const link = await lookup;
  
  if (link && !fresh && env.REDIS_ENABLED) {
    const key = redis.key.link(link.address, link.domain_id);
    redis.client.set(key, JSON.stringify(link), "EX", 60 * 15);
  }
  
  return link;
}

async function create(params, db = knex, actor = {}) {
  if (!db.isTransaction) return knex.transaction(transaction => create(params, transaction, actor));
  await require("../domain-access").lock(db);
  await require("../domain-access").link(db, params);
  let encryptedPassword = null;
  
  if (params.password) {
    const salt = await bcrypt.genSalt(12);
    encryptedPassword = await bcrypt.hash(params.password, salt);
  }
  
  let [link] = await db(
    "links"
  ).insert(
    {
      password: encryptedPassword,
      domain_id: params.domain_id || null,
      user_id: params.user_id || null,
      address: params.address,
      description: params.description || null,
      expire_in: params.expire_in || null,
      paused: params.paused || false,
      starts_at: params.starts_at ?? null,
      ends_at: params.ends_at ?? null,
      max_visits: params.max_visits ?? null,
      target: params.target
    },
    "*"
  );

  // mysql doesn't return the whole link, but rather the id number only
  // so we need to fetch the link ourselves
  if (typeof link === "number") {
    link = await db("links").where("id", link).first();
  }

  await history.claim(db, link);
  await history.record(db, link, "created", [], actor);
  return link;
}

async function remove(match, actor = {}, request) {
  const link = await knex.transaction(async db => {
    await require("../domain-access").lock(db);
    const link = await db("links").where(match).first();
    if (link) {
      if (request) await require("../domain-access").writeLink(db, request, link, "links:delete");
      await history.trash(db, link, actor);
    }
    return link;
  });
  if (!link) return { isRemoved: false, error: i18n.t("messages.could_not_find_the_link"), link: null };

  if (env.REDIS_ENABLED) {
    redis.remove.link(link);
  }
  
  return { isRemoved: true, link };
}

async function batchRemove(match) {
  const query = knex("links");
  
  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });
  
  const links = await query.clone();
  
  await knex.transaction(async db => {
    for (const link of links) await history.trash(db, link);
  });
  
  if (env.REDIS_ENABLED) {
    links.forEach(redis.remove.link);
  }
}

async function update(match, update, actor = {}, { expiryExpected, request } = {}) {
  if (update.password) {
    const salt = await bcrypt.genSalt(12);
    update.password = await bcrypt.hash(update.password, salt);
  }

  // if the links' adddress or domain is changed,
  // make sure to delete the original links from cache 
  let links = []
  if (env.REDIS_ENABLED && (update.address || update.domain_id)) {
    links = await knex("links").select('*').where(match);
  }
  
  await knex.transaction(async db => {
    await require("../domain-access").lock(db);
    const selection = db("links").where(match);
    if ((expiryExpected !== undefined || update.target !== undefined) && !knex.client.config.client.includes("sqlite")) selection.forUpdate();
    const current = await selection;
    for (const link of current) {
      await require("../domain-access").link(db, link);
      await require("../domain-access").link(db, { ...link, ...update });
      if (request) await require("../domain-access").writeLink(db, request, link, "links:update");
    }
    for (const link of current) require("../link-expiry-edit").check(link, expiryExpected);
    for (const link of current) {
      if (update.target !== undefined && update.target !== link.target) require("../destination-policy").requireAllowed(update.target);
    }
    for (const link of current) await history.beforeUpdate(db, link, update, actor);
    await db("links").where(match).update({ ...update, updated_at: utils.dateToUTC(new Date()) });
  });

  const updated_links = await knex("links")
    .select(selectable)
    .where(normalizeMatch(match))
    .leftJoin("domains", "links.domain_id", "domains.id");
    
  if (env.REDIS_ENABLED) {
    links.forEach(redis.remove.link);
    updated_links.forEach(redis.remove.link);
  }
  
  return updated_links;
}

function incrementVisit(match) {
  return knex("links").where(match).increment("visit_count", 1);
}

module.exports = {
  normalizeMatch,
  batchRemove,
  create,
  find,
  get,
  getAdmin,
  incrementVisit,
  remove,
  total,
  totalAdmin,
  update,
}
