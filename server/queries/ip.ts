import { subMinutes } from "date-fns";

import knex from "../knex";
import env from "../env";

export const add = async (ipToAdd: string) => {
  const ip = ipToAdd.toLowerCase();

  const currentIP = await knex<IP>("ips")
    .where("ip", ip)
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

export const find = async (match: Match<IP>) => {
  const query = knex<IP>("ips");

  Object.entries(match).forEach(([key, value]) => {
    query.andWhere(key, ...(Array.isArray(value) ? value : [value]));
  });

  const ip = await query.first();

  return ip;
};

export const clear = async () =>
  knex<IP>("ips")
    .where(
      "created_at",
      "<",
      subMinutes(new Date(), env.NON_USER_COOLDOWN).toISOString()
    )
    .delete();
