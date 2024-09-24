const { Router } = require("express");

const validators = require("../handlers/validators.handler");
const helpers = require("../handlers/helpers.handler");
const asyncHandler = require("../utils/asyncHandler");
const locals = require("../handlers/locals.handler");
const auth = require("../handlers/auth.handler");
const utils = require("../utils");
const env = require("../env");

const router = Router();

router.post(
  "/login",
  locals.viewTemplate("partials/auth/form"),
  validators.login,
  asyncHandler(helpers.verify),
  asyncHandler(auth.local),
  asyncHandler(auth.login)
);

router.post(
  "/signup",
  locals.viewTemplate("partials/auth/form"),
  auth.featureAccess([!env.DISALLOW_REGISTRATION, env.MAIL_ENABLED]),
  validators.signup,
  asyncHandler(helpers.verify),
  asyncHandler(auth.signup)
);

router.post(
  "/change-password",
  locals.viewTemplate("partials/settings/change_password"),
  asyncHandler(auth.jwt),
  validators.changePassword,
  asyncHandler(helpers.verify),
  asyncHandler(auth.changePassword)
);

router.post(
  "/change-email",
  locals.viewTemplate("partials/settings/change_email"),
  asyncHandler(auth.jwt),
  auth.featureAccess([env.MAIL_ENABLED]),
  validators.changeEmail,
  asyncHandler(helpers.verify),
  asyncHandler(auth.changeEmailRequest)
);

router.post(
  "/apikey",
  locals.viewTemplate("partials/settings/apikey"),
  asyncHandler(auth.jwt),
  asyncHandler(auth.generateApiKey)
);

router.post(
  "/reset-password",
  locals.viewTemplate("partials/reset_password/form"),
  auth.featureAccess([env.MAIL_ENABLED]),
  validators.resetPassword,
  asyncHandler(helpers.verify),
  asyncHandler(auth.resetPasswordRequest)
);

module.exports = router;
