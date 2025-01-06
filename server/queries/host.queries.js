const redis = require("../redis");
const utils = require("../utils");
const knex = require("../knex");
const env = require("../env");

async function find(match) {
  if (match.address && env.REDIS_ENABLED) {
    const cachedHost = await redis.client.get(redis.key.host(match.address));
    if (cachedHost) return JSON.parse(cachedHost);
  }

  const host = await knex("hosts")
    .where(match)
    .first();

  if (host && env.REDIS_ENABLED) {
    const key = redis.key.host(host.address);
    redis.client.set(key, JSON.stringify(host), "EX", 60 * 15);
  }

  return host;
}

async function add(params) {
  params.address = params.address.toLowerCase();

  const existingHost = await knex("hosts").where("address", params.address).first();

  let id = existingHost?.id;

  const newHost = {
    address: params.address,
    banned: !!params.banned,
    banned_by_id: params.banned_by_id,
  };

  if (id) {
    await knex("hosts").where("id", id).update({
      ...newHost,
      updated_at: params.updated_at || utils.dateToUTC(new Date())
    });
  } else {
    // Mysql and sqlite don't support returning but return the inserted id by default
    const [createdHost] = await knex("hosts").insert(newHost, "*");
    id = typeof createdHost === "number" ? createdHost : createdHost.id;
  }

  // Query domain instead of using returning as sqlite and mysql don't support it
  const host = await knex("hosts").where("id", id);

  if (env.REDIS_ENABLED) {
    redis.remove.host(host);
  }

  return host;
}

module.exports = {
  add,
  find,
}
