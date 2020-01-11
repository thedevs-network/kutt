import bcrypt from "bcryptjs";

import { getRedisKey, generateShortLink } from "../utils";
import * as redis from "../redis";
import knex from "../knex";

interface GetTotal {
  all: boolean;
  userId: number;
  search?: string;
}

export const getTotalQuery = async ({ all, search, userId }: GetTotal) => {
  const query = knex<Link>("links").count("id");

  if (!all) {
    query.where("user_id", userId);
  }

  if (search) {
    query.andWhereRaw("links.address || ' ' || target ILIKE '%' || ? || '%'", [
      search
    ]);
  }

  const [{ count }] = await query;

  return typeof count === "number" ? count : parseInt(count);
};

interface GetLinks {
  all: boolean;
  limit: number;
  search?: string;
  skip: number;
  userId: number;
}

export const getLinksQuery = async ({
  all,
  limit,
  search,
  skip,
  userId
}: GetLinks) => {
  const query = knex<LinkJoinedDomain>("links")
    .select(
      "links.id",
      "links.address",
      "links.banned",
      "links.created_at",
      "links.domain_id",
      "links.updated_at",
      "links.password",
      "links.target",
      "links.visit_count",
      "links.user_id",
      "links.uuid",
      "domains.address as domain"
    )
    .offset(skip)
    .limit(limit)
    .orderBy("created_at", "desc");

  if (!all) {
    query.where("links.user_id", userId);
  }

  if (search) {
    query.andWhereRaw("links.address || ' ' || target ILIKE '%' || ? || '%'", [
      search
    ]);
  }

  query.leftJoin("domains", "links.domain_id", "domains.id");

  const links: LinkJoinedDomain[] = await query;

  return links;
};

interface FindLink {
  address?: string;
  domainId?: number;
  userId?: number;
  target?: string;
}

export const findLinkQuery = async ({
  address,
  domainId,
  userId,
  target
}: FindLink): Promise<Link> => {
  const redisKey = getRedisKey.link(address, domainId, userId);
  const cachedLink = await redis.get(redisKey);

  if (cachedLink) return JSON.parse(cachedLink);

  const link = await knex<Link>("links")
    .where({
      ...(address && { address }),
      ...(domainId && { domain_id: domainId }),
      ...(userId && { user_id: userId }),
      ...(target && { target })
    })
    .first();

  if (link) {
    redis.set(redisKey, JSON.stringify(link), "EX", 60 * 60 * 2);
  }

  return link;
};

interface CreateLink {
  userId?: number;
  domainAddress?: string;
  domainId?: number;
  password?: string;
  address: string;
  target: string;
}

export const createLinkQuery = async ({
  password,
  address,
  target,
  domainAddress,
  domainId = null,
  userId = null
}: CreateLink) => {
  let encryptedPassword;

  if (password) {
    const salt = await bcrypt.genSalt(12);
    encryptedPassword = await bcrypt.hash(password, salt);
  }

  const [link]: Link[] = await knex<Link>("links").insert(
    {
      password: encryptedPassword,
      domain_id: domainId,
      user_id: userId,
      address,
      target
    },
    "*"
  );

  return {
    ...link,
    id: link.uuid,
    password: !!password,
    link: generateShortLink(address, domainAddress)
  };
};
