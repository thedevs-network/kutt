import knex from "knex";

import { createUserTable } from "./models/user";
import { createDomainTable } from "./models/domain";
import { createLinkTable } from "./models/link";
import { createVisitTable } from "./models/visit";
import { createIPTable } from "./models/ip";
import { createHostTable } from "./models/host";
import env from "./env";

const db = knex({
  client: "postgres",
  connection: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    ssl: env.DB_SSL
  }
});

export async function initializeDb() {
  await createUserTable(db);
  await createIPTable(db);
  await createDomainTable(db);
  await createHostTable(db);
  await createLinkTable(db);
  await createVisitTable(db);
}

export default db;
