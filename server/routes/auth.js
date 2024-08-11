const asyncHandler = require("express-async-handler");
const { Router } = require("express");

const validators = require("../handlers/validators");
const helpers = require("../handlers/helpers");
const auth = require("../handlers/auth");

const router = Router();

router.post(
  "/login",
  validators.login,
  asyncHandler(helpers.verify("partials/login_signup")),
  asyncHandler(auth.local),
  asyncHandler(auth.login)
);

router.post(
  "/signup",
  auth.signupAccess,
  validators.signup,
  asyncHandler(helpers.verify("partials/login_signup")),
  asyncHandler(auth.signup)
);

// router.post("/renew", asyncHandler(auth.jwt), asyncHandler(auth.token));

// router.post(
//   "/change-password",
//   asyncHandler(auth.jwt),
//   validators.changePassword,
//   asyncHandler(helpers.verify),
//   asyncHandler(auth.changePassword)
// );

// router.post(
//   "/change-email",
//   asyncHandler(auth.jwt),
//   validators.changePassword,
//   asyncHandler(helpers.verify),
//   asyncHandler(auth.changeEmailRequest)
// );

// router.post(
//   "/apikey",
//   asyncHandler(auth.jwt),
//   asyncHandler(auth.generateApiKey)
// );

// router.post("/reset-password", asyncHandler(auth.resetPasswordRequest));

module.exports = router;
