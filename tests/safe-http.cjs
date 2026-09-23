const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
module.exports = async root => {
  const path = require("node:path"), safe = require(path.join(root, "server/safe-http"));
  for (const ip of ["127.0.0.1", "0.0.0.0", "10.2.3.4", "100.66.109.48", "169.254.169.254", "172.31.1.1", "192.168.1.1", "192.0.2.1", "198.18.0.1", "198.51.100.1", "203.0.113.1", "224.1.1.1", "255.255.255.255", "::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "fe80::1", "fc00::1", "64:ff9b::a00:1", "2001:db8::1", "2001::1", "2002:7f00:1::", "3fff::1", "garbage"]) assert.equal(safe.publicAddress(ip), false, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(safe.publicAddress(ip), true, ip);
  for (const value of ["http://hooks.example.com", "https://127.1/", "https://2130706433/", "https://0x7f000001/", "https://[::1]/", "https://user:secret@hooks.example.com", "https://hooks.example.com:444", "https://hooks.example.com/#token", "https://localhost", "https://foo.local", "https://foo.internal", "https://foo.invalid", "https://hooks.example.com./", "https://hooks.example.com\\@private/", "https://hooks.example.com/\n", "ftp://hooks.example.com"]) assert.throws(() => safe.parse(value), /URL_DENIED/, value);
  const { Resolver } = require("node:dns").promises, https = require("node:https");
  const originals = { r4: Resolver.prototype.resolve4, r6: Resolver.prototype.resolve6, request: https.request };
  let answers = ["8.8.8.8"], calls = 0, lastMethod;
  Resolver.prototype.resolve4 = async () => answers;
  Resolver.prototype.resolve6 = async () => { throw Object.assign(new Error(), { code: "ENODATA" }); };
  https.request = (url, options) => {
    calls++; lastMethod = options.method; assert.equal(url.hostname, "hooks.example.com"); assert.equal(options.servername, url.hostname);
    assert.equal(options.agent, false); assert.equal(options.autoSelectFamily, false); assert.equal(options.maxHeaderSize, 8192);
    assert.equal(options.rejectUnauthorized, true, "TLS certificate validation is mandatory");
    assert.equal(options.checkServerIdentity, undefined);
    options.lookup(url.hostname, {}, (err, address, family) => { assert.equal(err, null); assert.equal(address, "8.8.8.8"); assert.equal(family, 4); });
    options.lookup(url.hostname, { all: true }, (err, result) => { assert.equal(err, null); assert.deepEqual(result, [{ address: "8.8.8.8", family: 4 }]); });
    const request = new EventEmitter(); request.destroy = error => request.emit("error", error);
    request.end = () => { answers = ["127.0.0.1"]; queueMicrotask(() => request.emit("response", { statusCode: 302, destroy() {} })); };
    return request;
  };
  try {
    assert.equal(await safe.validate("https://hooks.example.com/a?secret=not-logged"), "https://hooks.example.com/a?secret=not-logged");
    assert.equal((await safe.send("https://hooks.example.com/hook", { body: "{}" })).status, 302); assert.equal(calls, 1, "Never follow receiver redirects");
    await assert.rejects(safe.send("https://hooks.example.com/hook", { body: "{}" }), /ADDRESS_DENIED/); assert.equal(calls, 1, "Rebinding rejected before a new socket");
    answers = ["8.8.8.8"];
    assert.equal((await safe.send("https://hooks.example.com/health", { method: "HEAD" })).status, 302);
    assert.equal(lastMethod, "HEAD"); assert.equal(calls, 2, "HEAD must not follow redirects or retry with GET");
    answers = ["8.8.8.8", "10.0.0.1"]; await assert.rejects(safe.validate("https://hooks.example.com"), /ADDRESS_DENIED/);
    answers = ["2606:4700:4700::1111", "::ffff:127.0.0.1"]; await assert.rejects(safe.validate("https://hooks.example.com"), /ADDRESS_DENIED/);
    answers = []; await assert.rejects(safe.validate("https://hooks.example.com"), /DNS_FAILED/);
    answers = ["8.8.8.8"]; Resolver.prototype.resolve6 = async () => { throw Object.assign(new Error(), { code: "ETIMEOUT" }); };
    await assert.rejects(safe.validate("https://hooks.example.com"), /DNS_FAILED/, "Incomplete DNS validation fails closed");
  } finally { Resolver.prototype.resolve4 = originals.r4; Resolver.prototype.resolve6 = originals.r6; https.request = originals.request; }
  console.log("PASS: strict HTTPS URLs, IPv4/IPv6 reserved ranges, mixed DNS, rebinding, address-pinned TLS socket and no redirects");
};
