require("dotenv").config();
import { v1 as NEO4J } from "neo4j-driver";
import knex from "knex";
import PQueue from "p-queue";
import { startOfHour } from "date-fns";

let count = 0;
const queue = new PQueue({ concurrency: 5 });

queue.on("active", () => (count % 1000 === 0 ? console.log(count++) : count++));

// 1. Connect to Neo4j database
const neo4j = NEO4J.driver(
  process.env.NEO4J_DB_URI,
  NEO4J.auth.basic(process.env.NEO4J_DB_USERNAME, process.env.NEO4J_DB_PASSWORD)
);

// 2. Connect to Postgres database
const postgres = knex({
  client: "postgres",
  connection: {
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  }
});

(async function() {
  const startTime = Date.now();

  // 3. [NEO4J] Get all links
  const session = neo4j.session();
  const { records } = await session.run(
    "MATCH (l:URL) WITH COUNT(l) as count RETURN count"
  );
  const total = records[0].get("count").toNumber();
  const limit = 20000;

  function main(index = 0) {
    queue.add(
      () =>
        new Promise((resolve, reject) => {
          session
            .run(
              "MATCH (l:URL) WITH l SKIP $skip LIMIT $limit " +
                "OPTIONAL MATCH (l)-[:USES]->(d) " +
                "OPTIONAL MATCH (l)<-[:CREATED]-(u) " +
                "OPTIONAL MATCH (v)-[:VISITED]->(l) " +
                "OPTIONAL MATCH (v)-[:BROWSED_BY]->(b) " +
                "OPTIONAL MATCH (v)-[:OS]->(o) " +
                "OPTIONAL MATCH (v)-[:LOCATED_IN]->(c) " +
                "OPTIONAL MATCH (v)-[:REFERRED_BY]->(r) " +
                "OPTIONAL MATCH (v)-[:VISITED_IN]->(dd) " +
                "WITH l, u, d, COLLECT([b.browser, o.os, c.country, r.referrer, dd.date]) as stats " +
                "RETURN l, u.email as email, d.name as domain, stats",
              { limit: limit, skip: index * limit }
            )
            .subscribe({
              onNext(record) {
                queue.add(async () => {
                  const link = record.get("l").properties;
                  const email = record.get("email");
                  const address = record.get("domain");
                  const stats = record.get("stats");

                  // 4. Merge and normalize stats based on hour
                  const visits: Record<
                    string,
                    Record<string, number | Record<string, number>>
                  > = {} as any;

                  stats.forEach(([b, o, country, referrer, date]) => {
                    if (b && o && country && referrer && date) {
                      const dateHour = startOfHour(
                        new Date(date)
                      ).toISOString();
                      const browser = b.toLowerCase();
                      const os = o === "Mac Os X" ? "macos" : o.toLowerCase();
                      visits[dateHour] = {
                        ...visits[dateHour],
                        total:
                          (((visits[dateHour] &&
                            visits[dateHour].total) as number) || 0) + 1,
                        [`br_${browser}`]:
                          (((visits[dateHour] &&
                            visits[dateHour][`br_${browser}`]) as number) ||
                            0) + 1,
                        [`os_${os}`]:
                          (((visits[dateHour] &&
                            visits[dateHour][`os_${os}`]) as number) || 0) + 1,
                        countries: {
                          ...((visits[dateHour] || {}).countries as {}),
                          [country.toLowerCase()]:
                            ((visits[dateHour] &&
                              visits[dateHour].countries[
                                country.toLowerCase()
                              ]) ||
                              0) + 1
                        },
                        referrers: {
                          ...((visits[dateHour] || {}).referrers as {}),
                          [referrer.toLowerCase()]:
                            ((visits[dateHour] &&
                              visits[dateHour].referrers[
                                referrer.toLowerCase()
                              ]) ||
                              0) + 1
                        }
                      };
                    }
                  });

                  // 5. [Postgres] Find matching user and or domain
                  const [user, domain] = await Promise.all([
                    email &&
                      postgres<User>("users")
                        .where({ email })
                        .first(),
                    address &&
                      postgres<Domain>("domains")
                        .where({ address })
                        .first()
                  ]);

                  // 6. [Postgres] Create link
                  const data = {
                    address: link.id,
                    banned: !!link.banned,
                    domain_id: domain ? domain.id : null,
                    password: link.password,
                    target: link.target,
                    user_id: user ? user.id : null,
                    ...(link.count && { visit_count: link.count.toNumber() }),
                    ...(link.createdAt && { created_at: link.createdAt })
                  };

                  const res = await postgres<Link>("links").insert(data, "id");
                  const link_id = res[0];

                  // 7. [Postgres] Create visits
                  const newVisits = Object.entries(visits).map(
                    ([date, details]) => ({
                      link_id,
                      created_at: date,
                      countries: details.countries as Record<string, number>,
                      referrers: details.referrers as Record<string, number>,
                      total: details.total as number,
                      br_chrome: details.br_chrome as number,
                      br_edge: details.br_edge as number,
                      br_firefox: details.br_firefox as number,
                      br_ie: details.br_ie as number,
                      br_opera: details.br_opera as number,
                      br_other: details.br_other as number,
                      br_safari: details.br_safari as number,
                      os_android: details.os_android as number,
                      os_ios: details.os_ios as number,
                      os_linux: details.os_linux as number,
                      os_macos: details.os_macos as number,
                      os_other: details.os_other as number,
                      os_windows: details.os_windows as number
                    })
                  );

                  await postgres<Visit>("visits").insert(newVisits);
                });
              },
              onCompleted() {
                session.close();
                if ((index + 1) * limit < total) {
                  queue.add(() => main(index + 1));
                } else {
                  queue.add(() => {
                    const endTime = Date.now();
                    console.log(
                      `✅ Done! It took ${(endTime - startTime) /
                        1000} seconds.`
                    );
                  });
                }
                resolve();
              },
              onError(error) {
                session.close();
                if ((index + 1) * limit < total) {
                  queue.add(() => main(index + 1));
                }
                reject(error);
              }
            });
        })
    );
  }
  main();
})();
