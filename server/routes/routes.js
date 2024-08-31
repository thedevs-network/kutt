const { Router } = require("express");

const helpers = require("./../handlers/helpers.handler");
const domains = require("./domain.routes");
// import health from "./health.routes";
const link = require("./link.routes");
const user = require("./user.routes");
const auth = require("./auth.routes");

const router = Router();

router.use(helpers.addNoLayoutLocals);
router.use("/domains", domains);
// router.use("/health", health);
router.use("/links", link);
router.use("/users", user);
router.use("/auth", auth);

module.exports = router;
