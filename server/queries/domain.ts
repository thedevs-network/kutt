import { getRedisKey } from "../utils";
import * as redis from "../redis";
import knex from "../knex";

interface FindDomain {
  address?: string;
  homepage?: string;
  uuid?: string;
  userId?: number;
}

export const findDomain = async ({
  userId,
  ...data
}: FindDomain): Promise<Domain> => {
  const redisKey = getRedisKey.domain(data.address);
  const cachedDomain = await redis.get(redisKey);

  if (cachedDomain) return JSON.parse(cachedDomain);

  const query = knex<Domain>("domains").where(data);

  if (userId) {
    query.andWhere("user_id", userId);
  }

  const domain = await query.first();

  if (domain) {
    redis.set(redisKey, JSON.stringify(domain), "EX", 60 * 60 * 6);
  }

  return domain;
};
