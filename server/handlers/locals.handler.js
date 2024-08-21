/**
 * @type {import("express").Handler}
 */
function createLink(req, res, next) {
  res.locals.show_advanced = !!req.body.show_advanced;
  next();
}

/**
 * @type {import("express").Handler}
 */
function editLink(req, res, next) {
  res.locals.id = req.params.id;
  res.locals.class = "no-animation";
  next();
}

module.exports = {
  createLink,
  editLink,
}