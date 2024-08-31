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
};

async function add(params) {
  params.address = params.address.toLowerCase();

  const exists = await knex("hosts")
    .where("address", params.address)
    .first();

  const newHost = {
    address: params.address,
    banned: !!params.banned
  };

  let host;
  if (exists) {
    const [response] = await knex("hosts")
      .where("id", exists.id)
      .update(
        {
          ...newHost,
          updated_at: params.updated_at || new Date().toISOString()
        },
        "*"
      );
    host = response;
  } else {
    const [response] = await knex("hosts").insert(newHost, "*");
    host = response;
  }

  redis.remove.host(host);

  return host;
};

module.exports = {
  add,
  find,
}
