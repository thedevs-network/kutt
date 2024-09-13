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
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user), 
  asyncHandler(renders.homepage)
);

router.get(
  "/login", 
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(renders.login)
);

router.get(
  "/logout", 
  asyncHandler(renders.logout)
);

router.get(
  "/404", 
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.notFound)
);

router.get(
  "/settings",
  asyncHandler(auth.jwtPage),
  asyncHandler(locals.user),
  asyncHandler(renders.settings)
);

router.get(
  "/stats",
  asyncHandler(auth.jwtPage),
  asyncHandler(locals.user),
  asyncHandler(renders.stats)
);

router.get(
  "/banned",
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.banned)
);

router.get(
  "/report",
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.report)
);

router.get(
  "/reset-password",
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.resetPassword)
);

router.get(
  "/reset-password/:resetPasswordToken",
  asyncHandler(auth.resetPassword),
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.resetPasswordResult)
);

router.get(
  "/verify-email/:changeEmailToken",
  asyncHandler(auth.changeEmail),
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.verifyChangeEmail)
);

router.get(
  "/verify/:verificationToken",
  asyncHandler(auth.verify),
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.verify)
);

router.get(
  "/terms",
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.terms)
);

// partial renders
router.get(
  "/confirm-link-delete", 
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(renders.confirmLinkDelete)
);

router.get(
  "/confirm-link-ban", 
  locals.noLayout,
  locals.viewTemplate("partials/links/dialog/message"),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.confirmLinkBan)
);

router.get(
  "/link/edit/:id",
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(renders.linkEdit)
);

router.get(
  "/add-domain-form", 
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(renders.addDomainForm)
);

router.get(
  "/confirm-domain-delete", 
  locals.noLayout,
  locals.viewTemplate("partials/settings/domain/delete"),
  asyncHandler(auth.jwt),
  asyncHandler(renders.confirmDomainDelete)
);

router.get(
  "/get-report-email", 
  locals.noLayout,
  locals.viewTemplate("partials/report/email"),
  asyncHandler(renders.getReportEmail)
);

router.get(
  "/get-support-email", 
  locals.noLayout,
  locals.viewTemplate("partials/support_email"),
  asyncHandler(renders.getSupportEmail)
);

module.exports = router;
