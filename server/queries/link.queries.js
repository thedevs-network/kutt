const bcrypt = require("bcryptjs");

const CustomError = require("../utils").CustomError;
const redis = require("../redis");
const knex = require("../knex");

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
  "domains.address as domain"
];

function normalizeMatch(match) {
  const newMatch = { ...match };

  if (newMatch.address) {
    newMatch["links.address"] = newMatch.address;
    delete newMatch.address;
  }

  if (newMatch.user_id) {
    newMatch["links.user_id"] = newMatch.user_id;
    delete newMatch.user_id;
  }

  if (newMatch.uuid) {
    newMatch["links.uuid"] = newMatch.uuid;
    delete newMatch.uuid;
  }

  return newMatch;
}

async function total(match, params) {
  let query = knex("links");

  Object.entries(normalizeMatch(match)).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  if (params?.search) {
    query.andWhereRaw(
      "concat_ws(' ', description, links.address, target, domains.address) ILIKE '%' || ? || '%'",
      [params.search]
    );
  }
  query.leftJoin("domains", "links.domain_id", "domains.id");
  query.count("links.id");
  
  const [{ count }] = await query;

  return typeof count === "number" ? count : parseInt(count);
}

async function get(match, params) {
  const query = knex("links")
    .select(...selectable)
    .where(normalizeMatch(match))
    .offset(params.skip)
    .limit(params.limit)
    .orderBy("links.created_at", "desc");
  
  if (params?.search) {
    query.andWhereRaw(
      "concat_ws(' ', description, links.address, target, domains.address) ILIKE '%' || ? || '%'",
      [params.search]
    );
  }
  
  query.leftJoin("domains", "links.domain_id", "domains.id");

  return query;
}

async function find(match) {
  if (match.address && match.domain_id) {
    const key = redis.key.link(match.address, match.domain_id);
    const cachedLink = await redis.client.get(key);
    if (cachedLink) return JSON.parse(cachedLink);
  }
  
  const link = await knex("links")
    .select(...selectable)
    .where(normalizeMatch(match))
    .leftJoin("domains", "links.domain_id", "domains.id")
    .first();
  
  if (link) {
    const key = redis.key.link(link.address, link.domain_id);
    redis.client.set(key, JSON.stringify(link), "EX", 60 * 60 * 2);
  }
  
  return link;
}

async function create(params) {
  let encryptedPassword = null;
  
  if (params.password) {
    const salt = await bcrypt.genSalt(12);
    encryptedPassword = await bcrypt.hash(params.password, salt);
  }
  
  const [link] = await knex(
    "links"
  ).insert(
    {
      password: encryptedPassword,
      domain_id: params.domain_id || null,
      user_id: params.user_id || null,
      address: params.address,
      description: params.description || null,
      expire_in: params.expire_in || null,
      target: params.target
    },
    "*"
  );
  
  return link;
}

async function remove(match) {
  const link = await knex("links").where(match).first();
  
  if (!link) {
    return { isRemoved: false, error: "Could not find the link.", link: null }
  }

  const deletedLink = await knex("links").where("id", link.id).delete();
  redis.remove.link(link);
  
  return { isRemoved: !!deletedLink, link };
}

async function batchRemove(match) {
  const deleteQuery = knex("links");
  const findQuery = knex("links");
  
  Object.entries(match).forEach(([key, value]) => {
    findQuery.andWhere(key, ...(Array.isArray(value) ? value : [value]));
    deleteQuery.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });
  
  const links = await findQuery;
  
  links.forEach(redis.remove.link);
  
  await deleteQuery.delete();
}

async function update(match, update) {
  if (update.password) {
    const salt = await bcrypt.genSalt(12);
    update.password = await bcrypt.hash(update.password, salt);
  }
  
  await knex("links")
    .where(match)
    .update({ ...update, updated_at: new Date().toISOString() });

  const links = await knex("links")
    .select('*')
    .where(match);

  links.forEach(redis.remove.link);
  
  return links;
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
  incrementVisit,
  remove,
  total,
  update,
}
