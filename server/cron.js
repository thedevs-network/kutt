const cron = require("node-cron");

const query = require("./queries");
const utils = require("./utils");
const env = require("./env");

// check and delete links 30 secoonds
cron.schedule("*/30 * * * * *", function() {
  query.link.batchRemove({ expire_in: ["<", utils.dateToUTC(new Date())] }).catch();
});
