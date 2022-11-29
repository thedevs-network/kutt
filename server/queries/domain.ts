import redisClient, * as redis from "../redis";
import knex from "../knex";

export const find = async (match: Partial<Domain>): Promise<Domain> => {
  if (match.address) {
    const cachedDomain = await redisClient.get(redis.key.domain(match.address));
    if (cachedDomain) return JSON.parse(cachedDomain);
  }

  const domain = await knex<Domain>("domains")
    .where(match)
    .first();

  if (domain) {
    redisClient.set(
      redis.key.domain(domain.address),
      JSON.stringify(domain),
      "EX",
      60 * 60 * 6
    );
  }

  return domain;
};

export const get = async (match: Partial<Domain>): Promise<Domain[]> => {
  return knex<Domain>("domains").where(match);
};

interface Add extends Partial<Domain> {
  address: string;
}

export const add = async (params: Add) => {
  params.address = params.address.toLowerCase();

  const exists = await knex<Domain>("domains")
    .where("address", params.address)
    .first();

  const newDomain = {
    address: params.address,
    homepage: params.homepage || null,
    user_id: params.user_id || null,
    banned: !!params.banned
  };

  let domain: Domain;
  if (exists) {
    const [response]: Domain[] = await knex<Domain>("domains")
      .where("id", exists.id)
      .update(
        {
          ...newDomain,
          updated_at: params.updated_at || new Date().toISOString()
        },
        "*"
      );
    domain = response;
  } else {
    const [response]: Domain[] = await knex<Domain>("domains").insert(
      newDomain,
      "*"
    );
    domain = response;
  }

  redis.remove.domain(domain);

  return domain;
};

export const update = async (
  match: Partial<Domain>,
  update: Partial<Domain>
) => {
  const domains = await knex<Domain>("domains")
    .where(match)
    .update({ ...update, updated_at: new Date().toISOString() }, "*");

  domains.forEach(redis.remove.domain);

  return domains;
};
