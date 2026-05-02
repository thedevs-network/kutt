const useragent = require("useragent");
const geoip = require("geoip-lite");
const URL = require("node:url");

const { removeWww } = require("../utils");
const query = require("../queries");

const osList = ["Windows", "Mac OS", "Linux", "Android", "iOS"];

function filterInOs(agent) {
  return function(item) {
    return agent.os.family.toLowerCase().includes(item.toLocaleLowerCase());
  }
}

function detectBrowser(userAgent, agent) {
  const source = (userAgent || "").toLowerCase();
  const family = agent.family.toLowerCase();

  // Check the more specific Chromium variants before generic Chrome/Safari.
  if (/edg(e|a|ios)?\//i.test(source) || family.includes("edge")) return "Edge";
  if (/opr\//i.test(source) || family.includes("opera")) return "Opera";
  if (/firefox\/|fxios\//i.test(source) || family.includes("firefox")) return "Firefox";
  if (/msie|trident\//i.test(source) || family.includes("ie")) return "IE";
  if (/chrome\/|crios\//i.test(source) || family.includes("chrome")) return "Chrome";
  if (/safari\//i.test(source) || family.includes("safari")) return "Safari";

  return "Other";
}

module.exports = function({ data }) {
  const tasks = [];
  
  tasks.push(query.link.incrementVisit({ id:  data.link.id }));
  
  // the following line is for backward compatibility
  // used to send the whole header to get the user agent
  const userAgent = data.userAgent || data.headers?.["user-agent"];
  const agent = useragent.parse(userAgent);
  const browser = detectBrowser(userAgent, agent);
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
