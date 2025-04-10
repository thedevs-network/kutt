const query = require("./queries");
const utils = require("./utils");

// check and delete links 30 secoonds
if (process.env.NODE_ENV !== 'test') {
  setInterval(function () {
    query.link.batchRemove({
      expire_in: ['<', utils.dateToUTC(new Date())]
    }).catch(() => {});
  }, 30_000);
}

