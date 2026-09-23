const assert = require("node:assert/strict");
module.exports = async (context, origin, address) => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, "1");
  assert.equal(new URL(origin).hostname, "127.0.0.1");
  assert(address.endsWith(".example.invalid"));
  const send = data => context.request.post(origin + "/api/domains", { data, headers: { Accept: "application/json" } });
  const response = await send({ address });
  assert.equal(response.status(), 409);
  const { verification } = await response.json();
  assert(verification?.proof, "Start the isolated app with tests/domain-proof-offline.cjs");
  const created = await send({ address, proof: verification.proof });
  assert.equal(created.status(), 200, await created.text());
  return created.json();
};
