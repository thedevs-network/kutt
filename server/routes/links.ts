import { Router } from "express";
import asyncHandler from "express-async-handler";
import cors from "cors";

import * as auth from "../handlers/auth";
import * as validators from "../handlers/validators";
import * as sanitizers from "../handlers/sanitizers";
import * as helpers from "../handlers/helpers";
import { getLinks, createLink } from "../handlers/links";

const router = Router();

router.get(
  "/",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  helpers.query,
  getLinks
);

router.post(
  "/",
  cors(),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwtLoose),
  asyncHandler(auth.recaptcha),
  sanitizers.createLink,
  validators.createLink,
  asyncHandler(validators.verify),
  createLink
);

export default router;
