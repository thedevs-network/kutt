import knex from "../../knex";
import * as redis from "../../redis";
import { getRedisKey } from "../../utils";

export const getHost = async (data: Partial<Host>) => {
  const getData = {
    ...data,
    ...(data.address && { address: data.address.toLowerCase() })
  };

  const redisKey = getRedisKey.host(getData.address);
  const cachedHost = await redis.get(redisKey);

  if (cachedHost) return JSON.parse(cachedHost);

  const host = await knex<Host>("hosts")
    .where(getData)
    .first();

  if (host) {
    redis.set(redisKey, JSON.stringify(host), "EX", 60 * 60 * 6);
  }

  return host;
};

export const banHost = async (addressToBan: string, banned_by_id?: number) => {
  const address = addressToBan.toLowerCase();

  const currentHost = await knex<Host>("hosts")
    .where({ address })
    .first();

  if (currentHost) {
    await knex<Host>("hosts")
      .where({ address })
      .update({
        banned: true,
        banned_by_id,
        updated_at: new Date().toISOString()
      });
  } else {
    await knex<Host>("hosts").insert({ address, banned: true, banned_by_id });
  }

  if (currentHost) {
    redis.del(getRedisKey.host(currentHost.address));
  }

  return currentHost;
};
