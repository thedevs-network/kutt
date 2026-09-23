const { isIP } = require("node:net");

function parse(value, env) {
  if (value === "") return null;
  const invalid = () => { throw new Error("MANAGEMENT_ORIGIN must be a distinct HTTPS origin (development HTTP loopback is allowed)."); };
  if (typeof value !== "string" || value.length > 300 || /[\s\\%?#]/.test(value) || /:\/?$/.test(value)) return invalid();
  let url;
  try { url = new URL(value); } catch { return invalid(); }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (!/^https?:\/\/[^/]+\/?$/i.test(value) || url.username || url.password || url.pathname !== "/" || url.hostname.endsWith(".") ||
      !(url.protocol === "https:" || env.isDev && loopback && url.protocol === "http:") ||
      (!isIP(url.hostname.replace(/^\[|\]$/g, "")) && (url.hostname.length > 253 || url.hostname.split(".").some(label =>
        !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))))) return invalid();
  let short;
  try { short = new URL("https://" + env.DEFAULT_DOMAIN); } catch { return invalid(); }
  // Cookie scope ignores ports. Also reserve the short router's www alias.
  if (url.hostname.replace(/^www\./, "") === short.hostname.replace(/^www\./, "")) return invalid();
  return url;
}

const configured = () => parse(require("./env").MANAGEMENT_ORIGIN, require("./env"));
function origin() {
  const env = require("./env");
  return configured()?.origin || `${env.isDev ? "http" : "https"}://${env.DEFAULT_DOMAIN}`;
}
function secureCookie() { return configured() ? configured().protocol === "https:" : require("./env").isProd; }
function reserved(address) {
  const url = configured();
  if (!url) return false;
  let host;
  try { host = new URL("https://" + address).hostname; } catch { return false; }
  return host.replace(/^www\./, "") === url.hostname.replace(/^www\./, "");
}
function requestHost(req, protocol = "https:") {
  const host = req.get("Host");
  if (typeof host !== "string" || !host || host.endsWith(":") || /[\s\\/%?#@]/.test(host)) return null;
  if (Array.isArray(req.rawHeaders)) {
    let count = 0;
    for (let index = 0; index < req.rawHeaders.length; index += 2) if (req.rawHeaders[index].toLowerCase() === "host") count++;
    if (count !== 1) return null;
  }
  try {
    const url = new URL(protocol + "//" + host);
    if (url.hostname.endsWith(".") || url.pathname !== "/") return null;
    return url.host;
  } catch { return null; }
}
function sameOrigin(req, { login = false } = {}) {
  const env = require("./env"), management = configured(), supplied = req.get("Origin");
  let allowed = !supplied;
  if (supplied) {
    if (management) allowed = supplied === management.origin;
    else if (login) {
      const url = new URL("https://" + env.DEFAULT_DOMAIN);
      allowed = supplied === url.origin;
      if (env.isDev || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
        url.protocol = "http:"; allowed ||= supplied === url.origin;
      }
    } else {
      try { allowed = new URL(supplied).host === env.DEFAULT_DOMAIN; } catch { allowed = false; }
    }
  }
  if (!allowed || req.get("Sec-Fetch-Site") === "cross-site") {
    throw new (require("./utils").CustomError)(require("./i18n").t("messages.invalid_request_origin"), 403);
  }
}
function boundary(req, res, next) {
  const management = configured();
  if (!management) return next();
  const host = requestHost(req, management.protocol);
  const deny = () => res.status(404).set("Cache-Control", "no-store").end();
  if (!host) return deny();
  req.managementHost = host === management.host;
  req.publicHost = !req.managementHost;
  if (req.managementHost) return next();
  // Do not inspect credentials or redirect management requests from short hosts.
  const path = req.path;
  const read = req.method === "GET" || req.method === "HEAD";
  if (read && (/^\/(?:images|css|scripts|libs|fonts|locales)(?:\/|$)/i.test(path) ||
      /^\/(?:banned|report|terms|404|get-report-email|get-support-email|favicon\.ico|robots\.txt|manifest\.webmanifest)\/?$/i.test(path) ||
      /^\/api\/(?:v2\/)?health\/?$/i.test(path))) return next();
  if (req.method === "POST" && (/^\/api\/(?:v2\/)?links\/(?:[a-f0-9-]{36}\/protected|report)\/?$/i.test(path) || path === "/language")) return next();
  if (read && (path === "/" || !require("./link-alias").reserved(path.slice(1)))) return next();
  return deny();
}
async function validateDatabase() {
  const management = configured();
  if (!management) return;
  const addresses = [management.host, management.hostname].map(host => host.replace(/^www\./, ""));
  if (await require("./knex")("domains").whereIn("address", addresses).first()) {
    throw new Error("MANAGEMENT_ORIGIN is already a short domain; choose an unused hostname.");
  }
}
module.exports = { parse, configured, origin, secureCookie, reserved, requestHost, sameOrigin, boundary, validateDatabase };
