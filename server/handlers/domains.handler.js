const { Handler } = require("express");

const { CustomError, sanitize } = require("../utils");
const query = require("../queries");
const redis = require("../redis");
const utils = require("../utils");
const env = require("../env");

async function add(req, res) {
  const { address, homepage } = req.body;

  const domain = await query.domain.add({
    address,
    homepage,
    user_id: req.user.id
  });

  if (req.isHTML) {
    const domains = (await query.domain.get({ user_id: req.user.id })).map(sanitize.domain);
    res.setHeader("HX-Reswap", "none");
    res.render("partials/settings/domain/table", {
      domains
    });
    return;
  }
  
  return res.status(200).send(sanitize.domain(domain));
};

async function addAdmin(req, res) {
  const { address, banned, homepage } = req.body;

  const domain = await query.domain.add({
    address,
    homepage,
    banned,
    ...(banned && { banned_by_id: req.user.id })
  });

  if (req.isHTML) {
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/add_domain_success", {
      address: domain.address,
    });
    return;
  }
  
  return res.status(200).send({ message: "The domain has been added successfully." });
};

async function remove(req, res) {
  const domain = await query.domain.find({
    uuid: req.params.id,
    user_id: req.user.id
  });

  if (!domain) {
    throw new CustomError("Could not delete the domain.", 400);
  }
  
  const [updatedDomain] = await query.domain.update(
    { id: domain.id },
    { user_id: null }
  );

  if (!updatedDomain) {
    throw new CustomError("Could not delete the domain.", 500);
  }

  if (env.REDIS_ENABLED) {
    redis.remove.domain(updatedDomain);
  }

  if (req.isHTML) {
    const domains = (await query.domain.get({ user_id: req.user.id })).map(sanitize.domain);
    res.setHeader("HX-Reswap", "outerHTML");
    res.render("partials/settings/domain/delete_success", {
      domains,
      address: domain.address,
    });
    return;
  }

  return res.status(200).send({ message: "Domain deleted successfully" });
};

async function removeAdmin(req, res) {
  const id = req.params.id;
  const links = req.query.links

  const domain = await query.domain.find({ id });

  if (!domain) {
    throw new CustomError("Could not find the domain.", 400);
  }

  if (links) {
    await query.link.batchRemove({ domain_id: id });
  }
  
  await query.domain.remove(domain);

  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/delete_domain_success", {
      address: domain.address,
    });
    return;
  }

  return res.status(200).send({ message: "Domain deleted successfully" });
}

async function getAdmin(req, res) {
  const { limit, skip } = req.context;
  const search = req.query.search;
  const user = req.query.user;
  const banned = utils.parseBooleanQuery(req.query.banned);
  const owner = utils.parseBooleanQuery(req.query.owner);
  const links = utils.parseBooleanQuery(req.query.links);

  const match = {
    ...(banned !== undefined && { banned }),
    ...(owner !== undefined && { user_id: [owner ? "is not" : "is", null] }),
  };

  const [data, total] = await Promise.all([
    query.domain.getAdmin(match, { limit, search, user, links, skip }),
    query.domain.totalAdmin(match, { search, user, links })
  ]);

  const domains = data.map(utils.sanitize.domain_admin);

  if (req.isHTML) {
    res.render("partials/admin/domains/table", {
      total,
      total_formatted: total.toLocaleString("en-US"),
      limit,
      skip,
      table_domains: domains,
    })
    return;
  }

  return res.send({
    total,
    limit,
    skip,
    data: domains,
  });
}

async function ban(req, res) {
  const { id } = req.params;

  const update = {
    banned_by_id: req.user.id,
    banned: true
  };

  // 1. check if domain exists
  const domain = await query.domain.find({ id });

  if (!domain) {
    throw new CustomError("No domain has been found.", 400);
  }

  if (domain.banned) {
    throw new CustomError("Domain has been banned already.", 400);
  }

  const tasks = [];

  // 2. ban domain
  tasks.push(query.domain.update({ id }, update));
  
  // 3. ban user
  if (req.body.user && domain.user_id) {
    tasks.push(query.user.update({ id: domain.user_id }, update));
  }
  
  // 4. ban links
  if (req.body.links) {
    tasks.push(query.link.update({ domain_id: id }, update));
  }
  
  // 5. wait for all tasks to finish
  await Promise.all(tasks).catch((err) => {
    throw new CustomError("Couldn't ban entries.");
  });

  // 6. send response
  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/ban_domain_success", {
      address: domain.address,
    });
    return;
  }

  return res.status(200).send({ message: "Banned domain successfully." });
}

module.exports = {
  add,
  addAdmin,
  ban,
  getAdmin,
  remove,
  removeAdmin,
}