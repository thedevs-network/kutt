const { promisify } = require('util');
const redis = require('redis');
const config = require('./config');

const client = redis.createClient({
  host: config.REDIS_HOST || '127.0.0.1',
  port: config.REDIS_PORT || 6379,
  password: config.REDIS_PASSWORD || '',
});

exports.get = promisify(client.get).bind(client);
exports.set = promisify(client.set).bind(client);
exports.del = promisify(client.del).bind(client);
