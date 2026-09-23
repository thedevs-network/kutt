const i18n = require("../i18n");
const { differenceInSeconds } = require("date-fns");
const bcrypt = require("bcryptjs");
const visitClassification = require("../visit-classification");
const URL = require("node:url");

const validators = require("./validators.handler");
const map = require("../utils/map.json");
const transporter = require("../mail");
const query = require("../queries");
const queue = require("../queues");
const utils = require("../utils");
const env = require("../env");
const linkLifecycle = require("../link-lifecycle");

const CustomError = utils.CustomError;

async function get(req, res) {
  const { limit, skip } = req.context;
  const search = req.query.search;
  const userId = req.user.id;

  const match = {
    user_id: userId,
    ...(req.apiTokenDomain !== undefined && { domain_id: req.apiTokenDomain })
  };

  const [data, total] = await Promise.all([
    query.link.get(match, { limit, search, skip, ...require("../list-sort").parse(req.query) }),
    query.link.total(match, { search })
  ]);

  if (req.isHTML) {
    res.render("partials/links/table", {
      total,
      limit,
      skip,
      links: data.map(utils.sanitize.link_html),
    })
    return;
  }

  return res.send({
    total,
    limit,
    skip,
    data: data.map(utils.sanitize.link),
  });
};

async function getAdmin(req, res) {
  const { limit, skip } = req.context;
  const search = req.query.search;
  const user = req.query.user;
  let domain = req.query.domain;
  const banned = utils.parseBooleanQuery(req.query.banned);
  const anonymous = utils.parseBooleanQuery(req.query.anonymous);
  const has_domain = utils.parseBooleanQuery(req.query.has_domain);
  
  const match = {
    ...(banned !== undefined && { banned }),
    ...(anonymous !== undefined && { user_id: [anonymous ? "is" : "is not", null] }),
    ...(has_domain !== undefined && { domain_id: [has_domain ? "is not" : "is", null] }),
  };
  
  // if domain is equal to the defualt domain,
  // it means admins is looking for links with the defualt domain (no custom user domain)
  if (domain === env.DEFAULT_DOMAIN) {
    domain = undefined;
    match.domain_id = null;
  }
  
  const [data, total] = await Promise.all([
    query.link.getAdmin(match, { limit, search, user, domain, skip, ...require("../list-sort").parse(req.query) }),
    query.link.totalAdmin(match, { search, user, domain })
  ]);

  const links = data.map(utils.sanitize.link_admin);

  if (req.isHTML) {
    res.render("partials/admin/links/table", {
      total,
      total_formatted: i18n.number(total),
      limit,
      skip,
      links,
    })
    return;
  }

  return res.send({
    total,
    limit,
    skip,
    data: links,
  });
};

async function create(req, res) {
  try {
    req.linkLifecycle = linkLifecycle.parse(req.body, {}, req.isHTML);
  } catch (error) {
    if (req.isHTML && error instanceof CustomError && ["starts_at", "ends_at"].includes(error.field)) {
      res.locals.errors = { ...res.locals.errors, [error.field]: error.message };
    }
    throw error;
  }
  const { reuse, password, customurl, description, target, fetched_domain, expire_in } = req.body;
  const domain_id = fetched_domain ? fetched_domain.id : null;
  if (req.apiTokenDomain !== undefined && domain_id !== req.apiTokenDomain) {
    throw new CustomError(i18n.t("messages.api_token_does_not_permit_this_domain"), 403);
  }
  
  const targetDomain = utils.removeWww(URL.parse(target).hostname);
  
  const [generatedAddress] = await Promise.all([
    !customurl && utils.generateId(query, domain_id),
    validators.bannedDomain(targetDomain),
    validators.bannedHost(targetDomain)
  ]);
  const result = await require("../link-creation").run(req, async db => {
    if (reuse === true || reuse === "true") {
      const existing = await db("links").where({ target, user_id: req.user.id, domain_id }).whereNull("deleted_at").first();
      if (existing) return { status: 200, data: utils.sanitize.link({ ...existing, domain: fetched_domain?.address }) };
    }
    if (customurl && await db("links").where({ address: customurl, domain_id }).whereNull("deleted_at").first()) {
      const error = i18n.t("messages.custom_url_is_already_in_use");
      res.locals.errors = { customurl: error };
      throw new CustomError(error, 400);
    }
    const link = await query.link.create({
      password, address: customurl || generatedAddress, domain_id, description,
      target, expire_in, ...req.linkLifecycle, user_id: req.user && req.user.id
    }, db, { id: req.user?.id, apiToken: req.apiToken });
    return { status: 201, data: utils.sanitize.link({ ...link, domain: fetched_domain?.address }) };
  });
  if (req.get("Idempotency-Key") !== undefined) {
    res.set("Idempotency-Replayed", result.replayed ? "true" : "false");
    res.set("Cache-Control", "no-store");
  }
  
  if (req.isHTML) {
    res.setHeader("HX-Trigger", "reloadMainTable");
    const shortURL = utils.getShortURL(result.data.address, result.data.domain);
    return res.render("partials/shortener", {
      link: shortURL.link, 
      url: shortURL.url,
    });
  }
  
  return res
    .status(result.status)
    .send(result.data);
}

async function lifecycle(req, res) {
  require("../management-origin").sameOrigin(req);
  const link = await query.link.find({ uuid: req.params.id, user_id: req.user.id }, { fresh: true });
  if (!link) throw new CustomError(i18n.t("messages.link_was_not_found"), 404);
  res.locals.id = link.uuid;
  Object.assign(res.locals, utils.sanitize.link_html(link));
  const update = linkLifecycle.parse(req.body, link, req.isHTML);
  if (!Object.keys(update).length) throw new CustomError(i18n.t("messages.provide_at_least_one_lifecycle_setting"), 400);
  if (req.isHTML) {
    Object.assign(res.locals, linkLifecycle.describe({ ...link, ...update }), { clear_expiry: req.body.clear_expiry === "on" });
    if (update.expire_in === null) req.expiryExpected = require("../link-expiry-edit").read(req.body.expiry_snapshot, link.uuid).expiry;
  }
  const updated = await require("../link-expiry-edit").save(req, res, link, update);
  res.set("Cache-Control", "no-store");
  if (req.isHTML) return res.render("partials/links/lifecycle", {
    ...utils.sanitize.link_html(updated), clear_expiry: false, success: i18n.t("messages.lifecycle_updated")
  });
  return res.json(utils.sanitize.link(updated));
}

async function edit(req, res) {
  const link = await query.link.find({
    uuid: req.params.id,
    ...(!req.user.admin && { user_id: req.user.id }),
    ...(req.apiTokenDomain !== undefined && { domain_id: req.apiTokenDomain, archived_domain: null })
  }, { fresh: true });

  if (!link) {
    res.set("Cache-Control", "no-store");
    throw new CustomError(i18n.t("messages.link_was_not_found"));
  }

  await require("../destination-policy").editTarget(req, res, link);

  let isChanged = false;
  [
    [req.body.address, "address"], 
    [req.body.target, "target"], 
    [req.body.description, "description"], 
    [req.body.expire_in, "expire_in"], 
    [req.body.password, "password"]
  ].forEach(([value, name]) => {
    if (!Object.hasOwn(req.body, name)) return;
    if (!value) {
      if (name === "password" && link.password) 
        req.body.password = null;
      else {
        delete req.body[name];
        return;
      }
    }
    if (value === link[name] && name !== "password") {
      delete req.body[name];
      return;
    }
    if (name === "expire_in" && link.expire_in)
      if (Math.abs(differenceInSeconds(utils.parseDatetime(value), utils.parseDatetime(link.expire_in))) < 60)
          return;
    if (name === "password")
      if (value && value.replace(/•/ig, "").length === 0) {
        delete req.body.password;
        return;
      }
    isChanged = true;
  });

  if (!isChanged) {
    throw new CustomError(i18n.t("messages.should_at_least_update_one_field"));
  }

  const { address, target, description, expire_in, password } = req.body;
  
  const targetDomain = target && utils.removeWww(URL.parse(target).hostname);
  const domain_id = link.domain_id || null;

  const tasks = await Promise.all([
    address &&
      query.link.find({
        address,
        domain_id
      }),
    target && validators.bannedDomain(targetDomain),
    target && validators.bannedHost(targetDomain)
  ]);

  // Check if custom link already exists
  if (tasks[0]) {
    const error = i18n.t("messages.custom_url_is_already_in_use");
    res.locals.errors = { address: error };
    throw new CustomError(i18n.t("messages.custom_url_is_already_in_use"));
  }

  // Update link
  const updatedLink = await require("../link-expiry-edit").save(req, res, link,
    {
      ...(address && { address }),
      ...(description && { description }),
      ...(target && { target }),
      ...(expire_in && { expire_in }),
      ...((password || password === null) && { password })
    }
  );

  if (req.isHTML) {
    res.render("partials/links/edit", {
      swap_oob: true,
      success: i18n.t("messages.link_has_been_updated"),
      ...utils.sanitize.link_html({ ...updatedLink }),
    });
    return;
  }

  return res.status(200).send(utils.sanitize.link({ ...updatedLink }));
};

async function editAdmin(req, res) {
  const link = await query.link.find({
    uuid: req.params.id,
    ...(!req.user.admin && { user_id: req.user.id })
  }, { fresh: true });

  if (!link) {
    throw new CustomError(i18n.t("messages.link_was_not_found"));
  }

  await require("../destination-policy").editTarget(req, res, link);

  let isChanged = false;
  [
    [req.body.address, "address"], 
    [req.body.target, "target"], 
    [req.body.description, "description"], 
    [req.body.expire_in, "expire_in"], 
    [req.body.password, "password"]
  ].forEach(([value, name]) => {
    if (!Object.hasOwn(req.body, name)) return;
    if (!value) {
      if (name === "password" && link.password) 
        req.body.password = null;
      else {
        delete req.body[name];
        return;
      }
    }
    if (value === link[name] && name !== "password") {
      delete req.body[name];
      return;
    }
    if (name === "expire_in" && link.expire_in)
      if (Math.abs(differenceInSeconds(utils.parseDatetime(value), utils.parseDatetime(link.expire_in))) < 60)
          return;
    if (name === "password")
      if (value && value.replace(/•/ig, "").length === 0) {
        delete req.body.password;
        return;
      }
    isChanged = true;
  });

  if (!isChanged) {
    throw new CustomError(i18n.t("messages.should_at_least_update_one_field"));
  }

  const { address, target, description, expire_in, password } = req.body;
  
  const targetDomain = target && utils.removeWww(URL.parse(target).hostname);
  const domain_id = link.domain_id || null;

  const tasks = await Promise.all([
    address &&
      query.link.find({
        address,
        domain_id
      }),
    target && validators.bannedDomain(targetDomain),
    target && validators.bannedHost(targetDomain)
  ]);

  // Check if custom link already exists
  if (tasks[0]) {
    const error = i18n.t("messages.custom_url_is_already_in_use");
    res.locals.errors = { address: error };
    throw new CustomError(i18n.t("messages.custom_url_is_already_in_use"));
  }

  // Update link
  const updatedLink = await require("../link-expiry-edit").save(req, res, link,
    {
      ...(address && { address }),
      ...(description && { description }),
      ...(target && { target }),
      ...(expire_in && { expire_in }),
      ...((password || password === null) && { password })
    }
  );

  if (req.isHTML) {
    res.render("partials/admin/links/edit", {
      swap_oob: true,
      success: i18n.t("messages.link_has_been_updated"),
      ...await require("../link-admin-edit").view(updatedLink.uuid),
    });
    return;
  }

  return res.status(200).send(utils.sanitize.link({ ...updatedLink }));
};

async function remove(req, res) {
  require("./link-history.handler").sameOrigin(req);
  const { error, isRemoved, link } = await query.link.remove({
    uuid: req.params.id,
    ...(!req.user.admin && { user_id: req.user.id })
  }, { id: req.user.id, apiToken: req.apiToken }, req);

  if (!isRemoved) {
    const messsage = error || i18n.t("messages.could_not_delete_the_link");
    throw new CustomError(messsage);
  }

  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/links/dialog/delete_success", {
      link: utils.getShortURL(link.address, link.domain).link,
    });
    return;
  }

  return res
    .status(200)
    .send({ message: i18n.t("messages.link_has_been_deleted_successfully") });
};

async function report(req, res) {
  const { link } = req.body;

  await transporter.sendReportEmail(link);

  if (req.isHTML) {
    res.render("partials/report/form", {
      message: i18n.t("messages.report_was_received_we_ll_take_actions_shortly")
    });
    return;
  }
  
  return res
    .status(200)
    .send({ message: i18n.t("messages.thanks_for_the_report_we_ll_take_actions_shortly") });
};

async function ban(req, res) {
  const moderation = require("../moderation");
  const link = await moderation.moderate("link", req.params.id, true, req.user, moderation.options(req));
  const domain = link.domain_id && await query.domain.find({ id: link.domain_id });

  // Send the response only after the complete transaction commits.
  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/links/dialog/ban_success", {
      link: utils.getShortURL(link.address, domain?.address).link,
    });
    return;
  }

  return res.status(200).send({ message: i18n.t("messages.banned_link_successfully") });
};

async function redirect(req, res, next) {
  if (req.managementHost) return res.status(404).set("Cache-Control", "no-store").end();
  const isPreservedUrl = require("../link-alias").reserved(req.params.id);

  if (isPreservedUrl) return next();

  // 1. If custom domain, get domain info
  const host = utils.removeWww(req.headers.host);
  const domain =
    host !== env.DEFAULT_DOMAIN
      ? await require("../knex")("domains").where({ address: host }).first()
      : null;

  if (host !== env.DEFAULT_DOMAIN && !domain) return res.status(404).send(i18n.t("messages.not_found"));
  if (domain?.banned) return res.redirect("/banned");

  // 2. Get link
  if (req.path.startsWith("//") || /%(?:2f|5c|25)/i.test(req.path) || /[\\\u0000-\u001f\u007f]/.test(req.params.id)) {
    throw new CustomError(i18n.t("messages.ambiguous_short_path_encoding"), 400);
  }
  const address = req.params.id.replace(/\+$/, "");
  const found = await require("../link-forwarding").lookup(address, domain ? domain.id : null);
  const link = found?.link;
  req.forwardPath = found?.suffix || "";

  // 3. When no link, if has domain redirect to domain's homepage
  // otherwise redirect to 404
  if (!link) {
    res.set("Cache-Control", "no-store");
    if (domain?.homepage) require("../destination-policy").requireAllowed(domain.homepage, 410);
    return res.redirect(domain?.homepage || "/404");
  }

  // 4. If link is banned, redirect to banned page.
  if (link.banned) {
    return res.redirect("/banned");
  }

  res.set("Cache-Control", "no-store");
  if (!await linkLifecycle.allow(link)) return unavailable(req, res);

  // 5. If wants to see link info, then redirect
  const isRequestingInfo = /.*\+$/gi.test(req.params.id);
  if (isRequestingInfo && !link.password) {
    if (req.isHTML) {
      res.render("url_info", { 
        title: i18n.t("messages.short_link_information"),
        target: link.target,
        link: utils.getShortURL(link.address, link.domain).link
      });
      return;
    }
    return res.send({ target: link.target });
  }

  // 6. If link is protected, redirect to password page
  if (link.password) {
    if ("authorization" in req.headers) {
      const auth = req.headers.authorization;
      const firstSpace = auth.indexOf(" ");
      if (firstSpace !== -1) {
        const method = auth.slice(0, firstSpace);
        const payload = auth.slice(firstSpace + 1);
        if (method === "Basic") {
          const decoded = Buffer.from(payload, "base64").toString("utf8");
          const colon = decoded.indexOf(":");
          if (colon !== -1) {
            const password = decoded.slice(colon + 1);
            await require("../protected-links").attempt(req, res, link);
            const matches = await bcrypt.compare(password, link.password);
            if (matches) return finishRedirect(req, res, link);
          }
        }
      }
    }
    res.render("protected", {
      title: i18n.t("messages.protected_short_link"),
      id: link.uuid,
      routing_query: await require("../link-forwarding").protectedQuery(req, link),
      suffix_path: req.forwardPath
    });
    return;
  }

  return finishRedirect(req, res, link);
};

function unavailable(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.isHTML && ["GET", "HEAD"].includes(req.method)) {
    return res.status(410).render("unavailable", { title: i18n.t("ui.link_unavailable") });
  }
  return res.status(410).send(i18n.t("ui.this_short_link_is_not_currently_available"));
}

async function recordVisit(req, link) {
  if (req.method !== "HEAD" && link.user_id && visitClassification.human(req.headers["user-agent"])) {
    try {
      const policy = await require("../analytics-privacy").tracking(link.id);
      if (!policy.enabled) return;
      Promise.resolve(queue.visit.add({
        userAgent: visitClassification.userAgent(req.headers["user-agent"]),
        ip: req.ip, referrer: req.get("Referrer"), link, tracking_revision: policy.revision
      })).catch(() => console.error("Analytics queue unavailable."));
    } catch { console.error("Analytics tracking policy unavailable; visit not recorded."); }
  }

}

async function finishRedirect(req, res, link) {
  res.set("Cache-Control", "no-store");
  if (!await require("../protected-links").available(link)) return unavailable(req, res);
  const target = await require("../link-forwarding").resolve(req, link);
  if (!await linkLifecycle.allow(link, req.method !== "HEAD")) return unavailable(req, res);
  await recordVisit(req, link);
  return res.redirect(target);
}

async function redirectProtected(req, res) {
  // 1. Get link
  const uuid = req.params.id;
  const link = await query.link.find({ uuid }, { fresh: true, includeTrash: true });
  if (require("../management-origin").configured()) {
    const domain = link?.domain_id == null ? null : await require("../knex")("domains").where({ id: link.domain_id }).first();
    const short = new globalThis.URL(utils.getShortURL(link?.address || "", domain?.address).url);
    const authority = require("../management-origin").requestHost(req, short.protocol);
    if (req.managementHost || !link || utils.removeWww(authority || "") !== utils.removeWww(short.host)) {
      throw new CustomError(i18n.t("messages.couldn_t_find_the_link"), 404);
    }
    const origin = req.get("Origin"), expected = short.protocol + "//" + authority;
    if (req.get("Sec-Fetch-Site") === "cross-site" || origin && origin !== expected) {
      res.status(403);
      throw new CustomError(i18n.t("messages.invalid_request_origin"), 403);
    }
  }

  // 2. Throw error if no link
  if (!link || !link.password) {
    throw new CustomError(i18n.t("messages.couldn_t_find_the_link"), 400);
  }

  res.set("Cache-Control", "no-store");
  await require("../protected-links").requireAvailable(link);
  if (!await linkLifecycle.allow(link)) return unavailable(req, res);
  await require("../protected-links").attempt(req, res, link);
  // 3. Check if password matches
  const matches = await bcrypt.compare(req.body.password, link.password);

  if (!matches) {
    throw new CustomError(i18n.t("messages.password_is_not_correct"), 401);
  }

  res.set("Cache-Control", "no-store");
  const forwarding = require("../link-forwarding");
  const target = await forwarding.resolve(req, link, req.body.routing_query, forwarding.submittedPath(req.body));
  if (!await linkLifecycle.allow(link, true)) return unavailable(req, res);
  await recordVisit(req, link);

  // 5. Send target
  if (req.isHTML) {
    res.setHeader("HX-Redirect", target);
    res.render("partials/protected/form", {
      id: link.uuid,
      message: i18n.t("messages.redirecting"),
    });
    return;
  }
  return res.status(200).send({ target });
};

async function redirectCustomDomainHomepage(req, res, next) {
  if (req.managementHost) return next();
  // Keep API requests in the authenticated router, even on a custom homepage host.
  if (/^\/api(?:\/|$)/i.test(req.path)) return next();
  const host = utils.removeWww(req.headers.host);
  if (host === env.DEFAULT_DOMAIN) {
    if (req.publicHost && req.path === "/") return res.status(404).set("Cache-Control", "no-store").end();
    next();
    return;
  }

  const path = req.path;
  const pathName = path.replace("/", "").split("/")[0];
  if (
    path === "/" ||
    utils.preservedURLs.includes(pathName)
  ) {
    const domain = await query.domain.find({ address: host });
    if (domain?.homepage) {
      res.set("Cache-Control", "no-store");
      require("../destination-policy").requireAllowed(domain.homepage, 410);
      res.redirect(302, domain.homepage);
      return;
    }
  }

  if (req.publicHost && req.path === "/") return res.status(404).set("Cache-Control", "no-store").end();
  next();
};

async function stats(req, res) {
  const { user } = req;
  const uuid = req.params.id;

  const link = await query.link.find({
    ...(!user.admin && { user_id: user.id }),
    uuid
  });

  if (!link) {
    if (req.isHTML) {
      res.setHeader("HX-Redirect", "/404");
      res.status(200).send("");
      return;
    }
    throw new CustomError(i18n.t("messages.link_could_not_be_found"));
  }

  const stats = await query.visit.find({ link_id: link.id }, link.visit_count);

  if (!stats) {
    throw new CustomError(i18n.t("messages.could_not_get_the_short_link_stats_try_again_later"));
  }

  if (req.isHTML) {
    res.render("partials/stats", {
      link: utils.sanitize.link_html(link),
      stats,
      map,
    });
    return;
  }

  return res.status(200).send({
    ...stats,
    ...utils.sanitize.link(link)
  });
};

module.exports = {
  lifecycle,
  ban,
  create,
  edit,
  editAdmin,
  get,
  getAdmin,
  remove,
  report,
  stats,
  redirect,
  redirectProtected,
  redirectCustomDomainHomepage,
}
