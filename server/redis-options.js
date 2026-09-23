module.exports = function redisOptions(env) {
  const tls = require("./transport-tls").options(env, "REDIS");
  return {
    host: env.REDIS_HOST, port: env.REDIS_PORT, db: env.REDIS_DB,
    ...(env.REDIS_PASSWORD && { password: env.REDIS_PASSWORD }),
    ...(tls && { tls })
  };
};
