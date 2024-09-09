const { validationResult } = require("express-validator");
const signale = require("signale");

const { CustomError, sanitize } = require("../utils");
const { logger } = require("../config/winston");
const query = require("../queries")
const env = require("../env");

// export const ip: Handler = (req, res, next) => {
//   req.realIP =
//     (req.headers["x-real-ip"] as string) || req.connection.remoteAddress || "";
//   return next();
// };

function error(error, req, res, _next) {
  if (env.isDev) {
    signale.fatal(error);
  }

  const message = error instanceof CustomError ? error.message : "An error occurred.";
  const statusCode = error.statusCode ?? 500;

  if (req.isHTML && req.viewTemplate) {
    res.render(req.viewTemplate, { error: message });
    return;
  }

  return res.status(statusCode).json({ error: message });
};


function verify(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array();
  const error = errors[0].msg;
  
  res.locals.errors = {};
  errors.forEach(e => {
    if (res.locals.errors[e.param]) return;
    res.locals.errors[e.param] = e.msg;
  });


  throw new CustomError(error, 400);
}

function parseQuery(req, res, next) {
  const { admin } = req.user || {};

  if (
    typeof req.query.limit !== "undefined" &&
    typeof req.query.limit !== "string"
  ) {
    return res.status(400).json({ error: "limit query is not valid." });
  }

  if (
    typeof req.query.skip !== "undefined" &&
    typeof req.query.skip !== "string"
  ) {
    return res.status(400).json({ error: "skip query is not valid." });
  }

  if (
    typeof req.query.search !== "undefined" &&
    typeof req.query.search !== "string"
  ) {
    return res.status(400).json({ error: "search query is not valid." });
  }

  const limit = parseInt(req.query.limit) || 10;
  const skip = parseInt(req.query.skip) || 0;

  req.context = {
    limit: limit > 50 ? 50 : limit,
    skip,
    all: admin ? req.query.all === "true" || req.query.all === "on" : false
  };

  next();
};

module.exports = {
  error,
  parseQuery,
  verify,
}