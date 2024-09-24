const redis = require("../redis");
const knex = require("../knex");

async function find(match) {
  if (match.address) {
    const cachedDomain = await redis.client.get(redis.key.domain(match.address));
    if (cachedDomain) return JSON.parse(cachedDomain);
  }

  const domain = await knex("domains").where(match).first();

  if (domain) {
    redis.client.set(
      redis.key.domain(domain.address),
      JSON.stringify(domain),
      "EX",
      60 * 60 * 6
    );
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
      updated_at: params.updated_at || new Date().toISOString()
    });
  } else {
    // Mysql and sqlite don't support returning but return the inserted id by default
    const [createdDomain] = await knex("domains").insert(newDomain).returning("id");
    id = createdDomain.id;
  }

  // Query domain instead of using returning as sqlite and mysql don't support it
  const domain = await knex("domains").where("id", id).first();

  redis.remove.domain(domain);

  return domain;
}

async function update(match, update) {
  await knex("domains")
    .where(match)
    .update({ ...update, updated_at: new Date().toISOString() });

  const domains = await knex("domains").select("*").where(match);

  domains.forEach(redis.remove.domain);

  return domains;
}

module.exports = {
  add,
  find,
  get,
  update,
}