const bcrypt = require("bcryptjs");

const query = require("../queries");
const utils = require("../utils");
const mail = require("../mail");
const env = require("../env");

async function get(req, res) {
  const domains = await query.domain.get({ user_id: req.user.id });

  const data = {
    apikey: req.user.apikey,
    email: req.user.email,
    domains: domains.map(utils.sanitize.domain)
  };

  return res.status(200).send(data);
};

async function remove(req, res) {
  await query.user.remove(req.user);

  if (req.isHTML) {
    utils.deleteCurrentToken(res);
    res.setHeader("HX-Trigger-After-Swap", "redirectToHomepage");
    res.render("partials/settings/delete_account", {
      success: "Account has been deleted. Logging out..."
    });
    return;
  }
  
  return res.status(200).send("OK");
};

async function removeByAdmin(req, res) {
  const user = await query.user.find({ id: req.params.id });

  if (!user) {
    const message = "Could not find the user.";
    if (req.isHTML) {
      return res.render("partials/admin/dialog/message", {
        layout: false,
        message
      });
    } else {
      return res.status(400).send({ message });
    }
  }
  
  await query.user.remove(user);

  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/delete_user_success", {
      email: user.email,
    });
    return;
  }
  
  return res.status(200).send({ message: "User has been deleted successfully." });
};

async function getAdmin(req, res) {
  const { limit, skip, all } = req.context;
  const { role, search } = req.query;
  const userId = req.user.id;
  const verified = utils.parseBooleanQuery(req.query.verified);
  const banned = utils.parseBooleanQuery(req.query.banned);
  const domains = utils.parseBooleanQuery(req.query.domains);
  const links = utils.parseBooleanQuery(req.query.links);

  const match = {
    ...(role && { role }),
    ...(verified !== undefined && { verified }),
    ...(banned !== undefined && { banned }),
  };

  const [data, total] = await Promise.all([
    query.user.getAdmin(match, { limit, search, domains, links, skip }),
    query.user.totalAdmin(match, { search, domains, links })
  ]);

  const users = data.map(utils.sanitize.user_admin);
    
  if (req.isHTML) {
    res.render("partials/admin/users/table", {
      total,
      total_formatted: total.toLocaleString("en-US"),
      limit,
      skip,
      users,
    })
    return;
  }

  return res.send({
    total,
    limit,
    skip,
    data: users,
  });
};

async function ban(req, res) {
  const { id } = req.params;

  const update = {
    banned_by_id: req.user.id,
    banned: true
  };

  // 1. check if user exists
  const user = await query.user.find({ id });

  if (!user) {
    throw new CustomError("No user has been found.", 400);
  }

  if (user.banned) {
    throw new CustomError("User has been banned already.", 400);
  }

  const tasks = [];

  // 2. ban user
  tasks.push(query.user.update({ id }, update));
  
  // 3. ban user links
  if (req.body.links) {
    tasks.push(query.link.update({ user_id: id }, update));
  }
  
  // 4. ban user domains
  if (req.body.domains) {
    tasks.push(query.domain.update({ user_id: id }, update));
  }

  // 5. wait for all tasks to finish
  await Promise.all(tasks).catch((err) => {
    throw new CustomError("Couldn't ban entries.");
  });

  // 6. send response
  if (req.isHTML) {
    res.setHeader("HX-Reswap", "outerHTML");
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/ban_user_success", {
      email: user.email,
    });
    return;
  }

  return res.status(200).send({ message: "Banned user successfully." });
}

async function create(req, res) {
  const salt = await bcrypt.genSalt(12);
  req.body.password = await bcrypt.hash(req.body.password, salt);

  const user = await query.user.create(req.body);

  if (req.body.verification_email && !user.banned && !user.verified) {
    await mail.verification(user);
  }

  if (req.isHTML) {
    res.setHeader("HX-Trigger", "reloadMainTable");
    res.render("partials/admin/dialog/create_user_success", {
      email: user.email,
    });
    return;
  }

  return res.status(201).send({ message: "The user has been created successfully." });
}

module.exports = {
  ban,
  create,
  get,
  getAdmin,
  remove,
  removeByAdmin,
}