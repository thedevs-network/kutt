const cron = require('node-cron');
const { clearIPs } = require('./db/user');

if (Number(process.env.NON_USER_COOLDOWN)) {
  cron.schedule('* */24 * * *', () => {
    clearIPs().catch();
  });
}
