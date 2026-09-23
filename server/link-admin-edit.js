const i18n = require("./i18n");
const query = require("./queries");
const utils = require("./utils");

async function view(id) {
  const [link] = await query.link.getAdmin({ uuid: id }, { limit: 1, skip: 0 });
  if (!link) throw new utils.CustomError(i18n.t("messages.link_was_not_found"), 404);
  return utils.sanitize.link_admin(link);
}

// Run only after the route's admin gate. Metadata always comes from the current
// joined record, never submitted owner/domain fields or the public link cache.
async function prepare(req, res, next) {
  if (req.isHTML) {
    res.locals.id = undefined;
    Object.assign(res.locals, await view(req.params.id));
    for (const name of ["target", "address", "description"]) {
      if (typeof req.body[name] === "string") res.locals[name] = req.body[name].slice(0, 2040);
    }
  }
  next();
}

module.exports = { view, prepare };
