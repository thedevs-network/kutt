import bcrypt from "bcryptjs";

import { CustomError } from "../utils";
import * as redis from "../redis";
import knex from "../knex";

import * as models from "../models";

const { TableName } = models;

const selectable = [
  `${TableName.link}.id`,
  `${TableName.link}.address`,
  `${TableName.link}.banned`,
  `${TableName.link}.created_at`,
  `${TableName.link}.domain_id`,
  `${TableName.link}.updated_at`,
  `${TableName.link}.password`,
  `${TableName.link}.description`,
  `${TableName.link}.expire_in`,
  `${TableName.link}.target`,
  `${TableName.link}.visit_count`,
  `${TableName.link}.user_id`,
  `${TableName.link}.uuid`,
  `${TableName.domain}.address as domain`
];

const normalizeMatch = (match: Partial<Link>): Partial<Link> => {
  const newMatch = { ...match };

  if (newMatch.address) {
    newMatch[`${TableName.link}.address`] = newMatch.address;
    delete newMatch.address;
  }

  if (newMatch.user_id) {
    newMatch[`${TableName.link}.user_id`] = newMatch.user_id;
    delete newMatch.user_id;
  }

  if (newMatch.uuid) {
    newMatch[`${TableName.link}.uuid`] = newMatch.uuid;
    delete newMatch.uuid;
  }

  return newMatch;
};

interface TotalParams {
  search?: string;
}

export const total = async (match: Match<Link>, params: TotalParams = {}) => {
  const query = knex<Link>(TableName.link);

  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  if (params.search) {
    query.andWhereRaw(
      `${TableName.link}.description || ' '  || ${TableName.link}.address || ' ' || target ILIKE '%' || ? || '%'`,
      [params.search]
    );
  }

  const [{ count }] = await query.count("id");

  return typeof count === "number" ? count : parseInt(count);
};

interface GetParams {
  limit: number;
  search?: string;
  skip: number;
}

export const get = async (match: Partial<Link>, params: GetParams) => {
  const query = knex<LinkJoinedDomain>(TableName.link)
    .select(...selectable)
    .where(normalizeMatch(match))
    .offset(params.skip)
    .limit(params.limit)
    .orderBy("created_at", "desc");

  if (params.search) {
    query.andWhereRaw(
      `concat_ws(' ', description, ${TableName.link}.address, target, ${TableName.domain}.address) ILIKE '%' || ? || '%'`,
      [params.search]
    );
  }

  query.leftJoin(
    TableName.domain,
    `${TableName.link}.domain_id`,
    `${TableName.domain}.id`
  );

  const links: LinkJoinedDomain[] = await query;

  return links;
};

export const find = async (match: Partial<Link>): Promise<Link> => {
  if (match.address && match.domain_id) {
    const key = redis.key.link(match.address, match.domain_id);
    const cachedLink = await redis.get(key);
    if (cachedLink) return JSON.parse(cachedLink);
  }

  const link = await knex<Link>(TableName.link)
    .select(...selectable)
    .where(normalizeMatch(match))
    .leftJoin(
      TableName.domain,
      `${TableName.link}.domain_id`,
      `${TableName.domain}.id`
    )
    .first();

  if (link) {
    const key = redis.key.link(link.address, link.domain_id);
    redis.set(key, JSON.stringify(link), "EX", 60 * 60 * 2);
  }

  return link;
};

interface Create extends Partial<Link> {
  address: string;
  target: string;
}

export const create = async (params: Create) => {
  let encryptedPassword: string = null;

  if (params.password) {
    const salt = await bcrypt.genSalt(12);
    encryptedPassword = await bcrypt.hash(params.password, salt);
  }

  const [link]: LinkJoinedDomain[] = await knex<LinkJoinedDomain>(
    TableName.link
  ).insert(
    {
      password: encryptedPassword,
      domain_id: params.domain_id || null,
      user_id: params.user_id || null,
      address: params.address,
      description: params.description || null,
      expire_in: params.expire_in || null,
      target: params.target
    },
    "*"
  );

  return link;
};

export const remove = async (match: Partial<Link>) => {
  const link = await knex<Link>(TableName.link)
    .where(match)
    .first();

  if (!link) {
    throw new CustomError("Link was not found.");
  }

  const deletedLink = await knex<Link>(TableName.link)
    .where("id", link.id)
    .delete();

  redis.remove.link(link);

  return !!deletedLink;
};

export const batchRemove = async (match: Match<Link>) => {
  const deleteQuery = knex<Link>(TableName.link);
  const findQuery = knex<Link>(TableName.link);

  Object.entries(match).forEach(([key, value]) => {
    findQuery.andWhere(key, ...(Array.isArray(value) ? value : [value]));
    deleteQuery.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  const links = await findQuery;

  links.forEach(redis.remove.link);

  await deleteQuery.delete();
};

export const update = async (match: Partial<Link>, update: Partial<Link>) => {
  const links = await knex<Link>(TableName.link)
    .where(match)
    .update({ ...update, updated_at: new Date().toISOString() }, "*");

  links.forEach(redis.remove.link);

  return links;
};

export const increamentVisit = async (match: Partial<Link>) => {
  return knex<Link>(TableName.link)
    .where(match)
    .increment("visit_count", 1);
};
