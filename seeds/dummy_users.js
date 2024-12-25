const nanoid = require("nanoid");

function createUser() {
  return {
    email: nanoid(Math.floor(Math.random() * 10) + 10) + "@email.com",
    password: nanoid(60),
    verified: Math.random() > 0.1,
    banned: Math.random() < 0.05,
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> } 
 */
async function seed(knex) {
  // creating users
  let users = [];
  for (let i = 0; i < 1_000_000; ++i) {
    users.push(createUser());

    if (i % 1000 === 0) {
      await knex.batchInsert("users", users, users.length);
      users = [];
    }
  }
};

module.exports = {
  seed,
}
