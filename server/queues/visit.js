const UAParser = require("ua-parser-js");
const geoip = require("geoip-lite");
const URL = require("node:url");

const { removeWww } = require("../utils");
const query = require("../queries");

const browsersList = ["IE", "Firefox", "Chrome", "Opera", "Safari", "Edge"];
const osList = ["Windows", "Mac OS", "Linux", "Android", "iOS"];

function filterInBrowser(browserName) {
  return function(item) {
    return browserName.toLowerCase().includes(item.toLowerCase());
  }
}

function filterInOs(osName) {
  return function(item) {
    return osName.toLowerCase().includes(item.toLowerCase());
  }
}

module.exports = function({ data }) {
  const tasks = [];

  tasks.push(query.link.incrementVisit({ id:  data.link.id }));

  // the following line is for backward compatibility
  // used to send the whole header to get the user agent
  const userAgent = data.userAgent || data.headers?.["user-agent"];
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  const [browser = "Other"] = browsersList.filter(filterInBrowser(result.browser.name || ""));
  const [os = "Other"] = osList.filter(filterInOs(result.os.name || ""));
  const referrer =
  data.referrer && removeWww(URL.parse(data.referrer).hostname);

  const country = data.country || geoip.lookup(data.ip)?.country;

  tasks.push(
    query.visit.add({
      browser: browser.toLowerCase(),
      country: country || "Unknown",
      link_id: data.link.id,
      user_id: data.link.user_id,
      os: os.toLowerCase().replace(/\s/gi, ""),
      referrer: (referrer && referrer.replace(/\./gi, "[dot]")) || "Direct"
    })
  );

  return Promise.all(tasks);
}
