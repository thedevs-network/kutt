import * as redis from "../redis";
import knex from "../knex";

interface Add extends Partial<Host> {
  address: string;
}

export const find = async (match: Partial<Host>): Promise<Host> => {
  if (match.address) {
    const cachedHost = await redis.get(redis.key.host(match.address));
    if (cachedHost) return JSON.parse(cachedHost);
  }

  const host = await knex<Domain>("hosts")
    .where(match)
    .first();

  if (host) {
    redis.set(
      redis.key.host(host.address),
      JSON.stringify(host),
      "EX",
      60 * 60 * 6
    );
  }

  return host;
};

export const add = async (params: Add) => {
  params.address = params.address.toLowerCase();

  const exists = await knex<Domain>("domains")
    .where("address", params.address)
    .first();

  const newHost = {
    address: params.address,
    banned: !!params.banned
  };

  let host: Host;
  if (exists) {
    const [response] = await knex<Host>("hosts")
      .where("id", exists.id)
      .update(
        {
          ...newHost,
          updated_at: params.updated_at || new Date().toISOString()
        },
        "*"
      );
    host = response;
  } else {
    const [response] = await knex<Host>("hosts").insert(newHost, "*");
    host = response;
  }

  redis.remove.host(host);

  return host;
};
