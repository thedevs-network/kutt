const Redis = require("ioredis");

const env = require("./env");

let client;

if (env.REDIS_ENABLED) {
  let params = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD })
  };
  if (env.REDIS_TLS_ENABLED) {
    params.tls = {
      ca: env.REDIS_TLS_CA,
      cert: env.REDIS_TLS_CERT,
      key: env.REDIS_TLS_KEY,
    };
  }
  client = new Redis(params);
}

const key = {
  link: (address, domain_id) => `l:${address}:${domain_id || ""}`,
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
    return client.del(key.link(link.address, link.domain_id));
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