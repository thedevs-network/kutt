const assert = require("node:assert/strict");
const http = require("node:http");
const express = require("express");
const parse = require("../server/proxy-trust");

module.exports = async function() {
  for (const input of [true, "true", "t", "1"]) assert.equal(parse(input), true);
  for (const input of [false, "false", "f", "0"]) assert.equal(parse(input), false);
  for (const count of [0, 1, 2, 32]) assert.equal(parse("hops:" + count), count);
  assert.deepEqual(parse("peers:127.0.0.1, ::1/128,192.0.2.0/24"), ["127.0.0.1", "::1/128", "192.0.2.0/24"]);
  for (const value of ["peers:0.0.0.0/0", "peers:::/0", "peers:::ffff:192.0.2.0/129"]) {
    assert.throws(() => parse(value), /TRUST_PROXY/, value);
  }
  for (const value of ["peers:127.0.0.1", "peers:::1/128", "peers:::ffff:192.0.2.0/120"]) {
    assert.doesNotThrow(() => express().set("trust proxy", parse(value)));
  }
  for (const value of ["", " true ", "2", "hops:01", "hops:-1", "hops:33", "hops:1.5", "hops:1e1", "hops:Infinity", "hops:2x", "peers:", "peers:127.0.0.1,", "peers:localhost", "peers:127.1", "peers:127.0.0.1:443", "peers:fe80::1%eth0", "peers:192.0.2.0/33", "peers:::1/129", "peers:192.0.2.0/01", "peers:192.0.2.0/2e1", "peers:192.0.2.0/24/1"]) {
    assert.throws(() => parse(value), /TRUST_PROXY/, value);
  }
  const app = express();
  const budgets = new Map();
  app.get("/", (req, res) => {
    const count = (budgets.get(req.ip) || 0) + 1;
    budgets.set(req.ip, count);
    res.json({ ip: req.ip, ips: req.ips, secure: req.secure, count });
  });
  const server = await new Promise(resolve => { const running = app.listen(0, "::", () => resolve(running)); });
  const send = (forwarded, host = "127.0.0.1") => new Promise((resolve, reject) => {
    const headers = { "x-forwarded-proto": "https" };
    if (forwarded !== undefined) headers["x-forwarded-for"] = forwarded;
    http.get({ host, port: server.address().port, headers }, res => {
      let body = ""; res.on("data", chunk => body += chunk);
      res.on("end", () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
    }).on("error", reject);
  });
  try {
    app.set("trust proxy", parse("false"));
    let result = await send("203.0.113.99");
    assert.equal(result.ip, "::ffff:127.0.0.1"); assert.equal(result.secure, false);
    app.set("trust proxy", parse("peers:192.0.2.0/24"));
    result = await send("203.0.113.99");
    assert.equal(result.ip, "::ffff:127.0.0.1"); assert.equal(result.secure, false);
    app.set("trust proxy", parse("peers:127.0.0.1,::1,192.0.2.0/24"));
    result = await send("203.0.113.1, 198.51.100.1, 192.0.2.2");
    assert.equal(result.ip, "198.51.100.1"); assert.equal(result.secure, true);
    const spoof = await send("203.0.113.200, 198.51.100.1, 192.0.2.2");
    assert.equal(spoof.ip, result.ip); assert.equal(spoof.count, result.count + 1);
    result = await send("198.51.100.2, 192.0.2.2", "::1");
    assert.equal(result.ip, "198.51.100.2"); assert.equal(result.count, 1);
    assert.equal((await send(undefined)).ip, "::ffff:127.0.0.1");
    assert.equal((await send("garbage, 198.51.100.1")).ip, "198.51.100.1");
    for (const [hops, expected] of [[0, "::ffff:127.0.0.1"], [1, "192.0.2.2"], [2, "198.51.100.1"]]) {
      app.set("trust proxy", parse("hops:" + hops));
      assert.equal((await send("203.0.113.1, 198.51.100.1, 192.0.2.2")).ip, expected);
    }
    // Hop mode intentionally trusts a shorter path; deployments must prevent it.
    assert.equal((await send("203.0.113.9")).ip, "203.0.113.9");
    console.log("PASS: strict proxy configuration, real IPv4/IPv6 requests, spoof resistance, separate client budgets and hop topology");
  } finally { await new Promise(resolve => server.close(resolve)); }
};
