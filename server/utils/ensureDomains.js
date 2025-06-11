const env = require("../env");
const query = require("../queries");
const utils = require("./utils");

async function ensureDomains() {
  // List of domains to ensure in DB
  const domains = [
    env.DEFAULT_DOMAIN.trim().toLowerCase(),
    ...utils.getGlobalDomains().map(d => d.trim().toLowerCase())
  ].filter(Boolean);

  for (const address of domains) {
    let domain = await query.domain.find({ address });
    if (!domain) {
      await query.domain.add({ address, user_id: null, banned: false });
      console.log(`Added domain to DB: ${address}`);
    }
  }
}

module.exports = ensureDomains;
