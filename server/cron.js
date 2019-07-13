const cron = require('node-cron');
const { clearIps } = require('./db/user');

if (Number(process.env.NON_USER_COOLDOWN)) {
  cron.schedule('* */24 * * *', () => {
    clearIps().catch();
  });
}
