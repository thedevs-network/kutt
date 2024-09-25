const { addMinutes } = require("date-fns");
const { v4: uuid } = require("uuid");

const redis = require("../redis");
const knex = require("../knex");

async function find(match) {
  if (match.email || match.apikey) {
    const key = redis.key.user(match.email || match.apikey);
    const cachedUser = await redis.client.get(key);
    if (cachedUser) return JSON.parse(cachedUser);
  }

  const query = knex("users");
  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  const user = await query.first();
  
  if (user) {
    const emailKey = redis.key.user(user.email);
    redis.client.set(emailKey, JSON.stringify(user), "EX", 60 * 60 * 1);
  
    if (user.apikey) {
      const apikeyKey = redis.key.user(user.apikey);
      redis.client.set(apikeyKey, JSON.stringify(user), "EX", 60 * 60 * 1);
    }
  }
  
  return user;
}

async function add(params, user) {
  const data = {
    email: params.email,
    password: params.password,
    verification_token: uuid(),
    verification_expires: addMinutes(new Date(), 60).toISOString()
  };
  
  if (user) {
    await knex("users")
      .where("id", user.id)
      .update({ ...data, updated_at: new Date().toISOString() });
  } else {
    await knex("users").insert(data);
  }
  
  redis.remove.user(user);
  
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
  
  await updateQuery.update({ ...update, updated_at: new Date().toISOString() });

  const users = await query.select("*");

  users.forEach(redis.remove.user);
  
  return users;
}

async function remove(user) {
  const deletedUser = await knex("users").where("id", user.id).delete();
  
  redis.remove.user(user);
  
  return !!deletedUser;
}

module.exports = {
  add,
  find,
  remove,
  update,
}
