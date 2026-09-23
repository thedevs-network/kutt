const { Router } = require("express");
const auth = require("../handlers/auth.handler");
const tokens = require("../handlers/tokens.handler");
const helpers = require("../handlers/helpers.handler");
const locals = require("../handlers/locals.handler");
const asyncHandler = require("../utils/asyncHandler");

const router = Router();
router.use(tokens.sessionOnly, asyncHandler(auth.jwt));
router.get("/", asyncHandler(tokens.list));
router.use(asyncHandler(tokens.load), locals.viewTemplate("partials/settings/tokens"));
router.post("/", helpers.rateLimit({ window: 60, limit: 5 }), asyncHandler(tokens.create));
router.delete("/:id", asyncHandler(tokens.revoke));
module.exports = router;
