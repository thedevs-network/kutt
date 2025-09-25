const env = require("../env");
const { normaliseUA } = require("../utils/ua");
const isbot = require("isbot");
const geoip = require("geoip-lite");
const URL = require("node:url");
const { removeWww } = require("../utils");
const query = require("../queries");


module.exports = function({ data }) {
  // Opt-in: skip analytics rows for obvious bots (does not affect redirects or the link counter)
  if (env.SKIP_BOTS && isbot(userAgent)) {
     return Promise.all([query.link.incrementVisit({ id: data.link.id })]);
  }
  const tasks = [];
  
  tasks.push(query.link.incrementVisit({ id:  data.link.id }));
  const userAgent = (data.userAgent || data.headers?.["user-agent"] || "");

  
  const { browser, os } = normaliseUA(userAgent);
  
  // the following line is for backward compatibility
  // used to send the whole header to get the user agent
  
  const referrer =
  data.referrer && removeWww(URL.parse(data.referrer).hostname);
  
  const country = data.country || geoip.lookup(data.ip)?.country;

  tasks.push(
    query.visit.add({
      browser: browser, // already lowercased in helper
      country: country || "Unknown",
      link_id: data.link.id,
      user_id: data.link.user_id,
      os: os, // already lowercased and space-stripped in helper
      referrer: (referrer && referrer.replace(/\./gi, "[dot]")) || "Direct"
    })
  );

  return Promise.all(tasks);
}