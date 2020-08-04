import bcrypt from "bcryptjs";

import { CustomError } from "../utils";
import * as redis from "../redis";
import knex from "../knex";

const selectable = [
  "links.id",
  "links.address",
  "links.banned",
  "links.created_at",
  "links.domain_id",
  "links.updated_at",
  "links.password",
  "links.description",
  "links.expire_in",
  "links.target",
  "links.visit_count",
  "links.user_id",
  "links.uuid",
  "domains.address as domain"
];

const normalizeMatch = (match: Partial<Link>): Partial<Link> => {
  const newMatch = { ...match };

  if (newMatch.address) {
    newMatch["links.address"] = newMatch.address;
    delete newMatch.address;
  }

  if (newMatch.user_id) {
    newMatch["links.user_id"] = newMatch.user_id;
    delete newMatch.user_id;
  }

  if (newMatch.uuid) {
    newMatch["links.uuid"] = newMatch.uuid;
    delete newMatch.uuid;
  }

  return newMatch;
};

interface TotalParams {
  search?: string;
}

export const total = async (match: Match<Link>, params: TotalParams = {}) => {
  const query = knex<Link>("links");

  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  if (params.search) {
    query.andWhereRaw(
      "links.description || ' '  || links.address || ' ' || target ILIKE '%' || ? || '%'",
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
  const query = knex<LinkJoinedDomain>("links")
    .select(...selectable)
    .where(normalizeMatch(match))
    .offset(params.skip)
    .limit(params.limit)
    .orderBy("created_at", "desc");

  if (params.search) {
    query.andWhereRaw(
      "concat_ws(' ', description, links.address, target) ILIKE '%' || ? || '%'",
      [params.search]
    );
  }

  query.leftJoin("domains", "links.domain_id", "domains.id");

  const links: LinkJoinedDomain[] = await query;

  return links;
};

export const find = async (match: Partial<Link>): Promise<Link> => {
  if (match.address && match.domain_id) {
    const key = redis.key.link(match.address, match.domain_id);
    const cachedLink = await redis.get(key);
    if (cachedLink) return JSON.parse(cachedLink);
  }

  const link = await knex<Link>("links")
    .select(...selectable)
    .where(normalizeMatch(match))
    .leftJoin("domains", "links.domain_id", "domains.id")
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
    "links"
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
  const link = await knex<Link>("links")
    .where(match)
    .first();

  if (!link) {
    throw new CustomError("Link was not found.");
  }

  const deletedLink = await knex<Link>("links")
    .where("id", link.id)
    .delete();

  redis.remove.link(link);

  return !!deletedLink;
};

export const batchRemove = async (match: Match<Link>) => {
  const deleteQuery = knex<Link>("links");
  const findQuery = knex<Link>("links");

  Object.entries(match).forEach(([key, value]) => {
    findQuery.andWhere(key, ...(Array.isArray(value) ? value : [value]));
    deleteQuery.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  const links = await findQuery;

  links.forEach(redis.remove.link);

  await deleteQuery.delete();
};

export const update = async (match: Partial<Link>, update: Partial<Link>) => {
  const links = await knex<Link>("links")
    .where(match)
    .update({ ...update, updated_at: new Date().toISOString() }, "*");

  links.forEach(redis.remove.link);

  return links;
};

export const increamentVisit = async (match: Partial<Link>) => {
  return knex<Link>("links")
    .where(match)
    .increment("visit_count", 1);
};
