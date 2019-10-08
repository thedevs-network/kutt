import cron from "node-cron";

import { clearIPs } from "./db/ip";

if (Number(process.env.NON_USER_COOLDOWN)) {
  cron.schedule("* */24 * * *", () => {
    clearIPs().catch();
  });
}
