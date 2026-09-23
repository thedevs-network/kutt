const { Router } = require("express");
const auth = require("../handlers/auth.handler");
const h = require("../handlers/webhooks.handler");
const wrap = require("../utils/asyncHandler");
const router = Router();
router.get("/stream", require("../handlers/tokens.handler").sessionOnly, wrap(auth.jwt), h.boundary, wrap(h.stream));
router.get("/", wrap(auth.apikey), wrap(auth.jwt), h.boundary, wrap(h.events));
module.exports = router;
