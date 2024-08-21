import { Router } from "express";
import asyncHandler from "express-async-handler";

import * as validators from "../handlers/validators.handler";
import * as helpers from "../handlers/helpers.handler";
import * as user from "../handlers/users.handler";
import * as auth from "../handlers/auth.handler";

const router = Router();

router.get(
  "/",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(user.get)
);

router.post(
  "/delete",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  validators.deleteUser,
  asyncHandler(helpers.verify),
  asyncHandler(user.remove)
);

export default router;
