const i18n = require("../i18n");
const env = require("../env");
const { CustomError } = require("../utils");

module.exports = function loginOrigin(req, res, next) {
  try { require("../management-origin").sameOrigin(req, { login: true }); }
  catch (error) {
    res.status(403).set("Cache-Control", "no-store");
    return next(error);
  }
  // API clients without browser Origin/Fetch-Metadata remain supported.
  next();
};
