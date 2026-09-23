const { isIP } = require("node:net");
const express = require("express");

module.exports = function parseProxyTrust(value) {
  if ([true, "true", "t", "1"].includes(value)) return true;
  if ([false, "false", "f", "0"].includes(value)) return false;
  const fail = () => { throw new Error("TRUST_PROXY requires a boolean, hops:0..32, or peers:IP[,CIDR]."); };
  if (typeof value !== "string") return fail();
  if (/^hops:(0|[1-9]\d?)$/.test(value)) {
    const hops = Number(value.slice(5));
    return hops <= 32 ? hops : fail();
  }
  if (!value.startsWith("peers:") || value.length > 4096) return fail();
  const peers = value.slice(6).split(",").map(peer => peer.trim());
  if (!peers.length || peers.length > 64) return fail();
  for (const peer of peers) {
    const parts = peer.split("/");
    const version = isIP(parts[0]);
    if (!version || parts[0].includes("%") || parts.length > 2) return fail();
    if (parts.length === 2 && (!/^(0|[1-9]\d{0,2})$/.test(parts[1]) || Number(parts[1]) > (version === 4 ? 32 : 128))) return fail();
  }
  // Validate with the same public API used at startup, including mapped IPv6 ranges.
  // Express remains responsible for compiling and matching addresses.
  try { express().set("trust proxy", peers); } catch { return fail(); }
  return peers;
};
