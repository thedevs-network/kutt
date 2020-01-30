import env from "../env";

import { v1 as NEO4J } from "neo4j-driver";
import PQuque from "p-queue";
import knex from "knex";

const queue = new PQuque({ concurrency: 10 });

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

  // 3. [NEO4J] Get all users
  const session = neo4j.session();
  session
    .run(
      "MATCH (u:USER) OPTIONAL MATCH (u)-[r:RECEIVED]->(c) WITH u, collect(c.date) as cooldowns RETURN u, cooldowns"
    )
    .subscribe({
      onNext(record) {
        queue.add(async () => {
          // 4. [Postgres] Upsert users
          const user = record.get("u").properties;
          const cooldowns = record.get("cooldowns");

          const email = user.email;
          const password = user.password;
          const verified = !!user.verified;
          const banned = !!user.banned;
          const apikey = user.apikey;
          const created_at = user.createdAt;

          const data = {
            email,
            password,
            verified,
            banned,
            ...(apikey && { apikey }),
            ...(created_at && { created_at }),
            ...(cooldowns && cooldowns.length && { cooldowns })
          };

          const exists = await postgres<User>("users")
            .where({
              email
            })
            .first();
          if (exists) {
            await postgres<User>("users")
              .where("id", exists.id)
              .update(data);
          } else {
            await postgres<User>("users").insert(data);
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
