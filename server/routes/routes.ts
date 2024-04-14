import { Router } from "express";

import auth from "./auth";
import domains from "./domains";
import health from "./health";
import links from "./links";
import metrics from "./metrics";
import user from "./users";

const router = Router();

router.use("/auth", auth);
router.use("/domains", domains);
router.use("/health", health);
router.use("/links", links);
router.use("/metrics", metrics);
router.use("/users", user);

export default router;
