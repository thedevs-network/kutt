const i18n = require("../i18n");
const transfer = require("../link-transfer");
const { sameOrigin } = require("./link-history.handler");
async function preview(req, res) {
  sameOrigin(req); res.set("Cache-Control", "no-store");
  res.json(await transfer.preview(req));
}
async function commit(req, res) {
  sameOrigin(req); res.set("Cache-Control", "no-store");
  const result = await transfer.commit(req);
  res.status(result.replayed ? 200 : 201).json(result);
}
async function download(req, res) {
  const { format, body } = await transfer.exportLinks(req);
  res.set({ "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="kutt-links.${format}"`, "X-Content-Type-Options": "nosniff" });
  res.type(format === "json" ? "application/json" : "text/csv").send(body);
}
function page(req, res) {
  res.set("Cache-Control", "no-store");
  res.render("transfer", { title: i18n.t("ui.import_and_export") });
}
function template(req, res) {
  const { format, body } = transfer.template(req.query.format);
  res.set({ "Cache-Control": "no-store", "Content-Disposition": `attachment; filename="kutt-import-template.${format}"`, "X-Content-Type-Options": "nosniff" });
  res.type(format === "json" ? "application/json" : "text/csv").send(body);
}
module.exports = { preview, commit, download, template, page };
