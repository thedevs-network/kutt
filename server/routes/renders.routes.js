const { Router } = require("express");

const helpers = require("../handlers/helpers.handler");
const renders = require("../handlers/renders.handler");
const asyncHandler = require("../utils/asyncHandler");
const locals = require("../handlers/locals.handler");
const auth = require("../handlers/auth.handler");

const router = Router();

// pages
router.get(
  "/",
  asyncHandler(auth.jwtLoose),
  asyncHandler(locals.addUserLocals), 
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
  "/404", 
  asyncHandler(auth.jwtLoose),
  asyncHandler(renders.notFound)
);

router.get(
  "/settings",
  asyncHandler(auth.jwtLoose),
  asyncHandler(locals.addUserLocals),
  asyncHandler(renders.settings)
);

router.get(
  "/stats",
  asyncHandler(auth.jwtLoose),
  asyncHandler(locals.addUserLocals),
  asyncHandler(renders.stats)
);

router.get(
  "/banned",
  asyncHandler(renders.banned)
);

router.get(
  "/report",
  asyncHandler(renders.report)
);

router.get(
  "/reset-password",
  asyncHandler(renders.resetPassword)
);

router.get(
  "/reset-password/:resetPasswordToken",
  asyncHandler(auth.resetPassword),
  asyncHandler(auth.jwtLoose),
  asyncHandler(locals.addUserLocals),
  asyncHandler(renders.resetPasswordResult)
);

router.get(
  "/verify-email/:changeEmailToken",
  asyncHandler(auth.changeEmail),
  asyncHandler(auth.jwtLoose),
  asyncHandler(locals.addUserLocals),
  asyncHandler(renders.verifyChangeEmail)
);

router.get(
  "/verify/:verificationToken",
  asyncHandler(auth.verify),
  asyncHandler(auth.jwtLoose),
  asyncHandler(locals.addUserLocals),
  asyncHandler(renders.verify)
);

router.get(
  "/terms",
  asyncHandler(renders.terms)
);

// partial renders
router.get(
  "/confirm-link-delete", 
  locals.addNoLayoutLocals,
  asyncHandler(auth.jwt),
  asyncHandler(renders.confirmLinkDelete)
);

router.get(
  "/confirm-link-ban", 
  locals.addNoLayoutLocals,
  locals.viewTemplate("partials/links/dialog/message"),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.confirmLinkBan)
);

router.get(
  "/link/edit/:id",
  locals.addNoLayoutLocals,
  asyncHandler(auth.jwt),
  asyncHandler(renders.linkEdit)
);

router.get(
  "/add-domain-form", 
  locals.addNoLayoutLocals,
  asyncHandler(auth.jwt),
  asyncHandler(renders.addDomainForm)
);

router.get(
  "/confirm-domain-delete", 
  locals.addNoLayoutLocals,
  locals.viewTemplate("partials/settings/domain/delete"),
  asyncHandler(auth.jwt),
  asyncHandler(renders.confirmDomainDelete)
);

router.get(
  "/get-report-email", 
  locals.addNoLayoutLocals,
  locals.viewTemplate("partials/report/email"),
  asyncHandler(renders.getReportEmail)
);

module.exports = router;
