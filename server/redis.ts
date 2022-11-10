import { promisify } from "util";
import redis from "redis";

import env from "./env";

const client = redis.createClient({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  db: env.REDIS_DB,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD })
});

export const get: (key: string) => Promise<any> = promisify(client.get).bind(
  client
);

export const set: (
  key: string,
  value: string,
  ex?: string,
  exValue?: number
) => Promise<any> = promisify(client.set).bind(client);

export const del: (key: string) => Promise<any> = promisify(client.del).bind(
  client
);

export const key = {
  link: (address: string, domain_id?: number, user_id?: number) =>
    `${address}-${domain_id || ""}-${user_id || ""}`,
  domain: (address: string) => `d-${address}`,
  stats: (link_id: number) => `s-${link_id}`,
  host: (address: string) => `h-${address}`,
  user: (emailOrKey: string) => `u-${emailOrKey}`
};

export const remove = {
  domain: (domain?: Domain) => {
    if (!domain) return;
    del(key.domain(domain.address));
  },
  host: (host?: Host) => {
    if (!host) return;
    del(key.host(host.address));
  },
  link: (link?: Link) => {
    if (!link) return;
    del(key.link(link.address, link.domain_id));
  },
  user: (user?: User) => {
    if (!user) return;
    del(key.user(user.email));
    del(key.user(user.apikey));
  }
};
