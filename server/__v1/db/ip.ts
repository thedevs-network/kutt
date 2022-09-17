import { subMinutes } from "date-fns";

import knex from "../../knex";
import env from "../../env";

import * as models from "../../models";

const { TableName } = models;

export const addIP = async (ipToGet: string) => {
  const ip = ipToGet.toLowerCase();

  const currentIP = await knex<IP>(TableName.ip)
    .where({ ip })
    .first();

  if (currentIP) {
    const currentDate = new Date().toISOString();
    await knex<IP>(TableName.ip)
      .where({ ip })
      .update({
        created_at: currentDate,
        updated_at: currentDate
      });
  } else {
    await knex<IP>(TableName.ip).insert({ ip });
  }

  return ip;
};
export const getIP = async (ip: string) => {
  const cooldownConfig = env.NON_USER_COOLDOWN;
  const matchedIp = await knex<IP>(TableName.ip)
    .where({ ip: ip.toLowerCase() })
    .andWhere(
      "created_at",
      ">",
      subMinutes(new Date(), cooldownConfig).toISOString()
    )
    .first();

  return matchedIp;
};
export const clearIPs = async () =>
  knex<IP>(TableName.ip)
    .where(
      "created_at",
      "<",
      subMinutes(new Date(), env.NON_USER_COOLDOWN).toISOString()
    )
    .delete();
