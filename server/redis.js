const Redis = require("ioredis");

const env = require("./env");

let client;

if (env.REDIS_ENABLED) {
  client = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD })
  });
}

const key = {
  // Case-insensitive lookups use a separate key so a cached mixed-case hit
  // is not reused after the mode is turned off.
  link: (address, domain_id, caseInsensitive = false) => {
    const normalized = caseInsensitive ? String(address).toLowerCase() : address;
    const prefix = caseInsensitive ? "l:ci:" : "l:";
    return `${prefix}${normalized}:${domain_id || ""}`;
  },
  domain: (address) => `d:${address}`,
  stats: (link_id) => `s:${link_id}`,
  host: (address) => `h:${address}`,
  user: (idOrKey) => `u:${idOrKey}`
};

const remove = {
  domain: (domain) => {
    if (!domain) return;
    return client.del(key.domain(domain.address));
  },
  host: (host) => {
    if (!host) return;
    return client.del(key.host(host.address));
  },
  link: (link) => {
    if (!link) return;
    return client.del(
      key.link(link.address, link.domain_id, false),
      key.link(link.address, link.domain_id, true),
    );
  },
  user: (user) => {
    if (!user) return;
    return Promise.all([
      client.del(key.user(user.id)),
      client.del(key.user(user.apikey)),
    ]);
  }
};


module.exports = {
  client,
  key,
  remove,
}