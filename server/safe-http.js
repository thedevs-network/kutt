const https = require("node:https");
const { Resolver } = require("node:dns").promises;
const { BlockList, isIP } = require("node:net");

const blocked = new BlockList();
for (const [address, prefix] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],
  ["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.88.99.0",24],
  ["192.168.0.0",16],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",3]]) blocked.addSubnet(address, prefix, "ipv4");
const global6 = new BlockList(); global6.addSubnet("2000::", 3, "ipv6");
for (const [address, prefix] of [["2001::",23],["2001:db8::",32],["2002::",16],["3fff::",20]]) blocked.addSubnet(address, prefix, "ipv6");
const fail = code => { const error = new Error(code); error.code = code; throw error; };

function publicAddress(address) {
  const family = isIP(address);
  return family === 4 ? !blocked.check(address, "ipv4") : family === 6 &&
    global6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}
function parse(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\s\\\x00-\x1f\x7f]/.test(value)) fail("URL_DENIED");
  let url; try { url = new URL(value); } catch { fail("URL_DENIED"); }
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash || isIP(url.hostname) ||
    url.hostname.length > 253 || !url.hostname.includes(".") || url.hostname.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
    /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example|onion)$/i.test(url.hostname)) fail("URL_DENIED");
  return url;
}
async function resolve(hostname) {
  const resolver = new Resolver({ timeout: 2000, tries: 1 });
  const timer = setTimeout(() => resolver.cancel(), 3000);
  try {
    const results = await Promise.allSettled([resolver.resolve4(hostname), resolver.resolve6(hostname)]);
    const addresses = [];
    for (const result of results) {
      if (result.status === "fulfilled") addresses.push(...result.value);
      else if (!["ENODATA", "ENOTFOUND"].includes(result.reason?.code)) fail("DNS_FAILED");
    }
    if (!addresses.length || addresses.length > 32) fail("DNS_FAILED");
    if (addresses.some(address => !publicAddress(address))) fail("ADDRESS_DENIED");
    return addresses.map(address => ({ address, family: isIP(address) }));
  } finally { clearTimeout(timer); }
}
async function validate(value) {
  const url = parse(value);
  await resolve(url.hostname);
  return url.href;
}
async function send(value, { body, headers = {}, method = "POST" } = {}) {
  const url = parse(value), addresses = await resolve(url.hostname), selected = addresses[0];
  if (!["POST", "HEAD"].includes(method) || (body && Buffer.byteLength(body) > 16384)) fail("REQUEST_DENIED");
  // Pin the validated address on the actual TLS socket. No redirect, proxy,
  // pooled connection, second DNS lookup or custom certificate bypass is used.
  return new Promise((resolveResult, reject) => {
    const request = https.request(url, {
      method, headers, agent: false, autoSelectFamily: false, family: selected.family,
      servername: url.hostname, maxHeaderSize: 8192, rejectUnauthorized: true,
      lookup: (_host, options, callback) => options.all ? callback(null, [selected]) : callback(null, selected.address, selected.family)
    });
    const timer = setTimeout(() => request.destroy(Object.assign(new Error("TIMEOUT"), { code: "TIMEOUT" })), 10000);
    const done = (error, result) => { clearTimeout(timer); error ? reject(Object.assign(new Error(error), { code: error })) : resolveResult(result); };
    request.once("error", error => done(error.code === "TIMEOUT" ? "TIMEOUT" : "CONNECTION_FAILED"));
    request.once("response", response => {
      // The status is sufficient; never parse or retain receiver-controlled bodies.
      const status = response.statusCode;
      response.destroy();
      done(null, { status });
    });
    request.end(body);
  });
}
module.exports = { publicAddress, parse, resolve, validate, send };
