const cron = require("node-cron");

const query = require("./queries");
const utils = require("./utils");
const env = require("./env");

if (env.NON_USER_COOLDOWN) {
  cron.schedule("* */24 * * *", function() {
    query.ip.clear().catch();
  });
}

cron.schedule("*/1 * * * * *", function() {
  query.link.batchRemove({ expire_in: ["<", utils.dateToUTC(new Date())] }).catch();
});
