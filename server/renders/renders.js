const asyncHandler = require("express-async-handler");
const { Router } = require("express");

const helpers = require("../handlers/helpers.handler");
const auth = require("../handlers/auth.handler");
const renders = require("./renders.handler");

const router = Router();

// pages
router.get(
  "/",
  asyncHandler(auth.jwtLoose),
  asyncHandler(helpers.addUserLocals), 
  asyncHandler(renders.homepage)
);

router.get(
  "/login", 
  asyncHandler(auth.jwtLoose),
  asyncHandler(renders.login)
);

router.get(
  "/logout", 
  asyncHandler(auth.jwtLoose),
  asyncHandler(renders.logout)
);

router.get(
  "/settings",
  asyncHandler(auth.jwtLoose),
  asyncHandler(helpers.addUserLocals),
  asyncHandler(renders.settings)
);

// partial renders
router.get(
  "/confirm-link-delete", 
  helpers.addNoLayoutLocals,
  asyncHandler(auth.jwt),
  asyncHandler(renders.confirmLinkDelete)
);

router.get(
  "/confirm-link-ban", 
  helpers.addNoLayoutLocals,
  helpers.viewTemplate("partials/links/dialog/message"),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.confirmLinkBan)
);

router.get(
  "/link/edit/:id",
  helpers.addNoLayoutLocals,
  asyncHandler(auth.jwt),
  asyncHandler(renders.linkEdit)
);

router.get(
  "/add-domain-form", 
  helpers.addNoLayoutLocals,
  asyncHandler(auth.jwt),
  asyncHandler(renders.addDomainForm)
);

router.get(
  "/confirm-domain-delete", 
  helpers.addNoLayoutLocals,
  helpers.viewTemplate("partials/settings/domain/delete"),
  asyncHandler(auth.jwt),
  asyncHandler(renders.confirmDomainDelete)
);

module.exports = router;
