const useragent = require("express-useragent").default;
const geoip = require("geoip-lite");
const URL = require("node:url");

const { removeWww, getUseragentBrowser, getUseragentOS } = require("../utils");
const query = require("../queries");

module.exports = function({ data }) {
  const tasks = [];
  
  tasks.push(query.link.incrementVisit({ id:  data.link.id }));
  
  // the following line is for backward compatibility
  // used to send the whole header to get the user agent
  const userAgent = data.userAgent || data.headers?.["user-agent"];
  const agent = useragent.parse(userAgent);
  const browser = getUseragentBrowser(agent);
  const os = getUseragentOS(agent);
  // A malformed Referrer header can make url.parse().hostname null, which would
  // otherwise throw inside removeWww() and silently drop this visit entirely
  // (incrementVisit already ran, so stats would drift), so guard it here since
  // we're already touching this line.
  const referrerHostname = data.referrer && URL.parse(data.referrer).hostname;
  const referrer = referrerHostname && removeWww(referrerHostname);

  // `country` may come straight from the client-supplied `cf-ipcountry` header
  // (see links.handler.js), so re-validate its shape before it's used as an
  // object key in the persisted stats JSON (visit.queries.js). geoip-lite's own
  // output is always a 2-letter ISO 3166-1 alpha-2 code; Cloudflare also legitimately sends
  // non-letter codes like "T1" (Tor) or "XX" (unknown), so this allows any 2-char
  // alphanumeric code and only rejects genuinely spoofed values (anything that
  // could double as a dangerous property name is longer than 2 characters anyway).
  const rawCountry = data.country || geoip.lookup(data.ip)?.country;
  const country = /^[A-Z0-9]{2}$/i.test(rawCountry || "") ? rawCountry : "Unknown";

  // Referrer hostname is fully attacker-controlled. Reject values that would
  // become dangerous keys once persisted as JSON and iterated with Object.keys.
  const dangerousKeys = ["__proto__", "constructor", "prototype"];
  const safeReferrer = referrer && !dangerousKeys.includes(referrer.toLowerCase())
    ? referrer.replace(/\./gi, "[dot]")
    : null;

  tasks.push(
    query.visit.add({
      browser,
      country,
      os,
      link_id: data.link.id,
      user_id: data.link.user_id,
      referrer: safeReferrer || "Direct"
    })
  );

  return Promise.all(tasks);
}
