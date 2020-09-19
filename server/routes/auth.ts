import asyncHandler from "express-async-handler";
import { Router } from "express";

import * as validators from "../handlers/validators";
import * as helpers from "../handlers/helpers";
import * as auth from "../handlers/auth";

const router = Router();

router.post(
  "/login",
  validators.login,
  asyncHandler(helpers.verify),
  asyncHandler(auth.local),
  asyncHandler(auth.token)
);

router.post(
  "/signup",
  auth.signupAccess,
  validators.signup,
  asyncHandler(helpers.verify),
  asyncHandler(auth.signup)
);

router.post("/renew", asyncHandler(auth.jwt), asyncHandler(auth.token));

router.post(
  "/change-password",
  asyncHandler(auth.jwt),
  validators.changePassword,
  asyncHandler(helpers.verify),
  asyncHandler(auth.changePassword)
);

router.post(
  "/change-email",
  asyncHandler(auth.jwt),
  validators.changePassword,
  asyncHandler(helpers.verify),
  asyncHandler(auth.changeEmailRequest)
);

router.post(
  "/apikey",
  asyncHandler(auth.jwt),
  asyncHandler(auth.generateApiKey)
);

router.post("/reset-password", asyncHandler(auth.resetPasswordRequest));

export default router;
