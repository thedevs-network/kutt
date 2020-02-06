import { Router } from "express";
import asyncHandler from "express-async-handler";

import * as auth from "../handlers/auth";
import * as user from "../handlers/users";

const router = Router();

router.get(
  "/",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(user.get)
);

export default router;
