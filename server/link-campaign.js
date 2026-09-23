const campaign = require("../static/scripts/campaign-url");
const { CustomError } = require("./utils");

function normalize(body) {
  const values = Object.fromEntries(campaign.fields.filter(key => Object.hasOwn(body, key)).map(key => [key, body[key]]));
  if (!Object.keys(values).length) return body;
  // Require an explicit destination even on PATCH: no pre-authorization read or
  // stale read/modify/write of another request's destination is introduced here.
  try { return { ...body, target: campaign.apply(body.target, values) }; }
  catch (error) { throw new CustomError(error.message, 400); }
}

function middleware(req, res, next) {
  try { req.body = normalize(req.body); next(); }
  catch (error) { next(error); }
}
module.exports = { normalize, middleware, fields: campaign.fields };
