const neo4j = require('neo4j-driver').v1;

const driver = neo4j.driver(
  process.env.DB_URI,
  neo4j.auth.basic(process.env.DB_USERNAME, process.env.DB_PASSWORD)
);

module.exports = driver;
