import { promisify } from 'util';
import redis from 'redis';

const disabled = process.env.REDIS_DISABLED === 'true';

const client =
  !disabled &&
  redis.createClient({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  });

const defaultResolver: () => Promise<null> = () => Promise.resolve(null);

export const get: (key: string) => Promise<any> = disabled
  ? defaultResolver
  : promisify(client.get).bind(client);

export const set: (
  key: string,
  value: string,
  ex?: string,
  exValue?: number
) => Promise<any> = disabled
  ? defaultResolver
  : promisify(client.set).bind(client);

export const del: (key: string) => Promise<any> = disabled
  ? defaultResolver
  : promisify(client.del).bind(client);
