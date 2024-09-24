const redis = require("../redis");
const knex = require("../knex");

async function find(match) {
  if (match.address) {
    const cachedHost = await redis.client.get(redis.key.host(match.address));
    if (cachedHost) return JSON.parse(cachedHost);
  }

  const host = await knex("hosts")
    .where(match)
    .first();

  if (host) {
    redisClient.set(
      redis.key.host(host.address),
      JSON.stringify(host),
      "EX",
      60 * 60 * 6
    );
  }

  return host;
}

async function add(params) {
  params.address = params.address.toLowerCase();

  const existingHost = await knex("hosts")
    .where("address", params.address)
    .first();

  let id = existingHost?.id;

  const newHost = {
    address: params.address,
    banned: !!params.banned,
    banned_by_id: params.banned_by_id,
  };

  if (id) {
    await knex("hosts")
      .where("id", id)
      .update({
          ...newHost,
          updated_at: params.updated_at || new Date().toISOString()
      });
  } else {
    // Mysql and sqlite don't support returning but return the inserted id by default
    const [createdHost] = await knex("hosts").insert(newHost).returning("id");
    id = createdHost.id;
  }

  // Query domain instead of using returning as sqlite and mysql don't support it
  const host = await knex("hosts")
    .where("id", id);

  redis.remove.host(host);

  return host;
}

module.exports = {
  add,
  find,
}
