const redis = require("../redis");
const utils = require("../utils");
const knex = require("../knex");
const env = require("../env");

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

async function add(params) {
  params.address = params.address.toLowerCase();

  const existingDomain = await knex("domains").where("address", params.address).first();

  let id = existingDomain?.id;

  const newDomain = {
    address: params.address,
    homepage: params.homepage,
    user_id: params.user_id,
    banned: !!params.banned,
    banned_by_id: params.banned_by_id
  };

  if (id) {
    await knex("domains").where("id", id).update({
      ...newDomain,
      updated_at: params.updated_at || utils.dateToUTC(new Date())
    });
  } else {
    // Mysql and sqlite don't support returning but return the inserted id by default
    const [createdDomain] = await knex("domains").insert(newDomain, "*");
    id = typeof createdDomain === "number" ? createdDomain : createdDomain.id;
  }

  // Query domain instead of using returning as sqlite and mysql don't support it
  const domain = await knex("domains").where("id", id).first();

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
  
  await knex("domains")
    .where(match)
    .update({ ...update, updated_at: utils.dateToUTC(new Date()) });

  const updated_domains = await knex("domains").select("*").where(match);

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
    .orderBy("domains.id", "desc")
    .groupBy(1)
    .groupBy("l.links_count")
    .groupBy("users.email");

  if (params?.user) {
    const id = parseInt(params?.user);
    if (Number.isNaN(id)) {
      query[knex.compatibleILIKE]("users.email", "%" + params.user + "%");
    } else {
      query.andWhere("domains.user_id", id);
    }
  }

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
  
  if (params?.user) {
    const id = parseInt(params?.user);
    if (Number.isNaN(id)) {
      query[knex.compatibleILIKE]("users.email", "%" + params.user + "%");
      } else {
      query.andWhere("domains.user_id", id);
    }
  }

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

async function remove(domain) {
  const deletedDomain = await knex("domains").where("id", domain.id).delete();
  
  if (env.REDIS_ENABLED) {
    redis.remove.domain(domain);
  }
  
  return !!deletedDomain;
}

module.exports = {
  add,
  find,
  get,
  getAdmin,
  remove,
  totalAdmin,
  update,
}