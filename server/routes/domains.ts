import { Router } from "express";
import asyncHandler from "express-async-handler";

import * as validators from "../handlers/validators";
import * as helpers from "../handlers/helpers";
import * as domains from "../handlers/domains";
import * as auth from "../handlers/auth";

const router = Router();

router.post(
  "/",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  validators.addDomain,
  asyncHandler(helpers.verify),
  asyncHandler(domains.add)
);

router.delete(
  "/:id",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  validators.removeDomain,
  asyncHandler(helpers.verify),
  asyncHandler(domains.remove)
);

export default router;
