const neo4j = require('neo4j-driver').v1;
const config = require('../config');

const driver = neo4j.driver(
  config.DB_URI,
  neo4j.auth.basic(config.DB_USERNAME, config.DB_PASSWORD)
);

module.exports = driver;
