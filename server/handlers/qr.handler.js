const i18n = require("../i18n");
const QRCode = require("qrcode");
const query = require("../queries");
const knex = require("../knex");
const { CustomError, getShortURL } = require("../utils");
const { describe } = require("../link-lifecycle");

function options(input) {
  const size = input.size === undefined ? "512" : input.size;
  const level = input.level === undefined ? "M" : input.level;
  const format = input.format === undefined ? "png" : input.format;
  if (typeof size !== "string" || !/^\d{3,4}$/.test(size) || Number(size) < 128 || Number(size) > 1024 ||
      typeof level !== "string" || !["L", "M", "Q", "H"].includes(level) ||
      typeof format !== "string" || !["png", "svg"].includes(format)) {
    throw new CustomError(i18n.t("messages.choose_png_svg_a_size_from_128_to_1024_and_correction"), 400);
  }
  return { size: Number(size), level, format };
}

async function load(req, res, input = req.query) {
  res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" });
  if (!/^[a-f0-9-]{36}$/i.test(req.params.id)) throw new CustomError(i18n.t("messages.link_was_not_found"), 404);
  const link = await query.link.find({ uuid: req.params.id, user_id: req.user.id }, { fresh: true, includeTrash: true });
  if (!link || link.banned || (req.apiTokenDomain !== undefined && (link.domain_id !== req.apiTokenDomain || link.archived_domain))) {
    throw new CustomError(i18n.t("messages.link_was_not_found"), 404);
  }
  if (link.deleted_at || link.archived_domain) throw new CustomError(i18n.t("messages.restore_the_link_and_its_domain_before_exporting_a_qr_code"), 410);
  if (link.domain_id && !await require("../domain-access").find(knex, req.user.id, { id: link.domain_id })) {
    throw new CustomError(i18n.t("messages.the_short_domain_is_unavailable"), 410);
  }
  const url = getShortURL(link.address, link.domain).url;
  let parsed;
  try { parsed = new URL(url); } catch {}
  if (!parsed || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || url.length > 1000) {
    throw new CustomError(i18n.t("messages.this_short_url_cannot_be_encoded_safely"), 400);
  }
  const settings = options(input);
  let modules;
  try { modules = QRCode.create(url, { errorCorrectionLevel: settings.level }).modules; }
  catch { throw new CustomError(i18n.t("messages.this_short_url_is_too_large_for_the_chosen_qr_correction"), 400); }
  if (modules.size + 8 > settings.size) {
    throw new CustomError(i18n.t("messages.choose_a_larger_qr_image_size"), 400);
  }
  return { link, url, modules, ...settings };
}

async function download(req, res) {
  let input = req.query, logo;
  if (req.method === "POST") {
    require("./link-history.handler").sameOrigin(req);
    if (!req.is("application/json") || !req.body || Array.isArray(req.body)) throw new CustomError(i18n.t("qr.json_required"), 400);
    if (Object.keys(req.body).some(key => !["size", "level", "format", "logo"].includes(key))) throw new CustomError(i18n.t("qr.unknown_setting"), 400);
    input = { ...req.body };
    if (typeof input.size === "number" && Number.isInteger(input.size)) input.size = String(input.size);
    if (input.logo !== undefined) { options(input); input.level = "H"; }
  }
  const { link, url, modules, size, level, format } = await load(req, res, input);
  if (req.method === "POST" && input.logo !== undefined) logo = require("../qr-logo").decode(input.logo);
  // Never fetch the destination or encode target/password/session data.
  const renderer = require("../qr-image");
  const bytes = format === "svg" ? await renderer.renderSVG(url, modules, size, level, logo) : renderer.renderPNG(modules, size, logo);
  res.set("Content-Disposition", `attachment; filename="kutt-qr-${link.uuid}.${format}"`);
  if (format === "svg") res.set("Content-Security-Policy", logo ? "default-src 'none'; img-src data:; sandbox" : "default-src 'none'; sandbox");
  res.type(format === "svg" ? "image/svg+xml" : "image/png").send(bytes);
}

async function page(req, res) {
  const { link, url, size, level } = await load(req, res);
  const lifecycle = describe(link);
  res.render("qr", { title: i18n.t("ui.qr_code"), id: link.uuid, short_url: url,
    lifecycle_status: lifecycle.lifecycle_status, lifecycle_label: lifecycle.lifecycle_label, protected: !!link.password,
    image_url: `/api/links/${link.uuid}/qr?size=${size}&level=${level}`,
    svg_url: `/api/links/${link.uuid}/qr?size=${size}&level=${level}&format=svg`,
    size, levels: ["L", "M", "Q", "H"].map(value => ({ value, selected: value === level })) });
}

module.exports = { download, page };
