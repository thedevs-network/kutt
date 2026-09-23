const i18n = require("../i18n");
const spaces = require("../workspaces");
const lifecycle = require("../link-lifecycle");
const { sameOrigin } = require("./link-history.handler");
const { sessionOnly } = require("./tokens.handler");
const { CustomError } = require("../utils");
const editing = require("../workspace-edit");

function boundary(req, res, next) {
  res.set("Cache-Control", "private, no-store");
  res.set("Referrer-Policy", "same-origin");
  if (req.apiTokenDomain !== undefined) throw new CustomError(i18n.t("messages.workspace_access_requires_an_unrestricted_domain_scope"), 403);
  if (!["GET", "HEAD"].includes(req.method)) sameOrigin(req);
  next();
}

const linkFields = ["target", "address", "description", "password", "domain", "paused", "starts_at", "ends_at", "max_visits"];
function formLink(body) {
  const input = Object.fromEntries(linkFields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
  if (input.address === "") delete input.address;
  if (input.domain === "") delete input.domain;
  // Empty password on an edit preserves protection unless explicitly cleared.
  if (input.password === "") delete input.password;
  if (body.clear_password === "on") input.password = null;
  if (body.operation === "edit_link") input.edit_revision = body.edit_revision ?? "";
  if (body.policy === "on") {
    const parsed = lifecycle.parse(body, {}, true);
    for (const key of ["starts_at", "ends_at"]) if (parsed[key] != null) parsed[key] = new Date(parsed[key]).toISOString();
    Object.assign(input, parsed);
  }
  return input;
}

async function mutate(req, operation, res) {
  const id = req.params.id || req.body.workspace_id, memberId = req.params.memberId || req.body.member_id;
  const body = req.body;
  const actor = { id: req.user.id, apiToken: req.apiToken };
  if (!["create_link", "edit_link", "trash_link", "restore_link"].includes(operation)) sessionOnly(req, res, () => {});
  switch (operation) {
    case "create": return spaces.create(req.user.id, body);
    case "rename": return spaces.edit(req.user.id, id, body);
    case "close": return spaces.close(req.user.id, id, body);
    case "invite": return spaces.invite(req.user.id, id, body);
    case "accept": case "decline": return spaces.respond(req.user.id, req.params.invitationId || body.invitation_id, operation === "accept");
    case "role": return spaces.membership(req.user.id, id, memberId, body.role);
    case "remove_member": return spaces.membership(req.user.id, id, memberId, null);
    case "share": case "unshare": return spaces.share(req.user.id, id, req.params.linkId || body.link_id, operation === "unshare");
    case "create_link": case "edit_link": case "trash_link": case "restore_link": {
      const input = operation === "trash_link" || operation === "restore_link" ? {} : req.isHTML ? formLink(body) : body;
      return spaces.changeLink(req.user.id, id, operation.replace("_link", ""), req.params.linkId || body.link_id, input, actor, req);
    }
    default: throw new CustomError(i18n.t("messages.invalid_workspace_action"), 400);
  }
}

async function list(req, res) {
  const data = await spaces.list(req.user.id);
  // Invitations require a session; a read token cannot discover pending access.
  if (req.apiToken || req.get("X-API-Key") || req.query.apikey || req.body?.apikey) delete data.invitations;
  res.json(data);
}
async function detail(req, res) {
  const data = await spaces.detail(req.user.id, req.params.id, req.query);
  if (req.apiToken) delete data.members;
  res.json(data);
}
const api = operation => async (req, res) => {
  const result = await mutate(req, operation, res);
  if (result === undefined) return res.sendStatus(204);
  res.status(["create", "invite", "create_link"].includes(operation) ? 201 : 200).json(result);
};

async function page(req, res, error, failedEdit) {
  const all = await spaces.list(req.user.id);
  let selected, inlineError = false;
  if (req.params.id) selected = await spaces.detail(req.user.id, req.params.id, req.query, failedEdit?.id);
  const url = selected ? "/settings/workspaces/" + selected.id : "/settings/workspaces";
  if (selected) {
    selected.owner = selected.role === "owner";
    if (selected.owner) {
      selected.share_candidates = await spaces.candidates(req.user.id, selected.id, req.query.share_q);
      selected.share_q = req.query.share_q;
    }
    selected.editor = selected.role !== "viewer";
    selected.trash = selected.state === "trash";
    selected.members = selected.members.map(m => ({ ...m, editor: m.role === "editor" }));
    selected.data = selected.data.map(link => ({ ...link, can_edit: selected.editor && link.editable, can_unshare: selected.owner,
      trashed: !!link.deleted_at, edit_values: { ...link } }));
    const link = failedEdit && selected.data.find(link => link.id === failedEdit.id && link.can_edit && !link.trashed);
    if (link) {
      inlineError = true;
      link.edit_error = error;
      link.edit_values = { ...link.edit_values, ...editing.draft(req.body),
        starts_at_input: typeof req.body.starts_at === "string" ? req.body.starts_at : link.starts_at_input,
        ends_at_input: typeof req.body.ends_at === "string" ? req.body.ends_at : link.ends_at_input,
        // Validation cannot silently accept a newer snapshot. Only an explicit
        // conflict response shows current values and offers a deliberate retry.
        edit_revision: failedEdit.conflict ? link.edit_revision : typeof req.body.edit_revision === "string" ? req.body.edit_revision : "" };
      link.edit_conflict = failedEdit.conflict;
    }
  }
  const pageURL = number => url + "?" + new URLSearchParams({ q: selected.q, state: selected.state, page: number, sort: selected.sort, direction: selected.direction });
  return res.render("workspaces", { title: selected?.name || i18n.t("ui.workspaces"), all, selected, error: inlineError ? undefined : error, action_url: selected ? pageURL(selected.page) : url,
    previous: selected?.page > 1 ? pageURL(selected.page - 1) : null,
    next: selected && selected.page * selected.limit < selected.total ? pageURL(selected.page + 1) : null });
}

async function submit(req, res) {
  const operation = req.body.operation;
  try {
    const current = req.params.id ? await spaces.detail(req.user.id, req.params.id, req.query) : null;
    const result = await mutate(req, operation, res);
    let id = req.params.id;
    if (operation === "create") id = result.id;
    if (operation === "accept") id = result.workspace_id;
    if (operation === "close" || operation === "remove_member") id = null;
    const state = current && id === current.id ? "?" + new URLSearchParams({
      q: current.q, state: current.state, page: current.page, sort: current.sort, direction: current.direction
    }) : "";
    return res.redirect(303, "/settings/workspaces" + (id ? "/" + id : "") + state);
  } catch (error) {
    if (!(error instanceof CustomError)) throw error;
    res.status(error.statusCode || 400);
    return page(req, res, error.message, operation === "edit_link" ? { id: req.body.link_id, conflict: error.workspaceEditConflict === true } : undefined);
  }
}

module.exports = { boundary, list, detail, api, page, submit };
