import knex from "knex";
import { createUserTable } from "./models/user";
import { createDomainTable } from "./models/domain";
import { createLinkTable } from "./models/link";
import { createVisitTable } from "./models/visit";
import { createIPTable } from "./models/ip";
import { createHostTable } from "./models/host";

const db = knex({
  client: "postgres",
  connection: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL === "true"
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
