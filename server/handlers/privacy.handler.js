const i18n = require("../i18n");
const privacy = require("../analytics-privacy");
const routing = require("../link-routing");
const { sameOrigin } = require("./link-history.handler");
function boundary(req, res, next) {
  res.set({ "Cache-Control": "private, no-store", "Referrer-Policy": "same-origin" });
  if (!["GET", "HEAD"].includes(req.method)) sameOrigin(req);
  next();
}
async function getTracking(req, res) {
  const link = await routing.owned(req);
  res.json({ ...await privacy.tracking(link.id), id: link.uuid, address: link.address });
}
async function saveTracking(req, res) { res.json(await privacy.saveTracking(req)); }
async function getRetention(req, res) { await privacy.administrator(req); res.json(await privacy.retention()); }
async function previewRetention(req, res) { res.json(await privacy.previewRetention(req)); }
async function saveRetention(req, res) { res.json(await privacy.saveRetention(req)); }
async function trackingPage(req, res) {
  const link = await routing.owned(req);
  res.render("privacy", { title: i18n.t("messages.tracking"), link_id: link.uuid, address: link.address,
    custom_styles: [...(res.locals.custom_styles || []), "privacy.css"] });
}
async function retentionPage(req, res) {
  await privacy.administrator(req);
  res.render("privacy", { title: i18n.t("ui.analytics_retention"), retention: true,
    custom_styles: [...(res.locals.custom_styles || []), "privacy.css"] });
}
module.exports = { boundary, getTracking, saveTracking, getRetention, previewRetention, saveRetention, trackingPage, retentionPage };
