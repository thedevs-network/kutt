const { promisify } = require('util');
const redis = require('redis');
const config = require('./config');

if (config.REDIS_DISABLED === true) {
  exports.get = () => Promise.resolve(null);
  exports.set = () => Promise.resolve(null);
  exports.del = () => Promise.resolve(null);
} else {
  const client = redis.createClient({
    host: config.REDIS_HOST || '127.0.0.1',
    port: config.REDIS_PORT || 6379,
    ...(config.REDIS_PASSWORD && { password: config.REDIS_PASSWORD }),
  });

  exports.get = promisify(client.get).bind(client);
  exports.set = promisify(client.set).bind(client);
  exports.del = promisify(client.del).bind(client);
}
