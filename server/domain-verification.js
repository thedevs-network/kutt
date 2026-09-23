const { randomBytes } = require("node:crypto");
const { Resolver } = require("node:dns/promises");
const jwt = require("jsonwebtoken");
const env = require("./env");

const audience = "kutt-domain-ownership-v1";
function challenge(address, user) {
  const value = "kutt-domain-verification=" + randomBytes(24).toString("hex");
  const expires = Math.floor(Date.now() / 1000) + 1800;
  return {
    record_name: "_kutt-verification." + address,
    record_value: value,
    expires_at: new Date(expires * 1000).toISOString(),
    proof: jwt.sign({ address, value, av: Number(user.auth_version), exp: expires }, env.JWT_SECRET,
      { algorithm: "HS256", audience, subject: String(user.id) })
  };
}
function pending(address, user, proof) {
  if (typeof proof !== "string" || proof.length > 2048) return null;
  try {
    const data = jwt.verify(proof, env.JWT_SECRET, { algorithms: ["HS256"], audience, subject: String(user.id) });
    if (data.address !== address || data.av !== Number(user.auth_version) ||
      !/^kutt-domain-verification=[a-f0-9]{48}$/.test(data.value)) return null;
    return { record_name: "_kutt-verification." + address, record_value: data.value,
      proof, expires_at: new Date(data.exp * 1000).toISOString() };
  } catch { return null; }
}
async function verify(address, user, proof) {
  const data = pending(address, user, proof);
  if (!data) return false;
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  const timer = setTimeout(() => resolver.cancel(), 3000);
  try {
    const records = await resolver.resolveTxt("_kutt-verification." + address);
    return records.some(parts => parts.join("") === data.record_value);
  } catch { return false; }
  finally { clearTimeout(timer); }
}
module.exports = { challenge, pending, verify };
