const asyncHandler = require("express-async-handler");
const { Router } = require("express");

const auth = require("../handlers/auth.handler");
const renders = require("./renders.handler");

const router = Router();

router.use(asyncHandler(auth.jwtLoose));

router.get("/", renders.homepage);
router.get("/login", renders.login);
router.get("/logout", renders.logout);
router.get("/confirm-link-delete", renders.confirmLinkDelete);
router.get("/link/edit/:id", renders.linkEdit);

module.exports = router;
