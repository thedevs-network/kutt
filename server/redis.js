const { promisify } = require('util');
const redis = require('redis');

if (process.env.REDIS_DISABLED === 'true') {
  exports.get = () => Promise.resolve(null);
  exports.set = () => Promise.resolve(null);
  exports.del = () => Promise.resolve(null);
} else {
  const client = redis.createClient({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT) || 6379,
    ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  });

  exports.get = promisify(client.get).bind(client);
  exports.set = promisify(client.set).bind(client);
  exports.del = promisify(client.del).bind(client);
}
