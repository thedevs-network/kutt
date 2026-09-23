const i18n = require("../i18n");
const analytics = require("../analytics");

function boundary(req, res, next) {
  res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "same-origin" });
  next();
}
async function get(req, res) {
  const result = await analytics.report(req);
  if (req.query.format === "csv") return res.type("text/csv").attachment("kutt-analytics.csv").send(analytics.csv(result));
  res.json(result);
}
async function page(req, res) {
  await analytics.access(req);
  const filters = analytics.filters(req.query);
  res.render("analytics", { title: i18n.t("ui.analytics"), filters, geography: require("../utils/map.json"), custom_styles: [...(res.locals.custom_styles || []), "analytics.css", "geography.css"] });
}
module.exports = { boundary, get, page };
