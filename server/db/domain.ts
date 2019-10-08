import knex from "../knex";
import * as redis from "../redis";
import { getRedisKey } from "../utils";

export const getDomain = async (data: Partial<Domain>): Promise<Domain> => {
  const getData = {
    ...data,
    ...(data.address && { address: data.address.toLowerCase() }),
    ...(data.homepage && { homepage: data.homepage.toLowerCase() })
  };

  const redisKey = getRedisKey.domain(getData.address);
  const cachedDomain = await redis.get(redisKey);

  if (cachedDomain) return JSON.parse(cachedDomain);

  const domain = await knex<Domain>("domains")
    .where(getData)
    .first();

  if (domain) {
    redis.set(redisKey, JSON.stringify(domain), "EX", 60 * 60 * 6);
  }

  return domain;
};

export const setDomain = async (
  data: Partial<Domain>,
  user: UserJoined,
  matchedDomain: Domain
) => {
  // 1. If user has domain, remove it from their possession
  await knex<Domain>("domains")
    .where({ user_id: user.id })
    .update({ user_id: null });

  // 2. Create or update the domain with user's ID
  let domain;

  const updateDate: Partial<Domain> = {
    address: data.address.toLowerCase(),
    homepage: data.homepage && data.homepage.toLowerCase(),
    user_id: user.id,
    updated_at: new Date().toISOString()
  };

  if (matchedDomain) {
    const [response]: Domain[] = await knex<Domain>("domains")
      .where("id", matchedDomain.id)
      .update(updateDate, "*");
    domain = response;
  } else {
    const [response]: Domain[] = await knex<Domain>("domains").insert(
      updateDate,
      "*"
    );
    domain = response;
  }

  redis.del(user.email);
  redis.del(user.email);
  redis.del(getRedisKey.domain(updateDate.address));

  return domain;
};

export const deleteDomain = async (user: UserJoined) => {
  // Remove user from domain, do not actually delete the domain
  const [domain]: Domain[] = await knex<Domain>("domains")
    .where({ user_id: user.id })
    .update({ user_id: null, updated_at: new Date().toISOString() }, "*");

  if (domain) {
    redis.del(getRedisKey.domain(domain.address));
  }

  redis.del(user.email);
  redis.del(user.apikey);

  return domain;
};

export const banDomain = async (
  addressToban: string,
  banned_by_id?: number
): Promise<Domain> => {
  const address = addressToban.toLowerCase();

  const currentDomain = await getDomain({ address });

  let domain;
  if (currentDomain) {
    const updates: Domain[] = await knex<Domain>("domains")
      .where({ address })
      .update(
        { banned: true, banned_by_id, updated_at: new Date().toISOString() },
        "*"
      );
    domain = updates[0];
  } else {
    const inserts: Domain[] = await knex<Domain>("domains").insert(
      { address, banned: true, banned_by_id },
      "*"
    );
    domain = inserts[0];
  }

  if (domain) {
    redis.del(getRedisKey.domain(domain.address));
  }

  return domain;
};
