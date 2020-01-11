import { Router } from "express";

import health from "./health";
import links from "./links";

const router = Router();

router.use("/api/v2/health", health);
router.use("/api/v2/links", links);

export default router;
