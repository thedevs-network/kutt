const { createHmac, timingSafeEqual } = require("node:crypto");

// Pass the raw body, not JSON reserialized by middleware. Apply a 16 KiB body
// limit before this function. Store accepted event IDs durably alongside the
// receiver's side effect in one transaction before returning a 2xx response.
module.exports = function verifyWebhook(rawBody, headers, secret, now = Date.now()) {
  if (!Buffer.isBuffer(rawBody) || rawBody.length > 16384 || typeof secret !== "string" || !/^whsec_[\w-]{43}$/.test(secret)) throw new Error("Invalid webhook");
  const timestamp = headers["x-kutt-timestamp"], signature = headers["x-kutt-signature"], id = headers["x-kutt-event-id"];
  if (typeof timestamp !== "string" || !/^\d{10,11}$/.test(timestamp) || Math.abs(Number(timestamp) * 1000 - now) > 300000 ||
    typeof signature !== "string" || !/^v1=[a-f0-9]{64}$/.test(signature) || typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id)) throw new Error("Invalid webhook");
  const expected = createHmac("sha256", secret).update(timestamp + ".").update(rawBody).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature.slice(3), "hex"))) throw new Error("Invalid webhook");
  let payload; try { payload = JSON.parse(rawBody.toString("utf8")); } catch { throw new Error("Invalid webhook"); }
  if (!payload || payload.id !== id || typeof payload.type !== "string" || !payload.data || typeof payload.data !== "object") throw new Error("Invalid webhook");
  return payload;
};
