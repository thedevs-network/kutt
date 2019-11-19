import { promisify } from "util";
import redis from "redis";

const client = redis.createClient({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD })
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
