import useragent from "useragent";
import geoip from "geoip-lite";
import URL from "url";

import { createVisit, addLinkCount } from "../db/link";
import { getStatsLimit } from "../utils";

const browsersList = ["IE", "Firefox", "Chrome", "Opera", "Safari", "Edge"];
const osList = ["Windows", "Mac OS", "Linux", "Android", "iOS"];
const filterInBrowser = agent => item =>
  agent.family.toLowerCase().includes(item.toLocaleLowerCase());
const filterInOs = agent => item =>
  agent.os.family.toLowerCase().includes(item.toLocaleLowerCase());

export default function({ data }) {
  const tasks = [];

  tasks.push(addLinkCount(data.link.id));

  if (data.link.visit_count < getStatsLimit()) {
    const agent = useragent.parse(data.headers["user-agent"]);
    const [browser = "Other"] = browsersList.filter(filterInBrowser(agent));
    const [os = "Other"] = osList.filter(filterInOs(agent));
    const referrer = data.referrer && URL.parse(data.referrer).hostname;
    const location = geoip.lookup(data.realIP);
    const country = location && location.country;
    tasks.push(
      createVisit({
        browser: browser.toLowerCase(),
        country: country || "Unknown",
        domain: data.customDomain,
        id: data.link.id,
        os: os.toLowerCase().replace(/\s/gi, ""),
        referrer: (referrer && referrer.replace(/\./gi, "[dot]")) || "Direct"
      })
    );
  }

  return Promise.all(tasks);
}
