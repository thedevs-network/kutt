import subMinutes from "date-fns/sub_minutes";

import knex from "../knex";

export const addIP = async (ipToGet: string) => {
  const ip = ipToGet.toLowerCase();

  const currentIP = await knex<IP>("ips")
    .where({ ip })
    .first();

  if (currentIP) {
    const currentDate = new Date().toISOString();
    await knex<IP>("ips")
      .where({ ip })
      .update({
        created_at: currentDate,
        updated_at: currentDate
      });
  } else {
    await knex<IP>("ips").insert({ ip });
  }

  return ip;
};
export const getIP = async (ip: string) => {
  const matchedIp = await knex<IP>("ips")
    .where({ ip: ip.toLowerCase() })
    .andWhere("created_at", ">", new Date().toISOString())
    .first();

  return matchedIp;
};
export const clearIPs = async () =>
  knex<IP>("ips")
    .where(
      "created_at",
      "<",
      subMinutes(
        new Date(),
        Number(process.env.NON_USER_COOLDOWN)
      ).toISOString()
    )
    .delete();
