import env from "../env";

import { v1 as NEO4J } from "neo4j-driver";
import PQueue from "p-queue";
import knex from "knex";

const queue = new PQueue({ concurrency: 1 });

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

  // 3. [NEO4J] Get all domain
  const session = neo4j.session();
  session
    .run(
      "MATCH (d:DOMAIN) OPTIONAL MATCH (u)-[:OWNS]->(d) RETURN d as domain, u.email as email"
    )
    .subscribe({
      onNext(record) {
        queue.add(async () => {
          const domain = record.get("domain").properties;
          const email = record.get("email");

          // 4. [Postgres] Get user ID
          const user =
            email &&
            (await postgres<User>("users")
              .where({ email })
              .first());

          // 5. [Postgres] Upsert domains
          const banned = !!domain.banned;
          const address = domain.name;
          const homepage = domain.homepage;
          const user_id = user ? user.id : null;

          const data = {
            banned,
            address,
            ...(homepage && { homepage }),
            ...(user_id && { user_id })
          };

          const exists = await postgres<Domain>("domains")
            .where({
              address
            })
            .first();
          if (exists) {
            await postgres<Domain>("domains")
              .where("id", exists.id)
              .update(data);
          } else {
            await postgres<Domain>("domains").insert(data);
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
        console.log(error);
        session.close();
        throw error;
      }
    });
})();
