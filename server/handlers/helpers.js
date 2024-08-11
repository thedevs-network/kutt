const { validationResult } = require("express-validator");
const signale = require("signale");

const { logger } = require("../config/winston");
const { CustomError } = require("../utils");
const env = require("../env");

// export const ip: Handler = (req, res, next) => {
//   req.realIP =
//     (req.headers["x-real-ip"] as string) || req.connection.remoteAddress || "";
//   return next();
// };

/**
 * @type {import("express").ErrorRequestHandler}
 */
function error(error, _req, res, _next) {
  if (env.isDev) {
    signale.fatal(error);
  }

  if (error instanceof CustomError) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }

  return res.status(500).json({ error: "An error occurred." });
};

function verify(template) {
  return function (req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const accepts = req.accepts(["json", "html"]);
      const message = errors.array()[0].msg;

      if (template && accepts === "html") {
        return res.render(template, {
          layout: null,
          error: message
        });
      }
      throw new CustomError(message, 400);
    }
    return next();
  }
}

// export const query: Handler = (req, res, next) => {
//   const { admin } = req.user || {};

//   if (
//     typeof req.query.limit !== "undefined" &&
//     typeof req.query.limit !== "string"
//   ) {
//     return res.status(400).json({ error: "limit query is not valid." });
//   }

//   if (
//     typeof req.query.skip !== "undefined" &&
//     typeof req.query.skip !== "string"
//   ) {
//     return res.status(400).json({ error: "skip query is not valid." });
//   }

//   if (
//     typeof req.query.search !== "undefined" &&
//     typeof req.query.search !== "string"
//   ) {
//     return res.status(400).json({ error: "search query is not valid." });
//   }

//   const limit = parseInt(req.query.limit) || 10;
//   const skip = parseInt(req.query.skip) || 0;

//   req.context = {
//     limit: limit > 50 ? 50 : limit,
//     skip,
//     all: admin ? req.query.all === "true" : false
//   };

//   next();
// };

module.exports = {
  error,
  verify,
}