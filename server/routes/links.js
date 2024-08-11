const { Router } = require("express");
const asyncHandler = require("express-async-handler");
const cors = require("cors");

const validators = require("../handlers/validators");

const helpers = require("../handlers/helpers");
const link = require("../handlers/links");
const auth = require("../handlers/auth");
const env = require("../env");

const router = Router();

// router.get(
//   "/",
//   asyncHandler(auth.apikey),
//   asyncHandler(auth.jwt),
//   helpers.query,
//   asyncHandler(link.get)
// );

router.post(
  "/",
  cors(),
  asyncHandler(auth.apikey),
  asyncHandler(env.DISALLOW_ANONYMOUS_LINKS ? auth.jwt : auth.jwtLoose),
  asyncHandler(auth.cooldown),
  validators.createLink,
  asyncHandler(helpers.verify()),
  asyncHandler(link.create)
);

// router.patch(
//   "/:id",
//   asyncHandler(auth.apikey),
//   asyncHandler(auth.jwt),
//   validators.editLink,
//   asyncHandler(helpers.verify),
//   asyncHandler(link.edit)
// );

// router.delete(
//   "/:id",
//   asyncHandler(auth.apikey),
//   asyncHandler(auth.jwt),
//   validators.deleteLink,
//   asyncHandler(helpers.verify),
//   asyncHandler(link.remove)
// );

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

// router.post(
//   "/admin/ban/:id",
//   asyncHandler(auth.apikey),
//   asyncHandler(auth.jwt),
//   asyncHandler(auth.admin),
//   validators.banLink,
//   asyncHandler(helpers.verify),
//   asyncHandler(link.ban)
// );

module.exports = router;
