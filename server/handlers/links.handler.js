const promisify = require("util").promisify;
const bcrypt = require("bcryptjs");
const isbot = require("isbot");
const URL = require("url");
const dns = require("dns");

const validators = require("./validators.handler");
// const transporter = require("../mail");
const query = require("../queries");
// const queue = require("../queues");
const utils = require("../utils");
const env = require("../env");
const { differenceInSeconds } = require("date-fns");

const CustomError = utils.CustomError;
const dnsLookup = promisify(dns.lookup);

/**
 * @type {import("express").Handler}
 */
async function get(req, res) {
  const { limit, skip, all } = req.context;
  const search = req.query.search;
  const userId = req.user.id;

  const match = {
    ...(!all && { user_id: userId })
  };

  const [data, total] = await Promise.all([
    query.link.get(match, { limit, search, skip }),
    query.link.total(match, { search })
  ]);

  const links = data.map(utils.sanitize.link);

  await utils.sleep(1000);
    
  if (req.isHTML) {
    res.render("partials/links/table", {
      total,
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

/**
 * @type {import("express").Handler}
 */
async function create(req, res) {
  const { reuse, password, customurl, description, target, fetched_domain, expire_in } = req.body;
  const domain_id = fetched_domain ? fetched_domain.id : null;
  
  const targetDomain = utils.removeWww(URL.parse(target).hostname);
  
  const queries = await Promise.all([
    validators.cooldown(req.user),
    validators.malware(req.user, target),
    validators.linksCount(req.user),
    reuse &&
      query.link.find({
        target,
        user_id: req.user.id,
        domain_id
      }),
    customurl &&
      query.link.find({
        address: customurl,
        domain_id
      }),
    !customurl && utils.generateId(domain_id),
    validators.bannedDomain(targetDomain),
    validators.bannedHost(targetDomain)
  ]);
  
  // if "reuse" is true, try to return
  // the existent URL without creating one
  if (queries[3]) {
    return res.json(utils.sanitize.link(queries[3]));
  }
  
  // Check if custom link already exists
  if (queries[4]) {
    const error = "Custom URL is already in use.";
    res.locals.errors = { customurl: error };
    throw new CustomError(error);
  }

  // Create new link
  const address = customurl || queries[5];
  const link = await query.link.create({
    password,
    address,
    domain_id,
    description,
    target,
    expire_in,
    user_id: req.user && req.user.id
  });
  
  if (!req.user && env.NON_USER_COOLDOWN) {
    query.ip.add(req.realIP);
  }

  link.domain = fetched_domain?.address;
  
  if (req.isHTML) {
    res.setHeader("HX-Trigger", "reloadLinks");
    res.setHeader("HX-Trigger-After-Swap", "resetForm");
    const shortURL = utils.getShortURL(link.address, link.domain);
    return res.render("partials/shortener", {
      link: shortURL.link, 
      url: shortURL.url,
    });
  }
  
  return res
    .status(201)
    .send(utils.sanitize.link({ ...link }));
}

async function edit(req, res) {
  const { address, target, description, expire_in, password } = req.body;
  const link = await query.link.find({
    uuid: req.params.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });

  if (!link) {
    throw new CustomError("Link was not found.");
  }

  let isChanged = false;
  [
    [address, "address"], 
    [target, "target"], 
    [description, "description"], 
    [expire_in, "expire_in"], 
    [password, "password"]
  ].forEach(([value, name]) => {
    if (!value) {
      delete req.body[name];
      return;
    }
    if (value === link[name]) {
      delete req.body[name];
      return;
    }
    if (name === "expire_in")
      if (differenceInSeconds(new Date(value), new Date(link.expire_in)) <= 60) 
          return;
    isChanged = true;
  });

  await utils.sleep(1000);
  
  if (!isChanged) {
    throw new CustomError("Should at least update one field.");
  }

  const targetDomain = utils.removeWww(URL.parse(target).hostname);
  const domain_id = link.domain_id || null;

  const queries = await Promise.all([
    validators.cooldown(req.user),
    target && validators.malware(req.user, target),
    address && address !== link.address &&
      query.link.find({
        address,
        domain_id
      }),
    validators.bannedDomain(targetDomain),
    validators.bannedHost(targetDomain)
  ]);

  // Check if custom link already exists
  if (queries[2]) {
    const error = "Custom URL is already in use.";
    res.locals.errors = { address: error };
    throw new CustomError("Custom URL is already in use.");
  }

  // Update link
  const [updatedLink] = await query.link.update(
    {
      id: link.id
    },
    {
      ...(address && { address }),
      ...(description && { description }),
      ...(target && { target }),
      ...(expire_in && { expire_in }),
      ...(password && { password })
    }
  );

  if (req.isHTML) {
    res.render("partials/links/edit", {
      swap_oob: true,
      success: "Link has been updated.",
      ...utils.sanitize.link({ ...link, ...updatedLink }),
    });
    return;
  }

  return res.status(200).send(utils.sanitize.link({ ...link, ...updatedLink }));
};

/**
 * @type {import("express").Handler}
 */
async function remove(req, res) {
  const { error, isRemoved, link } = await query.link.remove({
    uuid: req.params.id,
    ...(!req.user.admin && { user_id: req.user.id })
  });

  if (!isRemoved) {
    const messsage = error || "Could not delete the link.";
    throw new CustomError(messsage);
  }

  await utils.sleep(1000);

  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadLinks");
    res.render("partials/links/dialog_delete_success", {
      link: utils.getShortURL(link.address, link.domain).link,
    });
    return;
  }

  return res
    .status(200)
    .send({ message: "Link has been deleted successfully." });
};

// export const report: Handler = async (req, res) => {
//   const { link } = req.body;

//   const mail = await transporter.sendMail({
//     from: env.MAIL_FROM || env.MAIL_USER,
//     to: env.REPORT_EMAIL,
//     subject: "[REPORT]",
//     text: link,
//     html: link
//   });

//   if (!mail.accepted.length) {
//     throw new CustomError("Couldn't submit the report. Try again later.");
//   }
//   return res
//     .status(200)
//     .send({ message: "Thanks for the report, we'll take actions shortly." });
// };

// export const ban: Handler = async (req, res) => {
//   const { id } = req.params;

//   const update = {
//     banned_by_id: req.user.id,
//     banned: true
//   };

//   // 1. Check if link exists
//   const link = await query.link.find({ uuid: id });

//   if (!link) {
//     throw new CustomError("No link has been found.", 400);
//   }

//   if (link.banned) {
//     return res.status(200).send({ message: "Link has been banned already." });
//   }

//   const tasks = [];

//   // 2. Ban link
//   tasks.push(query.link.update({ uuid: id }, update));

//   const domain = utils.removeWww(URL.parse(link.target).hostname);

//   // 3. Ban target's domain
//   if (req.body.domain) {
//     tasks.push(query.domain.add({ ...update, address: domain }));
//   }

//   // 4. Ban target's host
//   if (req.body.host) {
//     const dnsRes = await dnsLookup(domain).catch(() => {
//       throw new CustomError("Couldn't fetch DNS info.");
//     });
//     const host = dnsRes?.address;
//     tasks.push(query.host.add({ ...update, address: host }));
//   }

//   // 5. Ban link owner
//   if (req.body.user && link.user_id) {
//     tasks.push(query.user.update({ id: link.user_id }, update));
//   }

//   // 6. Ban all of owner's links
//   if (req.body.userLinks && link.user_id) {
//     tasks.push(query.link.update({ user_id: link.user_id }, update));
//   }

//   // 7. Wait for all tasks to finish
//   await Promise.all(tasks).catch(() => {
//     throw new CustomError("Couldn't ban entries.");
//   });

//   // 8. Send response
//   return res.status(200).send({ message: "Banned link successfully." });
// };

// export const redirect = (app) => async (
//   req,
//   res,
//   next
// ) => {
//   const isBot = isbot(req.headers["user-agent"]);
//   const isPreservedUrl = validators.preservedUrls.some(
//     item => item === req.path.replace("/", "")
//   );

//   if (isPreservedUrl) return next();

//   // 1. If custom domain, get domain info
//   const host = utils.removeWww(req.headers.host);
//   const domain =
//     host !== env.DEFAULT_DOMAIN
//       ? await query.domain.find({ address: host })
//       : null;

//   // 2. Get link
//   const address = req.params.id.replace("+", "");
//   const link = await query.link.find({
//     address,
//     domain_id: domain ? domain.id : null
//   });

//   // 3. When no link, if has domain redirect to domain's homepage
//   // otherwise redirect to 404
//   if (!link) {
//     return res.redirect(302, domain ? domain.homepage : "/404");
//   }

//   // 4. If link is banned, redirect to banned page.
//   if (link.banned) {
//     return res.redirect("/banned");
//   }

//   // 5. If wants to see link info, then redirect
//   const doesRequestInfo = /.*\+$/gi.test(req.params.id);
//   if (doesRequestInfo && !link.password) {
//     return app.render(req, res, "/url-info", { target: link.target });
//   }

//   // 6. If link is protected, redirect to password page
//   if (link.password) {
//     return res.redirect(`/protected/${link.uuid}`);
//   }

//   // 7. Create link visit
//   if (link.user_id && !isBot) {
//     queue.visit.add({
//       headers: req.headers,
//       realIP: req.realIP,
//       referrer: req.get("Referrer"),
//       link
//     });
//   }

//   // 8. Redirect to target
//   return res.redirect(link.target);
// };

// export const redirectProtected: Handler = async (req, res) => {
//   // 1. Get link
//   const uuid = req.params.id;
//   const link = await query.link.find({ uuid });

//   // 2. Throw error if no link
//   if (!link || !link.password) {
//     throw new CustomError("Couldn't find the link.", 400);
//   }

//   // 3. Check if password matches
//   const matches = await bcrypt.compare(req.body.password, link.password);

//   if (!matches) {
//     throw new CustomError("Password is not correct.", 401);
//   }

//   // 4. Create visit
//   if (link.user_id) {
//     queue.visit.add({
//       headers: req.headers,
//       realIP: req.realIP,
//       referrer: req.get("Referrer"),
//       link
//     });
//   }

//   // 5. Send target
//   return res.status(200).send({ target: link.target });
// };

// export const redirectCustomDomain: Handler = async (req, res, next) => {
//   const { path } = req;
//   const host = utils.removeWww(req.headers.host);

//   if (host === env.DEFAULT_DOMAIN) {
//     return next();
//   }

//   if (
//     path === "/" ||
//     validators.preservedUrls
//       .filter(l => l !== "url-password")
//       .some(item => item === path.replace("/", ""))
//   ) {
//     const domain = await query.domain.find({ address: host });
//     const redirectURL = domain
//       ? domain.homepage
//       : `https://${env.DEFAULT_DOMAIN + path}`;

//     return res.redirect(302, redirectURL);
//   }

//   return next();
// };

// export const stats: Handler = async (req, res) => {
//   const { user } = req;
//   const uuid = req.params.id;

//   const link = await query.link.find({
//     ...(!user.admin && { user_id: user.id }),
//     uuid
//   });

//   if (!link) {
//     throw new CustomError("Link could not be found.");
//   }

//   const stats = await query.visit.find({ link_id: link.id }, link.visit_count);

//   if (!stats) {
//     throw new CustomError("Could not get the short link stats.");
//   }

//   return res.status(200).send({
//     ...stats,
//     ...utils.sanitize.link(link)
//   });
// };

module.exports = {
  create,
  edit,
  get,
  remove,
}