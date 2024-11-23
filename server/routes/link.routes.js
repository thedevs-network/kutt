const { Router } = require("express");
const cors = require("cors");

const validators = require("../handlers/validators.handler");
const helpers = require("../handlers/helpers.handler");
const asyncHandler = require("../utils/asyncHandler");
const locals = require("../handlers/locals.handler");
const link = require("../handlers/links.handler");
const auth = require("../handlers/auth.handler");
const env = require("../env");

const router = Router();

router.get(
  "/",
  locals.viewTemplate("partials/links/table"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  helpers.parseQuery,
  asyncHandler(link.get)
);

router.get(
  "/admin",
  locals.viewTemplate("partials/admin/links/table"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin),
  helpers.parseQuery,
  locals.adminTable,
  asyncHandler(link.getAdmin)
);

router.post(
  "/",
  cors(),
  locals.viewTemplate("partials/shortener"),
  asyncHandler(auth.apikey),
  asyncHandler(env.DISALLOW_ANONYMOUS_LINKS ? auth.jwt : auth.jwtLoose),
  locals.createLink,
  validators.createLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.create)
);

router.patch(
  "/:id",
  locals.viewTemplate("partials/links/edit"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  locals.editLink,
  validators.editLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.edit)
);

router.patch(
  "/admin/:id",
  locals.viewTemplate("partials/links/edit"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin),
  locals.editLink,
  validators.editLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.editAdmin)
);

router.delete(
  "/:id",
  locals.viewTemplate("partials/links/dialog/delete"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  validators.deleteLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.remove)
);

router.post(
  "/admin/ban/:id",
  locals.viewTemplate("partials/links/dialog/ban"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin),
  validators.banLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.ban)
);

router.get(
  "/:id/stats",
  locals.viewTemplate("partials/stats"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  validators.getStats,
  asyncHandler(helpers.verify),
  asyncHandler(link.stats)
);

router.post(
  "/:id/protected",
  locals.viewTemplate("partials/protected/form"),
  locals.protected,
  validators.redirectProtected,
  asyncHandler(helpers.verify),
  asyncHandler(link.redirectProtected)
);

router.post(
  "/report",
  locals.viewTemplate("partials/report/form"),
  auth.featureAccess([env.MAIL_ENABLED]),
  validators.reportLink,
  asyncHandler(helpers.verify),
  asyncHandler(link.report)
);


module.exports = router;
