const { subMinutes } = require("date-fns");

const knex = require("../knex");
const env = require("../env");

async function add(ipToAdd) {
  const ip = ipToAdd.toLowerCase();
  
  const currentIP = await knex("ips").where("ip", ip).first();
  
  if (currentIP) {
    const currentDate = new Date().toISOString();
    await knex("ips")
      .where({ ip })
      .update({
        created_at: currentDate,
        updated_at: currentDate
      });
  } else {
    await knex("ips").insert({ ip });
  }
  
  return ip;
}


async function find(match) {
  const query = knex("ips");
  
  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });
  
  const ip = await query.first();
  
  return ip;
}

function clear() {
  return knex("ips")
  .where(
    "created_at",
    "<",
    subMinutes(new Date(), env.NON_USER_COOLDOWN).toISOString()
  )
  .delete();
}

module.exports = {
  add,
  clear,
  find,
}
