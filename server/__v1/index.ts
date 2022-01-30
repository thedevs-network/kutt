import asyncHandler from "express-async-handler";
import { Router } from "express";
import cors from "cors";

import {
  validateUrl,
  ipCooldownCheck
} from "./controllers/validateBodyController";
import * as auth from "../handlers/auth";
import * as link from "./controllers/linkController";
import env from "../env";

const router = Router();

/* URL shortener */
router.post(
  "/url/submit",
  cors(),
  asyncHandler(auth.apikey),
  asyncHandler(env.DISALLOW_ANONYMOUS_LINKS ? auth.jwt : auth.jwtLoose),
  asyncHandler(auth.recaptcha),
  asyncHandler(validateUrl),
  asyncHandler(ipCooldownCheck),
  asyncHandler(link.shortener)
);
router.post(
  "/url/deleteurl",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(link.deleteUserLink)
);
router.get(
  "/url/geturls",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(link.getUserLinks)
);
router.post(
  "/url/customdomain",
  asyncHandler(auth.jwt),
  asyncHandler(link.setCustomDomain)
);
router.delete(
  "/url/customdomain",
  asyncHandler(auth.jwt),
  asyncHandler(link.deleteCustomDomain)
);
router.get(
  "/url/stats",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(link.getLinkStats)
);
router.post("/url/requesturl", asyncHandler(link.goToLink));
router.post("/url/report", asyncHandler(link.reportLink));
router.post(
  "/url/admin/ban",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin),
  asyncHandler(link.ban)
);

export default router;
