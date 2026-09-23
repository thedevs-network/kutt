const tls = require("node:tls");
const net = require("node:net");
const { X509Certificate, createPrivateKey } = require("node:crypto");

const fail = message => { throw new Error(message); };
const dnsName = host => typeof host === "string" && host.length <= 253 &&
  host.split(".").every(label => /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label));

function certificates(value, name) {
  try {
    const parts = value.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
    if (!parts?.length || value.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, "").trim()) throw new Error();
    return parts.map(part => new X509Certificate(part));
  } catch { fail("Invalid " + name + " certificate material."); }
}

function options(env, prefix) {
  const enabled = env[prefix + "_SSL"];
  const ca = env[prefix + "_SSL_CA"], cert = env[prefix + "_SSL_CERT"], key = env[prefix + "_SSL_KEY"];
  if (!enabled) {
    if (ca || cert || key) fail(prefix + " TLS material requires " + prefix + "_SSL=true.");
    return false;
  }
  const host = env[prefix + "_HOST"];
  const ip = net.isIP(host);
  if (!ip && !dnsName(host)) fail(prefix + " TLS requires a valid DNS hostname or IP address.");
  if (prefix === "DB") {
    if (!["pg", "mysql2"].includes(env.DB_CLIENT)) fail("Verified database TLS supports pg and mysql2 only.");
    // These drivers upgrade a preconnected socket. mysql2 ignores a supplied
    // identity checker; require DNS so both drivers verify the intended host.
    if (ip) fail("Verified database TLS requires a DNS hostname, not an IP address.");
  } else if (!env.REDIS_ENABLED) fail("Redis TLS requires REDIS_ENABLED=true.");
  if (Boolean(cert) !== Boolean(key)) fail(prefix + " TLS requires both client certificate and key.");
  if (ca) certificates(ca, prefix + "_SSL_CA");
  if (cert) {
    const chain = certificates(cert, prefix + "_SSL_CERT");
    try {
      if (!chain[0].checkPrivateKey(createPrivateKey(key))) throw new Error();
    } catch { fail("Invalid or mismatched " + prefix + " TLS client certificate and key."); }
  }
  const result = { rejectUnauthorized: true, minVersion: "TLSv1.2",
    ...(ca && { ca }), ...(cert && { cert, key }), ...(!ip && { servername: host }) };
  try { tls.createSecureContext(result); }
  catch { fail("Invalid " + prefix + " TLS configuration."); }
  if (prefix === "DB" && env.DB_CLIENT === "mysql2") result.verifyIdentity = true;
  if (prefix === "REDIS") result.checkServerIdentity = (_hostname, peer) => tls.checkServerIdentity(host, peer);
  return result;
}

function validate(env, raw = process.env) {
  for (const prefix of ["DB", "REDIS"]) {
    for (const field of ["CA", "CERT", "KEY"]) {
      const name = prefix + "_SSL_" + field;
      if ((Object.hasOwn(raw, name) || Object.hasOwn(raw, name + "_FILE")) && !env[name]?.trim()) {
        fail("Configured " + name + " must not be empty.");
      }
    }
    options(env, prefix);
  }
}

module.exports = { options, validate };
