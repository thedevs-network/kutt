const i18n = require("./i18n");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const knex = require("./knex");
const env = require("./env");
const utils = require("./utils");
const queries = require("./queries");
const history = require("./link-history");
const lifecycle = require("./link-lifecycle");
const redis = require("./redis");
const editing = require("./workspace-edit");

const fail = (message, status = 400) => { throw new utils.CustomError(message, status); };
const uuid = value => typeof value === "string" && /^[a-f0-9-]{36}$/i.test(value);
const rank = { viewer: 1, editor: 2, owner: 3 };
const publicSpace = row => ({ id: row.id, name: row.name, role: row.role, created_at: new Date(Number(row.created_at)).toISOString() });

function name(value) {
  if (typeof value !== "string") fail(i18n.t("messages.a_workspace_name_is_required"));
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > 80 || /[\u0000-\u001f\u007f]/.test(normalized)) fail(i18n.t("messages.use_1_to_80_printable_characters"));
  return { name: normalized, name_key: normalized.toLowerCase() };
}

async function access(db, userId, id, minimum = "viewer", lock = false) {
  if (!uuid(id)) fail(i18n.t("messages.workspace_was_not_found"), 404);
  // Serialize all membership/sharing writes on the workspace before resolving
  // the current role. A revoked editor cannot reuse an earlier authorization.
  if (lock) await db("workspaces").where({ id }).increment("revision", 1);
  const space = await db("workspaces").where({ id }).first();
  const user = await db("users").where({ id: userId, verified: true, banned: false }).first();
  if (!space || !user || !await db("users").where({ id: space.owner_id, verified: true, banned: false }).first()) fail(i18n.t("messages.workspace_was_not_found"), 404);
  const member = space.owner_id === userId ? null : await db("workspace_members")
    .where({ workspace_id: id, user_id: userId }).whereNotNull("accepted_at").first();
  const role = space.owner_id === userId ? "owner" : member?.role;
  if (!rank[role]) fail(i18n.t("messages.workspace_was_not_found"), 404);
  if (rank[role] < rank[minimum]) fail(i18n.t("messages.your_workspace_role_does_not_permit_this_action"), 403);
  return { ...space, role, membership_id: member?.id };
}

async function list(userId) {
  if (!await knex("users").where({ id: userId, verified: true, banned: false }).first()) fail(i18n.t("messages.account_unavailable"), 403);
  const spaces = await knex("workspaces as w").join("users as owner", "owner.id", "w.owner_id")
    .where({ "owner.banned": false, "owner.verified": true })
    .where(function () {
      this.where("w.owner_id", userId).orWhereIn("w.id", knex("workspace_members")
        .select("workspace_id").where({ user_id: userId }).whereNotNull("accepted_at"));
    }).select("w.*").orderBy("w.name_key");
  const roles = await knex("workspace_members").where({ user_id: userId }).whereNotNull("accepted_at");
  const invitations = await knex("workspace_members as m").join("workspaces as w", "w.id", "m.workspace_id")
    .join("users as u", "u.id", "w.owner_id").where({ "m.user_id": userId, "u.banned": false, "u.verified": true })
    .whereNull("m.accepted_at").select("m.id", "m.role", "w.name", "u.email as owner").orderBy("m.created_at", "desc").limit(100);
  return { data: spaces.map(space => publicSpace({ ...space, role: space.owner_id === userId ? "owner" : roles.find(m => m.workspace_id === space.id)?.role })), invitations };
}

async function create(userId, input) {
  const fields = name(input.name);
  return knex.transaction(async db => {
    if (!await db("users").where({ id: userId, verified: true, banned: false }).first()) fail(i18n.t("messages.account_unavailable"), 403);
    const { n } = await db("workspaces").where({ owner_id: userId }).count("* as n").first();
    if (Number(n) >= 20) fail(i18n.t("messages.limit_of_20_owned_workspaces_reached"), 409);
    if (await db("workspaces").where({ owner_id: userId, name_key: fields.name_key }).first()) fail(i18n.t("messages.a_workspace_with_this_name_already_exists"), 409);
    const space = { id: randomUUID(), owner_id: userId, ...fields, created_at: Date.now(), revision: 0 };
    await db("workspaces").insert(space);
    return publicSpace({ ...space, role: "owner" });
  });
}

async function edit(userId, id, input) {
  const fields = name(input.name);
  return knex.transaction(async db => {
    const space = await access(db, userId, id, "owner", true);
    if (await db("workspaces").where({ owner_id: userId, name_key: fields.name_key }).whereNot({ id }).first()) fail(i18n.t("messages.a_workspace_with_this_name_already_exists"), 409);
    await db("workspaces").where({ id }).update(fields);
    return publicSpace({ ...space, ...fields });
  });
}

async function close(userId, id, input) {
  return knex.transaction(async db => {
    await access(db, userId, id, "owner", true);
    if (input.confirm !== id) fail(i18n.t("messages.confirm_the_workspace_identifier_to_close_it"));
    // Only membership/share relations cascade; link rows and redirects remain.
    await db("workspaces").where({ id }).delete();
  });
}

async function invite(userId, id, input) {
  if (typeof input.email !== "string" || input.email.length > 255 || !["viewer", "editor"].includes(input.role)) fail(i18n.t("messages.provide_an_account_email_and_editor_viewer_role"));
  return knex.transaction(async db => {
    const space = await access(db, userId, id, "owner", true);
    const recipient = await db("users").whereRaw("LOWER(email) = ?", [input.email.trim().toLowerCase()]).where({ verified: true, banned: false }).first();
    if (!recipient || recipient.id === space.owner_id) fail(i18n.t("messages.this_account_cannot_be_invited"), 400);
    if (await db("workspace_members").where({ workspace_id: id, user_id: recipient.id }).first()) fail(i18n.t("messages.this_account_already_has_an_invitation_or_membership"), 409);
    const { n } = await db("workspace_members").where({ workspace_id: id }).count("* as n").first();
    if (Number(n) >= 100) fail(i18n.t("messages.limit_of_100_memberships_invitations_reached"), 409);
    const incoming = await db("workspace_members").where({ user_id: recipient.id }).count("* as n").first();
    const pending = await db("workspace_members").where({ user_id: recipient.id }).whereNull("accepted_at").count("* as n").first();
    if (Number(incoming.n) >= 200 || Number(pending.n) >= 100) fail(i18n.t("messages.this_account_has_reached_its_membership_or_invitation_limit"), 409);
    const member = { id: randomUUID(), workspace_id: id, user_id: recipient.id, role: input.role, created_at: Date.now(), accepted_at: null };
    await db("workspace_members").insert(member);
    return { id: member.id, role: member.role, email: recipient.email, accepted: false };
  });
}

async function respond(userId, invitationId, accept) {
  if (!uuid(invitationId)) fail(i18n.t("messages.invitation_was_not_found"), 404);
  return knex.transaction(async db => {
    let invite = await db("workspace_members").where({ id: invitationId, user_id: userId }).whereNull("accepted_at").first();
    if (!await db("users").where({ id: userId, verified: true, banned: false }).first()) fail(i18n.t("messages.account_unavailable"), 403);
    if (!invite) fail(i18n.t("messages.invitation_was_not_found"), 404);
    await db("workspaces").where({ id: invite.workspace_id }).increment("revision", 1);
    invite = await db("workspace_members").where({ id: invitationId, user_id: userId }).whereNull("accepted_at").first();
    if (!invite) fail(i18n.t("messages.invitation_was_not_found"), 404);
    const space = await db("workspaces").where({ id: invite.workspace_id }).first();
    if (!space || !await db("users").where({ id: space.owner_id, verified: true, banned: false }).first()) fail(i18n.t("messages.invitation_is_unavailable"), 404);
    if (accept) await db("workspace_members").where({ id: invitationId, user_id: userId }).update({ accepted_at: Date.now() });
    else await db("workspace_members").where({ id: invitationId, user_id: userId }).delete();
    return { workspace_id: invite.workspace_id, accepted: accept };
  });
}

async function membership(userId, id, memberId, role) {
  if (!uuid(memberId)) fail(i18n.t("messages.membership_was_not_found"), 404);
  if (role !== null && !["editor", "viewer"].includes(role)) fail(i18n.t("messages.select_editor_or_viewer"));
  return knex.transaction(async db => {
    const space = await access(db, userId, id, "viewer", true);
    const member = await db("workspace_members").where({ id: memberId, workspace_id: id }).first();
    if (!member) fail(i18n.t("messages.membership_was_not_found"), 404);
    if (space.role !== "owner" && !(role === null && member.user_id === userId)) fail(i18n.t("messages.only_the_owner_can_manage_other_members"), 403);
    if (role === null) await db("workspace_members").where({ id: memberId, workspace_id: id }).delete();
    else await db("workspace_members").where({ id: memberId, workspace_id: id }).update({ role });
  });
}

async function domain(db, link, ownerId) {
  if (link.archived_domain) fail(i18n.t("messages.the_original_domain_is_retired"), 409);
  if (link.domain_id == null) return null;
  const found = await require("./domain-access").find(db, ownerId, { id: link.domain_id });
  if (!found) fail(i18n.t("messages.the_link_s_domain_is_unavailable_to_this_workspace"), 409);
  return found;
}

async function detail(userId, id, input = {}, editId) {
  const sorting = require("./list-sort").parse(input, "workspace");
  const page = input.page === undefined ? 1 : Number(input.page);
  if (typeof input.page === "object" || !Number.isSafeInteger(page) || page < 1 || page > 100000) fail(i18n.t("messages.invalid_page"));
  const state = input.state ?? "active", search = input.q ?? "";
  if (!["active", "trash"].includes(state) || typeof search !== "string" || search.length > 200) fail(i18n.t("messages.invalid_filter"));
  return knex.transaction(async db => {
    const space = await access(db, userId, id);
    const query = db("workspace_links as rel").join("links as l", "l.id", "rel.link_id")
      .where({ "rel.workspace_id": id, "l.user_id": space.owner_id });
    query[state === "trash" ? "whereNotNull" : "whereNull"]("l.deleted_at");
    if (search) query.where(function () {
      const pattern = "%" + search.toLowerCase().replace(/[!%_]/g, "!$&") + "%";
      for (const field of ["address", "target", "description"]) this.orWhereRaw(`LOWER(l.${field}) LIKE ? ESCAPE '!'`, [pattern]);
    });
    const { n } = await query.clone().count("* as n").first();
    const rows = query.clone().leftJoin("domains as d", "d.id", "l.domain_id")
      .select("l.*", "d.address as domain", "d.user_id as domain_owner", "d.banned as domain_banned")
      .offset((page - 1) * 50).limit(50);
    const links = await require("./list-sort").apply(rows, sorting, "workspace");
    // An intervening edit can move this row outside the current search/page.
    // Recover it only from this authorized workspace, never from posted data.
    if (uuid(editId) && !links.some(link => link.uuid === editId)) {
      const edited = await db("workspace_links as rel").join("links as l", "l.id", "rel.link_id")
        .leftJoin("domains as d", "d.id", "l.domain_id")
        .where({ "rel.workspace_id": id, "l.user_id": space.owner_id, "l.uuid": editId })
        .select("l.*", "d.address as domain", "d.user_id as domain_owner", "d.banned as domain_banned").first();
      if (edited) links.unshift(edited);
    }
    const members = space.role === "owner" ? await db("workspace_members as m").join("users as u", "u.id", "m.user_id")
      .where({ "m.workspace_id": id }).select("m.id", "m.role", "m.accepted_at", "u.email", "u.banned", "u.verified").orderBy("u.email") : [];
    const availableDomains = await require("./domain-access").available(db, space.owner_id).orderBy("d.address");
    const domains = space.role !== "viewer" ? availableDomains.map(({ address }) => ({ address })) : [];
    return { ...publicSpace(space), membership_id: space.membership_id, members: members.map(m => ({ id: m.id, email: m.email, role: m.role, accepted: m.accepted_at != null, unavailable: !!m.banned || !m.verified })),
      domains, page, limit: 50, total: Number(n), q: search, state, ...sorting,
      data: links.map(({ domain_owner, domain_banned, ...link }) => ({ ...utils.sanitize.link(link),
        edit_revision: editing.revision(link),
        editable: !link.banned && !link.archived_domain && (link.domain_id == null || availableDomains.some(domain => domain.id === link.domain_id)) })) };
  });
}

async function share(userId, id, linkId, remove = false) {
  if (!uuid(linkId)) fail(i18n.t("messages.link_was_not_found"), 404);
  return knex.transaction(async db => {
    await require("./domain-access").lock(db);
    const space = await access(db, userId, id, "owner", true);
    const link = await db("links").where({ uuid: linkId, user_id: space.owner_id }).first();
    if (!link) fail(i18n.t("messages.link_was_not_found"), 404);
    const match = { workspace_id: id, link_id: link.id };
    if (remove) { await db("workspace_links").where(match).delete(); return; }
    if (link.deleted_at != null || link.banned) fail(i18n.t("messages.only_available_links_can_be_shared"), 409);
    await domain(db, link, space.owner_id);
    if (!await db("workspace_links").where(match).first()) {
      const { n } = await db("workspace_links").where({ workspace_id: id }).count("* as n").first();
      if (Number(n) >= 1000) fail(i18n.t("messages.limit_of_1000_shared_links_reached"), 409);
      await db("workspace_links").insert({ ...match, created_at: Date.now() });
    }
  });
}

async function candidates(userId, id, search = "") {
  if (typeof search !== "string" || search.length > 200) fail(i18n.t("messages.invalid_personal_link_search"));
  await access(knex, userId, id, "owner");
  const query = knex("links as l").leftJoin("domains as d", "d.id", "l.domain_id")
    .where({ "l.user_id": userId, "l.banned": false }).whereNull("l.deleted_at").whereNull("l.archived_domain")
    .where(function () { this.whereNull("l.domain_id").orWhereIn("l.domain_id", require("./domain-access").available(knex, userId).clearSelect().select("d.id")); })
    .whereNotIn("l.id", knex("workspace_links").select("link_id").where({ workspace_id: id }));
  if (search) query.where(function () {
    const pattern = "%" + search.toLowerCase().replace(/[!%_]/g, "!$&") + "%";
    for (const field of ["address", "description", "target"]) this.orWhereRaw(`LOWER(l.${field}) LIKE ? ESCAPE '!'`, [pattern]);
  });
  return query.select("l.uuid as id", "l.address", "d.address as domain").orderBy("l.id", "desc").limit(50);
}

async function changeLink(userId, id, action, linkId, input, actor, request) {
  await access(knex, userId, id, "editor");
  if (!["create", "edit", "trash", "restore"].includes(action)) fail(i18n.t("messages.invalid_link_action"));
  if (action !== "create" && !uuid(linkId)) fail(i18n.t("messages.link_was_not_found"), 404);
  const allowed = ["target", "address", "description", "password", "domain", "paused", "starts_at", "ends_at", "max_visits", "edit_revision", ...require("./link-campaign").fields];
  if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(k => !allowed.includes(k))) fail(i18n.t("messages.unknown_link_field"));
  input = require("./link-campaign").normalize(input);
  // Reuse import validation and the existing ban checks; no destination fetch.
  if (input.target !== undefined) {
    const checked = require("./link-transfer").normalized({ target: input.target, address: "validation-only" });
    const host = utils.removeWww(new URL(checked.target).hostname);
    await require("./handlers/validators.handler").bannedDomain(host);
    await require("./handlers/validators.handler").bannedHost(host);
  }
  const changed = await knex.transaction(async db => {
    await require("./domain-access").lock(db);
    if (request) await require("./domain-access").request(db, request, null, "workspaces:write");
    const space = await access(db, userId, id, "editor", true);
    let link;
    if (action !== "create") {
      const selection = db("links as l").where({ "l.uuid": linkId, "l.user_id": space.owner_id })
        .whereIn("l.id", db("workspace_links").where({ workspace_id: id }).select("link_id"));
      if (!knex.client.config.client.includes("sqlite")) selection.forUpdate();
      link = await selection.select("l.*").first();
      if (!link) fail(i18n.t("messages.link_was_not_found"), 404);
      if (link.banned) fail(i18n.t("messages.banned_links_cannot_be_changed"), 409);
      if (action !== "trash") await domain(db, link, space.owner_id);
    }
    if (action === "trash") { await history.trash(db, link, actor); return link; }
    if (action === "restore") {
      await history.claim(db, link);
      if (link.deleted_at != null) {
        await db("links").where({ id: link.id }).update({ deleted_at: null });
        await history.record(db, link, "restored", [], actor);
      }
      return { ...link, deleted_at: null };
    }
    if (link?.deleted_at != null) fail(i18n.t("messages.restore_the_link_before_editing"), 409);
    if (action === "edit") editing.check(link, input.edit_revision);
    if (input.target !== undefined && input.target !== link?.target) require("./destination-policy").requireAllowed(input.target);
    if (action === "edit" && input.domain !== undefined) fail(i18n.t("messages.move_domains_through_the_owner_s_personal_link_management"));
    const currentDomain = link ? await domain(db, link, space.owner_id) : null;
    const normalized = require("./link-transfer").normalized({
      target: input.target ?? link?.target, address: input.address ?? link?.address ?? randomUUID().replaceAll("-", "").slice(0, 12),
      description: input.description === undefined ? link?.description : input.description,
      domain: input.domain ?? currentDomain?.address ?? env.DEFAULT_DOMAIN,
      ...(input.password !== undefined && { password: input.password })
    });
    const policy = lifecycle.parse(input, link || {});
    let domainId = link?.domain_id ?? null;
    if (!link && normalized.domain !== env.DEFAULT_DOMAIN.toLowerCase()) {
      const owned = await require("./domain-access").find(db, space.owner_id, { address: normalized.domain });
      if (!owned) fail(i18n.t("messages.domain_unavailable_to_this_workspace"), 403);
      domainId = owned.id;
    }
    if (!link) {
      const { n } = await db("workspace_links").where({ workspace_id: id }).count("* as n").first();
      if (Number(n) >= 1000) fail(i18n.t("messages.limit_of_1000_shared_links_reached"), 409);
      link = await queries.link.create({ ...normalized, ...policy, domain_id: domainId, user_id: space.owner_id }, db, actor);
      await db("workspace_links").insert({ workspace_id: id, link_id: link.id, created_at: Date.now() });
    } else {
      const update = { target: normalized.target, address: normalized.address, description: normalized.description, ...policy };
      if (input.password !== undefined) update.password = normalized.password ? await bcrypt.hash(normalized.password, 12) : null;
      await history.beforeUpdate(db, link, update, actor);
      await db("links").where({ id: link.id }).update({ ...update, updated_at: utils.dateToUTC(new Date()) });
      link = { ...link, ...update };
    }
    return link;
  });
  if (env.REDIS_ENABLED) redis.remove.link(changed);
  return { id: changed.uuid, action };
}

module.exports = { access, list, detail, create, edit, close, invite, respond, membership, share, candidates, changeLink };
