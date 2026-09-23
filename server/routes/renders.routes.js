const { Router } = require("express");

const helpers = require("../handlers/helpers.handler");
const renders = require("../handlers/renders.handler");
const asyncHandler = require("../utils/asyncHandler");
const locals = require("../handlers/locals.handler");
const auth = require("../handlers/auth.handler");
const env = require("../env");

const router = Router();
const domainGrants = require("../handlers/domain-grants.handler");
router.get(["/settings/domain-sharing", "/settings/domain-sharing/:id"], require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), domainGrants.boundary, asyncHandler((req, res) => domainGrants.page(req, res)));
router.post("/settings/domain-sharing/:id", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), domainGrants.boundary,
  helpers.rateLimit({ window: 60, limit: 30, always: true, key: "domain-grants" }), asyncHandler(domainGrants.submit));
router.get("/settings/domain-sharing/:id/revoke/:grantId", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), domainGrants.boundary, asyncHandler((req, res) => domainGrants.confirmPage(req, res)));
router.post("/settings/domain-sharing/:id/revoke/:grantId", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), domainGrants.boundary,
  helpers.rateLimit({ window: 60, limit: 30, always: true, key: "domain-grants" }), asyncHandler(domainGrants.confirmRevoke));
router.use("/settings/domain-sharing", domainGrants.pageError);
const destinationHealth = require("../handlers/link-health.handler");
router.get("/link/health/:id", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), destinationHealth.boundary, asyncHandler(destinationHealth.page));
router.get("/settings/health", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), destinationHealth.boundary, asyncHandler(destinationHealth.dashboard));
router.use(["/link/health", "/settings/health"], (error, req, res, next) => { res.status(error.statusCode || 500); next(error); });
const privacy = require("../handlers/privacy.handler");
router.get("/settings/destination-policy", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), privacy.boundary,
  require("../handlers/destination-policy.handler").page);
router.use("/settings/destination-policy", (error, req, res, next) => { res.status(error.statusCode || 500); next(error); });
router.get("/settings/shortcuts", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), privacy.boundary,
  require("../handlers/shortcuts.handler").page);
router.use("/settings/shortcuts", (error, req, res, next) => { res.status(error.statusCode || 500); next(error); });
router.get("/settings/integrations", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), privacy.boundary,
  asyncHandler(require("../handlers/webhooks.handler").page));
router.use("/settings/integrations", (error, req, res, next) => { res.status(error.statusCode || 500); next(error); });
router.get("/link/tracking/:id", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), privacy.boundary, asyncHandler(privacy.trackingPage));
router.use("/link/tracking/:id", (error, req, res, next) => { res.status(error.statusCode || 500); next(error); });
router.get("/settings/retention", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), privacy.boundary, asyncHandler(privacy.retentionPage));
router.use("/settings/retention", (error, req, res, next) => { res.status(error.statusCode || 500); next(error); });
router.get("/settings/analytics", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), require("../handlers/analytics.handler").boundary,
  asyncHandler(require("../handlers/analytics.handler").page));
router.use("/settings/analytics", (error, req, res, next) => { res.status(error.statusCode || 500); next(error); });
router.get("/link/routing/:id", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), require("../handlers/routing.handler").boundary,
  asyncHandler(require("../handlers/routing.handler").page));
router.get("/link/forwarding/:id", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), require("../handlers/forwarding.handler").boundary,
  asyncHandler(require("../handlers/forwarding.handler").page));
router.use("/link/forwarding", (error, req, res, next) => { res.status(error.statusCode || 500); next(error); });
router.use("/link/routing", (error, req, res, next) => { res.status(error.statusCode || 500); next(error); });

router.get(["/settings/workspaces", "/settings/workspaces/:id"], require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), require("../handlers/workspaces.handler").boundary,
  asyncHandler((req, res) => require("../handlers/workspaces.handler").page(req, res)));
router.post(["/settings/workspaces", "/settings/workspaces/:id"], require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), require("../handlers/workspaces.handler").boundary,
  helpers.rateLimit({ window: 60, limit: 60 }), asyncHandler(require("../handlers/workspaces.handler").submit));
router.use("/settings/workspaces", (error, req, res, next) => {
  res.status(error.statusCode || 500);
  next(error);
});

router.get("/link/qr/:id", require("../handlers/tokens.handler").sessionOnly,
  asyncHandler(auth.jwtPage), asyncHandler(locals.user), asyncHandler(require("../handlers/qr.handler").page));

router.get("/settings/transfer", require("../handlers/tokens.handler").sessionOnly, asyncHandler(auth.jwtPage), asyncHandler(locals.user),
  asyncHandler(require("../handlers/transfer.handler").page));

router.get("/settings/library", require("../handlers/tokens.handler").sessionOnly, asyncHandler(auth.jwtPage), asyncHandler(locals.user),
  asyncHandler((req, res) => require("../handlers/library.handler").page(req, res)));
router.post("/settings/library", require("../handlers/tokens.handler").sessionOnly, asyncHandler(auth.jwtPage), asyncHandler(locals.user),
  asyncHandler(require("../handlers/library.handler").submit));
router.use("/settings/library", (error, req, res, next) => {
  res.status(error.statusCode || 500);
  next(error);
});

router.get("/settings/security", asyncHandler(auth.jwtPage), asyncHandler(locals.user),
  asyncHandler(require("../handlers/security.handler").status));

router.get("/settings/trash", asyncHandler(auth.jwtPage), asyncHandler(locals.user),
  asyncHandler(require("../handlers/link-history.handler").trash));
router.get("/link/history/:id", asyncHandler(auth.jwtPage), asyncHandler(locals.user),
  asyncHandler(require("../handlers/link-history.handler").list));

// pages
router.get(
  "/",
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(helpers.adminSetup),
  asyncHandler(locals.user), 
  asyncHandler(renders.homepage)
);

router.get(
  "/login", 
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(helpers.adminSetup),
  asyncHandler(renders.login)
);

router.get(
  "/login/oidc", 
  locals.viewTemplate("login"),
  auth.featureAccess([env.OIDC_ENABLED]),
  asyncHandler(require("../passport").prepareOIDC),
  asyncHandler(auth.oidc),
  asyncHandler(auth.login)
);

router.get(
  "/logout", 
  asyncHandler(renders.logout)
);

router.get(
  "/create-admin", 
  asyncHandler(renders.createAdmin)
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
  "/admin",
  asyncHandler(auth.jwtPage),
  asyncHandler(auth.admin),
  asyncHandler(locals.user),
  asyncHandler(renders.admin)
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
  auth.featureAccessPage([env.MAIL_ENABLED]),
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.resetPassword)
);

router.get(
  "/reset-password/:resetPasswordToken",
  asyncHandler(auth.jwtLoosePage),
  asyncHandler(locals.user),
  asyncHandler(renders.resetPasswordSetNewPassword)
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
  "/confirm-user-delete", 
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.confirmUserDelete)
);

router.get(
  "/confirm-user-ban", 
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.confirmUserBan)
);

router.get(
  "/create-user", 
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.createUser)
);

router.get(
  "/add-domain", 
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.addDomainAdmin)
);


router.get(
  "/confirm-domain-ban", 
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.confirmDomainBan)
);


router.get(
  "/confirm-domain-delete-admin", 
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.confirmDomainDeleteAdmin)
);

router.get(
  "/link/edit/:id",
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(renders.linkEdit)
);

router.get(
  "/admin/link/edit/:id",
  locals.noLayout,
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin), 
  asyncHandler(renders.linkEditAdmin)
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
