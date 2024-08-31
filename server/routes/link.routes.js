const { Router } = require("express");
const asyncHandler = require("express-async-handler");
const cors = require("cors");

const validators = require("../handlers/validators.handler");

const helpers = require("../handlers/helpers.handler");
const locals = require("../handlers/locals.handler");
const link = require("../handlers/links.handler");
const auth = require("../handlers/auth.handler");
const env = require("../env");

const router = Router();

router.get(
  "/",
  helpers.viewTemplate("partials/links/table"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  helpers.parseQuery,
  asyncHandler(link.get)
);

router.post(
  "/",
  cors(),
  helpers.viewTemplate("partials/shortener"),
  asyncHandler(auth.apikey),
  asyncHandler(env.DISALLOW_ANONYMOUS_LINKS ? auth.jwt : auth.jwtLoose),
  asyncHandler(auth.cooldown),
  locals.createLink,
  validators.createLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.create)
);

router.patch(
  "/:id",
  helpers.viewTemplate("partials/links/edit"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  locals.editLink,
  validators.editLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.edit)
);

router.delete(
  "/:id",
  helpers.viewTemplate("partials/links/dialog/delete"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  validators.deleteLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.remove)
);

router.post(
  "/admin/ban/:id",
  helpers.viewTemplate("partials/links/dialog/ban"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin),
  validators.banLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.ban)
);

// router.get(
//   "/:id/stats",
//   asyncHandler(auth.apikey),
//   asyncHandler(auth.jwt),
//   validators.getStats,
//   asyncHandler(link.stats)
// );

// router.post(
//   "/:id/protected",
//   validators.redirectProtected,
//   asyncHandler(helpers.verify),
//   asyncHandler(link.redirectProtected)
// );

// router.post(
//   "/report",
//   validators.reportLink,
//   asyncHandler(helpers.verify),
//   asyncHandler(link.report)
// );


module.exports = router;
