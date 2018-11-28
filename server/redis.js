const { promisify } = require('util');
const redis = require('redis');

const client = redis.createClient();

exports.get = promisify(client.get).bind(client);
exports.set = promisify(client.set).bind(client);
exports.del = promisify(client.del).bind(client);
