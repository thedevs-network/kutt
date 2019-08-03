import { Types } from 'mongoose';

import Host, { IHost } from '../models/host';
import * as redis from '../redis';

export const getHost = async (data: Partial<IHost>) => {
  const redisKey = `${data.address}-${data.banned ? 'y' : 'n'}`;
  const cachedHost = await redis.get(redisKey);

  if (cachedHost) return JSON.parse(cachedHost);

  const host = await Host.findOne(data);

  redis.set(redisKey, JSON.stringify(host), 'EX', 60 * 60 * 6);

  return host;
};

export const banHost = async (address: string, bannedBy?: Types.ObjectId) => {
  const host = await Host.findOneAndUpdate(
    { address },
    { banned: true, bannedBy },
    { upsert: true }
  );

  if (host) {
    redis.del(`${host.address}-${host.banned ? 'y' : 'n'}`);
  }

  return host;
};
