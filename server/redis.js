const { promisify } = require('util');
const redis = require('redis');
const config = require('./config');

const client = redis.createClient(
  config.REDIS_PORT ? config.REDIS_PORT : 6379,
  config.REDIS_HOST ? config.REDIS_HOST : '127.0.0.1'
);

exports.get = promisify(client.get).bind(client);
exports.set = promisify(client.set).bind(client);
exports.del = promisify(client.del).bind(client);
