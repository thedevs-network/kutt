const i18n = require("../i18n");
const library = require("../library");
const { sameOrigin } = require("./link-history.handler");
const { CustomError } = require("../utils");
const { createHmac, timingSafeEqual } = require("node:crypto");
const env = require("../env");

const noticeCookie = "kutt_library_notice";
const noticeOptions = req => ({ httpOnly: true, sameSite: "strict", secure: req.secure, path: "/settings/library" });
const noticeSignature = data => createHmac("sha256", env.JWT_SECRET).update("library-notice-v1\0" + data).digest("hex");
const actionNames = { add_label: "messages.label_assignment", remove_label: "messages.label_removal", pause: "ui.pause", resume: "ui.resume", trash: "ui.move_to_trash" };
function readNotice(req, res) {
  const value = req.cookies?.[noticeCookie];
  if (!value) return;
  res.clearCookie(noticeCookie, noticeOptions(req));
  if (typeof value !== "string" || value.length > 1000) return;
  const [data, signature, extra] = value.split(".");
  if (extra || !/^[a-f0-9]{64}$/.test(signature || "") ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(noticeSignature(data)))) return;
  try {
    const result = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (result.user !== req.user.id || !Object.hasOwn(actionNames, result.action) ||
        !Number.isInteger(result.affected) || result.affected < 1 || result.affected > 100 ||
        !Number.isFinite(result.expires) || result.expires < Date.now() || result.expires > Date.now() + 60000) return;
    return i18n.t("library.bulk_applied", { action: i18n.t(actionNames[result.action]), count: result.affected });
  } catch {}
}

function metadataAccess(req) {
  if (req.apiTokenDomain !== undefined) throw new CustomError(i18n.t("messages.account_labels_and_filters_require_an_unrestricted_domain_scope"), 403);
}

async function list(req, res) {
  res.set("Cache-Control", "no-store");
  res.json(await library.list(req.user.id, req.query, req.apiTokenDomain));
}

async function mutate(req, operation) {
  sameOrigin(req);
  if (typeof operation !== "string") throw new CustomError(i18n.t("messages.invalid_action"), 400);
  const input = req.body;
  const id = req.params.id || input.id;
  if (id !== undefined && (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id))) throw new CustomError(i18n.t("messages.invalid_identifier"), 400);
  if (operation.startsWith("remove_") && !id) throw new CustomError(i18n.t("messages.an_identifier_is_required"), 400);
  if (operation === "bulk") return library.bulk(req.user.id, input, { id: req.user.id, apiToken: req.apiToken }, req.apiTokenDomain, req);
  metadataAccess(req);
  switch (operation) {
    case "save_label": return library.saveLabel(req.user.id, input, id);
    case "remove_label": return library.removeLabel(req.user.id, id);
    case "save_filter": return library.saveFilter(req.user.id, { ...input, filters: input.filters || input }, id);
    case "remove_filter": return library.removeFilter(req.user.id, id);
    default: throw new CustomError(i18n.t("messages.invalid_action"), 400);
  }
}

const api = operation => async (req, res) => {
  res.set("Cache-Control", "no-store");
  const result = await mutate(req, operation);
  if (result === undefined) return res.sendStatus(204);
  res.status(req.method === "POST" && operation !== "bulk" ? 201 : 200).json(result);
};

function viewURL(filters, page = 1) {
  return "/settings/library?" + new URLSearchParams({ ...filters, page }).toString();
}

async function page(req, res, error) {
  res.set("Cache-Control", "no-store");
  // Native forms need their same-origin Origin; never accept the opaque null origin.
  res.set("Referrer-Policy", "same-origin");
  const notice = readNotice(req, res);
  let filters = req.query;
  if (error && typeof req.body.return_to === "string" && req.body.return_to.length < 8192) {
    let previous;
    try { previous = new URL(req.body.return_to, "https://kutt.invalid"); } catch {}
    if (previous?.origin === "https://kutt.invalid" && previous.pathname === "/settings/library") {
      filters = Object.fromEntries([...previous.searchParams.keys()].map(key => [key,
        previous.searchParams.getAll(key).length === 1 ? previous.searchParams.get(key) : previous.searchParams.getAll(key)]));
    }
  }
  let result;
  try { result = await library.list(req.user.id, filters); }
  catch (failure) {
    if (!error || !(failure instanceof CustomError)) throw failure;
    // Deleted or malformed filter references cannot prevent showing the action error.
    result = await library.list(req.user.id, {});
  }
  const tags = result.labels.filter(row => row.kind === "tag").map(row => ({ ...row, selected: row.id === result.filters.tag }));
  const collections = result.labels.filter(row => row.kind === "collection").map(row => ({ ...row, selected: row.id === result.filters.collection }));
  return res.render("library", {
    title: i18n.t("ui.library"), ...result, tags, collections, error, notice: error ? undefined : notice,
    states: Object.entries({ active: i18n.t("ui.not_in_trash"), paused: i18n.t("ui.paused"), unpaused: i18n.t("messages.not_paused"), trash: i18n.t("ui.in_trash") })
      .map(([value, label]) => ({ value, label, selected: value === result.filters.state })),
    view_url: viewURL(result.filters, result.page),
    previous: result.page > 1 ? viewURL(result.filters, result.page - 1) : null,
    next: result.page * result.limit < result.total ? viewURL(result.filters, result.page + 1) : null,
    saved_filters: result.saved_filters.map(row => ({ ...row, url: "/settings/library?saved=" + row.id })),
    data: result.data.map(row => ({ ...row, selectable: !row.deleted_at && !row.banned }))
  });
}

async function submit(req, res) {
  try {
    const result = await mutate(req, req.body.operation);
    let target = "/settings/library";
    if (typeof req.body.return_to === "string") {
      let url;
      try { url = new URL(req.body.return_to, "https://kutt.invalid"); } catch {}
      if (url?.origin === "https://kutt.invalid" && url.pathname === target) {
        if (req.body.operation === "remove_label") {
          for (const kind of ["tag", "collection"]) if (url.searchParams.get(kind) === req.body.id) url.searchParams.delete(kind);
        }
        target += url.search;
      }
    }
    if (req.body.operation === "bulk") {
      // A short-lived, user-bound receipt carries only the committed action/count, not link data.
      const data = Buffer.from(JSON.stringify({ user: req.user.id, ...result, expires: Date.now() + 60000 })).toString("base64url");
      res.cookie(noticeCookie, data + "." + noticeSignature(data), { ...noticeOptions(req), maxAge: 60000 });
    } else res.clearCookie(noticeCookie, noticeOptions(req));
    return res.redirect(303, target);
  } catch (error) {
    if (!(error instanceof CustomError)) throw error;
    res.status(error.statusCode || 400);
    return page(req, res, error.message);
  }
}

module.exports = { list, api, page, submit };
