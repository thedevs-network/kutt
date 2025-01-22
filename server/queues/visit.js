const useragent = require("useragent");
const geoip = require("geoip-lite");
const URL = require("node:url");

const { removeWww } = require("../utils");
const query = require("../queries");

const browsersList = ["IE", "Firefox", "Chrome", "Opera", "Safari", "Edge"];
const osList = ["Windows", "Mac OS", "Linux", "Android", "iOS"];

function filterInBrowser(agent) {
  return function(item) {
    return agent.family.toLowerCase().includes(item.toLocaleLowerCase());
  }
}

function filterInOs(agent) {
  return function(item) {
    return agent.os.family.toLowerCase().includes(item.toLocaleLowerCase());
  }
}

module.exports = function({ data }) {
  const tasks = [];
  
  tasks.push(query.link.incrementVisit({ id:  data.link.id }));
  
  // the following line is for backward compatibility
  // used to send the whole header to get the user agent
  const userAgent = data.userAgent || data.headers?.["user-agent"];
  const agent = useragent.parse(userAgent);
  const [browser = "Other"] = browsersList.filter(filterInBrowser(agent));
  const [os = "Other"] = osList.filter(filterInOs(agent));
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