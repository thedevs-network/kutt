import Queue from "bull";
import useragent from "useragent";
import geoip from "geoip-lite";
import URL from "url";

import { createVisit, addLinkCount } from "./db/link";

const redis = {
  port: Number(process.env.REDIS_PORT) || 6379,
  host: process.env.REDIS_HOST || "127.0.0.1",
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD })
};

export const visitQueue = new Queue("visit", { redis });

const browsersList = ["IE", "Firefox", "Chrome", "Opera", "Safari", "Edge"];
const osList = ["Windows", "Mac OS", "Linux", "Android", "iOS"];
const filterInBrowser = agent => item =>
  agent.family.toLowerCase().includes(item.toLocaleLowerCase());
const filterInOs = agent => item =>
  agent.os.family.toLowerCase().includes(item.toLocaleLowerCase());

visitQueue.process(({ data }) => {
  const agent = useragent.parse(data.headers["user-agent"]);
  const [browser = "Other"] = browsersList.filter(filterInBrowser(agent));
  const [os = "Other"] = osList.filter(filterInOs(agent));
  const referrer = data.referrer && URL.parse(data.referrer).hostname;
  const location = geoip.lookup(data.realIP);
  const country = location && location.country;

  return Promise.all([
    addLinkCount(data.link.id),
    createVisit({
      browser: browser.toLowerCase(),
      country: country || "Unknown",
      domain: data.customDomain,
      id: data.link.id,
      os: os.toLowerCase().replace(/\s/gi, ""),
      referrer: (referrer && referrer.replace(/\./gi, "[dot]")) || "Direct"
    })
  ]);
});
