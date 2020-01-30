import env from "../env";

import { v1 as NEO4J } from "neo4j-driver";
import knex from "knex";
import PQueue from "p-queue";

const queue = new PQueue({ concurrency: 10 });

// 1. Connect to Neo4j database
const neo4j = NEO4J.driver(
  env.NEO4J_DB_URI,
  NEO4J.auth.basic(env.NEO4J_DB_USERNAME, env.NEO4J_DB_PASSWORD)
);
// 2. Connect to Postgres database
const postgres = knex({
  client: "postgres",
  connection: {
    host: env.DB_HOST,
    database: env.DB_NAME,
    user: env.DB_USER,
    password: env.DB_PASSWORD
  }
});

(async function() {
  const startTime = Date.now();

  // 3. [NEO4J] Get all hosts
  const session = neo4j.session();
  session.run("MATCH (h:HOST) RETURN h").subscribe({
    onNext(record) {
      queue.add(async () => {
        // 4. [Postgres] Upsert Hosts
        const host = record.get("h").properties;
        const address = host.name;
        const banned = !!host.banned;
        const exists = await postgres<Host>("hosts")
          .where({
            address
          })
          .first();
        if (exists) {
          await postgres<Host>("hosts")
            .where("id", exists.id)
            .update({ banned });
        } else {
          await postgres<Host>("hosts").insert({
            address,
            banned
          });
        }
      });
    },
    onCompleted() {
      session.close();
      queue.add(() => {
        const endTime = Date.now();
        console.log(
          `✅ Done! It took ${(endTime - startTime) / 1000} seconds.`
        );
      });
    },
    onError(error) {
      session.close();
      throw error;
    }
  });
})();
