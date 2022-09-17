import * as redis from "../redis";
import knex from "../knex";
import * as models from "../models";

const { TableName } = models;

export const find = async (match: Partial<Domain>): Promise<Domain> => {
  if (match.address) {
    const cachedDomain = await redis.get(redis.key.domain(match.address));
    if (cachedDomain) return JSON.parse(cachedDomain);
  }

  const domain = await knex<Domain>(TableName.domain)
    .where(match)
    .first();

  if (domain) {
    redis.set(
      redis.key.domain(domain.address),
      JSON.stringify(domain),
      "EX",
      60 * 60 * 6
    );
  }

  return domain;
};

export const get = async (match: Partial<Domain>): Promise<Domain[]> => {
  return knex<Domain>(TableName.domain).where(match);
};

interface Add extends Partial<Domain> {
  address: string;
}

export const add = async (params: Add) => {
  params.address = params.address.toLowerCase();

  const exists = await knex<Domain>(TableName.domain)
    .where("address", params.address)
    .first();

  const newDomain = {
    address: params.address,
    homepage: params.homepage || null,
    user_id: params.user_id || null,
    banned: !!params.banned
  };

  let domain: Domain;
  if (exists) {
    const [response]: Domain[] = await knex<Domain>(TableName.domain)
      .where("id", exists.id)
      .update(
        {
          ...newDomain,
          updated_at: params.updated_at || new Date().toISOString()
        },
        "*"
      );
    domain = response;
  } else {
    const [response]: Domain[] = await knex<Domain>(TableName.domain).insert(
      newDomain,
      "*"
    );
    domain = response;
  }

  redis.remove.domain(domain);

  return domain;
};

export const update = async (
  match: Partial<Domain>,
  update: Partial<Domain>
) => {
  const domains = await knex<Domain>(TableName.domain)
    .where(match)
    .update({ ...update, updated_at: new Date().toISOString() }, "*");

  domains.forEach(redis.remove.domain);

  return domains;
};
