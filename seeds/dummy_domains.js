const nanoid = require("nanoid");
const { v4: uuid } = require("uuid");

function createDomain() {
  return {
    address: nanoid(Math.floor(Math.random() * 10) + 10) + ".com",
    homepage: Math.random() > 0.7 ? nanoid(Math.floor(Math.random() * 10) + 3) + ".com" : null,
    banned: Math.random() < 0.05,
    user_id: Math.random() > 0.2 ? Math.floor(Math.random() * 1_000_000) : null,
    uuid: uuid(),
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
async function seed(knex) {
  // creating domains
  let domains = [];
  for (let i = 0; i < 1_000_000; ++i) {
    domains.push(createDomain());

    if (i % 1000 === 0) {
      await knex.batchInsert("domains", domains, domains.length);
      domains = [];
    }
  }
};

module.exports = {
  seed,
}