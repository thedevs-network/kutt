import env from "../env";

import { v1 as NEO4J } from "neo4j-driver";
import PQueue from "p-queue";

let count = 0;
const queue = new PQueue({ concurrency: 1 });
queue.on("active", () => console.log(count++));

// 1. Connect to Neo4j database
const neo4j = NEO4J.driver(
  env.NEO4J_DB_URI,
  NEO4J.auth.basic(env.NEO4J_DB_USERNAME, env.NEO4J_DB_PASSWORD)
);

(async function() {
  const startTime = Date.now();

  const nodes = [
    ["VISITED_IN", "DATE"]
    // ['BROWSED_BY', 'BROWSER'],
    // ['OS', 'OS'],
    // ['LOCATED_IN', 'COUNTRY'],
    // ['REFERRED_BY', 'REFERRER'],
  ];

  // 3. [NEO4J] Get all hosts
  const session = neo4j.session();
  const { records } = await session.run(
    "MATCH (v:VISIT) WITH COUNT(v) as count RETURN count;"
  );
  const total = records[0].get("count").toNumber();
  const limit = 100000;

  function main(index = 0) {
    nodes.forEach(([r, n]) => {
      queue.add(() => {
        return session.run(`
          MATCH (a:VISIT)-[r:${r}]->(b:${n})
          WITH a, r, b SKIP ${index * limit} LIMIT ${limit}
          WITH a, b, TYPE(r) AS t, COLLECT(r) AS rr
          WHERE SIZE(rr) > 1
          WITH rr
          FOREACH (r IN TAIL(rr) | DELETE r);
        `);
      });
    });

    if ((index + 1) * limit < total) {
      main(index + 1);
    } else {
      queue.add(() => {
        const endTime = Date.now();
        console.log(
          `✅ Done! It took ${(endTime - startTime) / 1000} seconds.`
        );
      });
    }
  }

  main();
})();
