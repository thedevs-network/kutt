import cron from "node-cron";

import query from "./queries";
import env from "./env";

if (env.NON_USER_COOLDOWN) {
  cron.schedule("* */24 * * *", () => {
    query.ip.clear().catch();
  });
}
