import useragent from "useragent";
import geoip from "geoip-lite";
import URL from "url";

import query from "../queries";
import { getStatsLimit, removeWww } from "../utils";

const browsersList = ["IE", "Firefox", "Chrome", "Opera", "Safari", "Edge"];
const osList = ["Windows", "Mac OS", "Linux", "Android", "iOS"];
const filterInBrowser = (agent) => (item) =>
  agent.family.toLowerCase().includes(item.toLocaleLowerCase());
const filterInOs = (agent) => (item) =>
  agent.os.family.toLowerCase().includes(item.toLocaleLowerCase());

export default function visit({ data }) {
  const tasks = [];

  tasks.push(query.link.incrementVisit({ id: data.link.id }));

  if (data.link.visit_count < getStatsLimit()) {
    const agent = useragent.parse(data.headers["user-agent"]);
    const [browser = "Other"] = browsersList.filter(filterInBrowser(agent));
    const [os = "Other"] = osList.filter(filterInOs(agent));
    const referrer =
      data.referrer && removeWww(URL.parse(data.referrer).hostname);
    const location = geoip.lookup(data.realIP);
    const country = location && location.country;
    tasks.push(
      query.visit.add({
        browser: browser.toLowerCase(),
        country: country || "Unknown",
        id: data.link.id,
        os: os.toLowerCase().replace(/\s/gi, ""),
        referrer: (referrer && referrer.replace(/\./gi, "[dot]")) || "Direct"
      })
    );
  }

  return Promise.all(tasks);
}
