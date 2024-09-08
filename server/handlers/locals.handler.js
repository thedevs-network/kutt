function createLink(req, res, next) {
  res.locals.show_advanced = !!req.body.show_advanced;
  next();
}

function editLink(req, res, next) {
  res.locals.id = req.params.id;
  res.locals.class = "no-animation";
  next();
}

function protected(req, res, next) {
  res.locals.id = req.params.id;
  next();
}

module.exports = {
  createLink,
  editLink,
  protected,
}