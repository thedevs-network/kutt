const { Router } = require("express");

// import domains from "./domains";
// import health from "./health";
const links = require("./links");
// import user from "./users";
const auth = require("./auth");

const router = Router();

// router.use("/domains", domains);
// router.use("/health", health);
router.use("/links", links);
// router.use("/users", user);
router.use("/auth", auth);

module.exports = router;
