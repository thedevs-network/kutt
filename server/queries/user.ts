import { v4 as uuid } from "uuid";
import { addMinutes } from "date-fns";

import redisCLient, * as redis from "../redis";
import knex from "../knex";

export const find = async (match: Partial<User>) => {
  if (match.email || match.apikey) {
    const key = redis.key.user(match.email || match.apikey);
    const cachedUser = await redisCLient.get(key);
    if (cachedUser) return JSON.parse(cachedUser) as User;
  }

  const user = await knex<User>("users").where(match).first();

  if (user) {
    const emailKey = redis.key.user(user.email);
    redisCLient.set(emailKey, JSON.stringify(user), "EX", 60 * 60 * 1);

    if (user.apikey) {
      const apikeyKey = redis.key.user(user.apikey);
      redisCLient.set(apikeyKey, JSON.stringify(user), "EX", 60 * 60 * 1);
    }
  }

  return user;
};

interface Add {
  email: string;
  password: string;
}

export const add = async (params: Add, user?: User) => {
  const data = {
    email: params.email,
    password: params.password,
    verification_token: uuid(),
    verification_expires: addMinutes(new Date(), 60).toISOString()
  };

  if (user) {
    await knex<User>("users")
      .where("id", user.id)
      .update({ ...data, updated_at: new Date().toISOString() });
  } else {
    await knex<User>("users").insert(data);
  }

  redis.remove.user(user);

  return {
    ...user,
    ...data
  };
};

export const update = async (match: Match<User>, update: Partial<User>) => {
  const query = knex<User>("users");

  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  const users = await query.update(
    { ...update, updated_at: new Date().toISOString() },
    "*"
  );

  users.forEach(redis.remove.user);

  return users;
};

export const remove = async (user: User) => {
  const deletedUser = await knex<User>("users").where("id", user.id).delete();

  redis.remove.user(user);

  return !!deletedUser;
};
