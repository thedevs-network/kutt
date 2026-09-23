const i18n = require("../i18n");
const { addMinutes } = require("date-fns");
const { randomUUID } = require("node:crypto");

const { ROLES } = require("../consts");
const utils = require("../utils");
const redis = require("../redis");
const knex = require("../knex");
const env = require("../env");

async function find(match) {
  if ((match.id || match.apikey) && env.REDIS_ENABLED) {
    const key = redis.key.user(match.id || match.apikey);
    const cachedUser = await redis.client.get(key);
    if (cachedUser) return JSON.parse(cachedUser);
  }

  const query = knex("users");
  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  const user = await query.first();
  
  if (user && env.REDIS_ENABLED) {
    if (match.id) {
      const idKey = redis.key.user(user.id);
      redis.client.set(idKey, JSON.stringify(user), "EX", 60 * 15);
    }
  
    if (match.apikey) {
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
    ...(params.role && { role: params.role }),
    ...(params.verified !== undefined && { verified: params.verified }),
    verification_token: randomUUID(),
    verification_expires: utils.dateToUTC(addMinutes(new Date(), 60))
  };
  
  if (user) {
    const changed = await knex("users")
      .where({ id: user.id, verified: false, auth_version: user.auth_version }).increment("auth_version", 1)
      .update({ ...data, ...require("../account-tokens"), updated_at: utils.dateToUTC(new Date()) });
    if (!changed) throw new utils.CustomError(i18n.t("messages.account_changed_please_sign_in_or_request_account_recovery"), 409);
  } else {
    await knex("users").insert(data);
  }
  
  if (env.REDIS_ENABLED) {
    redis.remove.user(user);
  }
  
  // Callers mint sessions immediately; include the persisted ID and auth version.
  return knex("users").where({ email: data.email }).first();
}

async function update(match, update, methods) {
  const { user, updated_user } = await knex.transaction(async function(trx) {
    if (update.banned !== undefined) await require("../domain-access").lock(trx);
    const query = trx("users");
    Object.entries(match).forEach(([key, value]) => {
      query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
    });

    const user = await query.first();
    if (!user) return {};
    
    const updateQuery = trx("users").where("id", user.id);
    // Recheck token/expiry predicates at the write, not just before a concurrent
    // transaction consumes them. Only the winning update may mint a session.
    Object.entries(match).forEach(([key, value]) => {
      updateQuery.andWhere(key, ...(Array.isArray(value) ? value : [value]));
    });
    const invalidates = update.password !== undefined || update.banned !== undefined || update.email !== undefined;
    if (invalidates) updateQuery.increment("auth_version", 1);
    if (update.change_email_token || update.reset_password_token) {
      updateQuery.andWhere("auth_version", user.auth_version);
    }
    if (methods?.increments) {
      methods.increments.forEach(columnName => {
        updateQuery.increment(columnName);
      });
    }
    
    const changed = await updateQuery.update({ ...update,
      ...(invalidates ? require("../account-tokens") : {}), updated_at: utils.dateToUTC(new Date()) });
    if (!changed) return {};
    if (update.banned === true) await require("../domain-access").invalidateUser(trx, user.id);
    const updated_user = await trx("users").where("id", user.id).first();

    return { user, updated_user };
  });

  if (env.REDIS_ENABLED && user) {
    redis.remove.user(user);
    redis.remove.user(updated_user);
  }

  return updated_user;
}

async function remove(user, actor = user, administrative = false) {
  return require("../moderation").removeUser(user, actor, administrative);
}

const selectable_admin = [
  "users.id",
  "users.email",
  "users.verified",
  "users.role",
  "users.banned",
  "users.banned_by_id",
  "users.created_at",
  "users.updated_at"
];

function normalizeMatch(match) {
  const newMatch = { ...match }

  if (newMatch.banned !== undefined) {
    newMatch["users.banned"] = newMatch.banned;
    delete newMatch.banned;
  }

  return newMatch;
}

async function getAdmin(match, params) {
  const query = knex("users")
    .select(...selectable_admin)
    .select("l.links_count")
    .select("d.domains")
    .fromRaw("users")
    .where(normalizeMatch(match))
    .offset(params.skip)
    .limit(params.limit)
    .groupBy(1)
    .groupBy("l.links_count")
    .groupBy("d.domains");
  require("../list-sort").apply(query, params, "users");
  
  if (params?.search) {
    const id = parseInt(params?.search);
    if (Number.isNaN(id)) {
      query[knex.compatibleILIKE]("users.email", "%" + params?.search + "%");
    } else {
      query.andWhere("users.id", params?.search);
    }
  }

  if (params?.domains !== undefined) {
    query.andWhere("d.domains", params?.domains ? "is not" : "is", null);
  }

  if (params?.links !== undefined) {
    query.andWhere("links_count", params?.links ? "is not" : "is", null);
  }
  
  query.leftJoin(
    knex("domains")
    .select("user_id", knex.isMySQL
      ? knex.raw("group_concat(address SEPARATOR ', ') AS domains")
      : knex.raw("string_agg(address, ', ') AS domains")
    )
    .groupBy("user_id").as("d"),
    "users.id",
    "d.user_id"
  )
  query.leftJoin(
    knex("links").select("user_id").count("* as links_count").groupBy("user_id").as("l"),
    "users.id",
    "l.user_id"
  );

  return query;
}

async function totalAdmin(match, params) {
  const query = knex("users")
    .count("* as count")
    .fromRaw("users")
    .where(normalizeMatch(match));

  if (params?.search) {
    const id = parseInt(params?.search);
    if (Number.isNaN(id)) {
      query[knex.compatibleILIKE]("users.email", "%" + params?.search + "%");
    } else {
      query.andWhere("users.id", params?.search);
    }
  }

  if (params?.domains !== undefined) {
    query.andWhere("domains", params?.domains ? "is not" : "is", null);
    query.leftJoin(
      knex("domains")
        .select("user_id", knex.isMySQL
          ? knex.raw("group_concat(address SEPARATOR ', ') AS domains")
          : knex.raw("string_agg(address, ', ') AS domains")
        )
        .groupBy("user_id").as("d"),
      "users.id",
      "d.user_id"
    );
  }

  if (params?.links !== undefined) {
    query.andWhere("links", params?.links ? "is not" : "is", null);
    query.leftJoin(
      knex("links").select("user_id").count("* as links").groupBy("user_id").as("l"),
      "users.id",
      "l.user_id"
    );
  }

  const [{ count }] = await query;

  return typeof count === "number" ? count : parseInt(count);
}

async function create(params, actor) {
  return knex.transaction(async db => {
    const current = await require("../moderation").lock(db, actor);
    if (params.role === ROLES.ADMIN && !await require("../oidc-roles").canCreateLocalAdmin(current, db)) {
      throw new utils.CustomError(i18n.t("oidc_roles.local_admin_creation"), 403);
    }
    let [user] = await db("users").insert({
      email: params.email, password: params.password, role: params.role ?? ROLES.USER,
      verified: params.verified ?? false, banned: params.banned ?? false
    }, "*");
    // MySQL returns the inserted ID rather than the row.
    if (typeof user === "number") user = await db("users").where("id", user).first();
    return user;
  });
}

// check if there exists a user
async function findAny() {
  if (env.REDIS_ENABLED) {
    const anyuser = await redis.client.get("any-user");
    if (anyuser) return true;
  }

  const anyuser = await knex("users").select("id").first();

  if (env.REDIS_ENABLED && anyuser) {
    redis.client.set("any-user", JSON.stringify(anyuser), "EX", 60 * 5);
  }

  return !!anyuser;
}

module.exports = {
  add,
  create,
  find,
  findAny,
  getAdmin,
  remove,
  totalAdmin,
  update,
}
