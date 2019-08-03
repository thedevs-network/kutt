import { Types } from 'mongoose';

import Domain, { IDomain } from '../models/domain';
import User from '../models/user';
import * as redis from '../redis';

export const getDomain = async (data: Partial<IDomain>) => {
  const redisKey = `${data.name}-${data.banned ? 'y' : 'n'}`;
  const cachedDomain = await redis.get(redisKey);

  if (cachedDomain) return JSON.parse(cachedDomain);

  const domain = await Domain.findOne(data);

  redis.set(redisKey, JSON.stringify(domain), 'EX', 60 * 60 * 6);

  return domain;
};

export const setDomain = async (data: Partial<IDomain>) => {
  const [domain] = await Promise.all([
    Domain.create({
      name: data.name,
      homepage: data.homepage,
      user: data.user,
    }),
    Domain.findOneAndUpdate({ user: data.user }, { user: undefined }),
  ]);
  await User.findByIdAndUpdate(data.user, { domain });
  return domain;
};

export const deleteDomain = async (user: Types.ObjectId) => {
  const [domain] = await Promise.all([
    Domain.findOneAndUpdate({ user }, { user: undefined }),
    User.findByIdAndUpdate(user, { domain: undefined }),
  ]);

  if (domain) {
    redis.del(`${domain.name}-${domain.banned ? 'y' : 'n'}`);
  }

  return domain;
};

export const banDomain = async (name: string, bannedBy?: Types.ObjectId) => {
  const domain = await Domain.findOneAndUpdate(
    { name },
    { banned: true, bannedBy },
    { upsert: true }
  );

  if (domain) {
    redis.del(`${domain.name}-${domain.banned ? 'y' : 'n'}`);
  }

  return domain;
};
