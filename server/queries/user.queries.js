const { addMinutes } = require("date-fns");
const { v4: uuid } = require("uuid");

const utils = require("../utils");
const redis = require("../redis");
const knex = require("../knex");
const env = require("../env");

async function find(match) {
  if ((match.email || match.apikey) && env.REDIS_ENABLED) {
    const key = redis.key.user(match.email || match.apikey);
    const cachedUser = await redis.client.get(key);
    if (cachedUser) return JSON.parse(cachedUser);
  }

  const query = knex("users");
  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  const user = await query.first();
  
  if (user && env.REDIS_ENABLED) {
    const emailKey = redis.key.user(user.email);
    redis.client.set(emailKey, JSON.stringify(user), "EX", 60 * 15);
  
    if (user.apikey) {
      const apikeyKey = redis.key.user(user.apikey);
      redis.client.set(apikeyKey, JSON.stringify(user), "EX", 60 * 15);
    }
  }
  
  return user;
}

async function add(params, user) {
  const data = {
    email: params.email,
    password: params.password,
    verification_token: uuid(),
    verification_expires: utils.dateToUTC(addMinutes(new Date(), 60))
  };
  
  if (user) {
    await knex("users")
      .where("id", user.id)
      .update({ ...data, updated_at: utils.dateToUTC(new Date()) });
  } else {
    await knex("users").insert(data);
  }
  
  if (env.REDIS_ENABLED) {
    redis.remove.user(user);
  }
  
  return {
    ...user,
    ...data
  };
}

async function update(match, update, methods) {
  const query = knex("users");

  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  const updateQuery = query.clone();
  if (methods?.increments) {
    methods.increments.forEach(columnName => {
      updateQuery.increment(columnName);
    });
  }
  
  await updateQuery.update({ ...update, updated_at: utils.dateToUTC(new Date()) });

  const users = await query.select("*");

  if (env.REDIS_ENABLED) {
    users.forEach(redis.remove.user);
  }
  
  return users;
}

async function remove(user) {
  const deletedUser = await knex("users").where("id", user.id).delete();
  
  if (env.REDIS_ENABLED) {
    redis.remove.user(user);
  }
  
  return !!deletedUser;
}

module.exports = {
  add,
  find,
  remove,
  update,
}
