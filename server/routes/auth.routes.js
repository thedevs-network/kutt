const asyncHandler = require("express-async-handler");
const { Router } = require("express");

const validators = require("../handlers/validators.handler");
const helpers = require("../handlers/helpers.handler");
const auth = require("../handlers/auth.handler");
const utils = require("../utils");

const router = Router();

router.post(
  "/login",
  helpers.viewTemplate("partials/auth/form"),
  validators.login,
  asyncHandler(helpers.verify),
  asyncHandler(auth.local),
  asyncHandler(auth.login)
);

router.post(
  "/signup",
  helpers.viewTemplate("partials/auth/form"),
  auth.signupAccess,
  validators.signup,
  asyncHandler(helpers.verify),
  asyncHandler(auth.signup)
);

// router.post("/renew", asyncHandler(auth.jwt), asyncHandler(auth.token));

router.post(
  "/change-password",
  helpers.viewTemplate("partials/settings/change_password"),
  asyncHandler(auth.jwt),
  validators.changePassword,
  asyncHandler(helpers.verify),
  asyncHandler(auth.changePassword)
);

router.post(
  "/change-email",
  helpers.viewTemplate("partials/settings/change_email"),
  asyncHandler(auth.jwt),
  validators.changeEmail,
  asyncHandler(helpers.verify),
  asyncHandler(auth.changeEmailRequest)
);

router.post(
  "/apikey",
  helpers.viewTemplate("partials/settings/apikey"),
  asyncHandler(auth.jwt),
  asyncHandler(auth.generateApiKey)
);

router.post(
  "/reset-password",
  helpers.viewTemplate("partials/reset_password/form"),
  validators.resetPassword,
  asyncHandler(helpers.verify),
  asyncHandler(auth.resetPasswordRequest)
);

module.exports = router;
