const Redis = require("ioredis");

const env = require("./env");

const client = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  db: env.REDIS_DB,
  ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD })
});

const key = {
  link: (address, domain_id, user_id) => `${address}-${domain_id || ""}-${user_id || ""}`,
  domain: (address) => `d-${address}`,
  stats: (link_id) => `s-${link_id}`,
  host: (address) => `h-${address}`,
  user: (emailOrKey) => `u-${emailOrKey}`
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
      client.del(key.user(user.email)),
      client.del(key.user(user.apikey))
    ]);
  }
};


module.exports = {
  client,
  key,
  remove,
}