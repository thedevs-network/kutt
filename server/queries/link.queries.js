const bcrypt = require("bcryptjs");

const utils = require("../utils");
const redis = require("../redis");
const knex = require("../knex");
const env = require("../env");

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
  "domains.address as domain"
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

  if (newMatch.user_id) {
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

  Object.entries(normalizeMatch(match)).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });
  
  if (params?.user) {
    const id = parseInt(params?.user);
    if (Number.isNaN(id)) {
      query[knex.compatibleILIKE]("users.email", "%" + params.user + "%");
      } else {
      query.andWhere("links.user_id", params.user);
    }
  }

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
    .limit(params.limit)
    .orderBy("links.id", "desc");
  
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

  Object.entries(normalizeMatch(match)).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  query
    .orderBy("links.id", "desc")
    .offset(params.skip)
    .limit(params.limit)
  
  if (params?.user) {
    const id = parseInt(params?.user);
    if (Number.isNaN(id)) {
      query[knex.compatibleILIKE]("users.email", "%" + params.user + "%");
    } else {
      query.andWhere("links.user_id", params.user);
    }
  }

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

async function find(match) {
  if (match.address && match.domain_id !== undefined && env.REDIS_ENABLED) {
    const key = redis.key.link(match.address, match.domain_id);
    const cachedLink = await redis.client.get(key);
    if (cachedLink) return JSON.parse(cachedLink);
  }
  
  const link = await knex("links")
    .select(...selectable)
    .where(normalizeMatch(match))
    .leftJoin("domains", "links.domain_id", "domains.id")
    .first();
  
  if (link && env.REDIS_ENABLED) {
    const key = redis.key.link(link.address, link.domain_id);
    redis.client.set(key, JSON.stringify(link), "EX", 60 * 15);
  }
  
  return link;
}

async function create(params) {
  let encryptedPassword = null;
  
  if (params.password) {
    const salt = await bcrypt.genSalt(12);
    encryptedPassword = await bcrypt.hash(params.password, salt);
  }
  
  let [link] = await knex(
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

  // mysql doesn't return the whole link, but rather the id number only
  // so we need to fetch the link ourselves
  if (typeof link === "number") {
    link = await knex("links").where("id", link).first();
  }

  return link;
}

async function remove(match) {
  const link = await knex("links").where(match).first();
  
  if (!link) {
    return { isRemoved: false, error: "Could not find the link.", link: null }
  }

  const deletedLink = await knex("links").where("id", link.id).delete();

  if (env.REDIS_ENABLED) {
    redis.remove.link(link);
  }
  
  return { isRemoved: !!deletedLink, link };
}

async function batchRemove(match) {
  const query = knex("links");
  
  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });
  
  const links = await query.clone();
  
  await query.delete();
  
  if (env.REDIS_ENABLED) {
    links.forEach(redis.remove.link);
  }
}

async function update(match, update) {
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
  
  await knex("links")
    .where(match)
    .update({ ...update, updated_at: utils.dateToUTC(new Date()) });

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
