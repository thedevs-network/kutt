const env = require("./env");

const cookieParser = require("cookie-parser");
const passport = require("passport");
const express = require("express");
const session = require("cookie-session");
const helmet = require("helmet");
const path = require("node:path");
const hbs = require("hbs");

const helpers = require("./handlers/helpers.handler");
const renders = require("./handlers/renders.handler");
const asyncHandler = require("./utils/asyncHandler");
const locals = require("./handlers/locals.handler");
const links = require("./handlers/links.handler");
const routes = require("./routes");
const utils = require("./utils");
const i18n = require("./i18n");
const csp = require("./csp");


// run the cron jobs
// the app might be running in cluster mode (multiple instances) so run the cron job only on one cluster (the first one)
// NODE_APP_INSTANCE variable is added by pm2 automatically, if you're using something else to cluster your app, then make sure to set this variable
if (env.NODE_APP_INSTANCE === 0) {
  require("./cron");
}

// intialize passport authentication library
require("./passport");

// create express app
const app = express();
const metrics = require("./metrics").create(env);
app.use(metrics.middleware);

app.set("trust proxy", env.TRUST_PROXY);

app.use(helmet({ contentSecurityPolicy: false }));
const management = require("./management-origin");
app.use(management.boundary);
app.use(cookieParser());
app.use(i18n.middleware);
app.use(csp.middleware(env.CSP_MODE));
// Do not send ephemeral logo payloads to the global body-parser error logger.
const qrJSON = express.json();
app.use(/^\/api\/(?:v2\/)?links\/[^/]+\/qr\/?$/i, (req, res, next) => {
  if (req.method !== "POST") return next();
  res.set("Cache-Control", "private, no-store");
  if (!req.is("application/json")) return res.status(400).json({ error: i18n.t("qr.json_required") });
  qrJSON(req, res, error => {
    if (!error) return next();
    res.status(error.status === 413 ? 413 : 400).json({ error: i18n.t("qr.invalid_json") });
  });
});
// Bounded transfer payloads only; retain default limits on every other route.
app.use(/^\/api\/(?:v2\/)?transfer\/(?:preview|commit)\/?$/i, express.json({ limit: "1mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// use cookie sessions only when OIDC is enabled
// because only OIDC is using it
if (env.OIDC_ENABLED) {
  const oidcSession = session({
    keys: [env.JWT_SECRET],
    maxAge: 1000 * 60 * 60 * 24 * 7, // expire after seven days
    ...(management.configured() && { secure: management.secureCookie(), sameSite: "lax", httpOnly: true, path: "/" })
  });
  app.use((req, res, next) => req.publicHost ? next() : oidcSession(req, res, next));
}

// serve static
app.use("/images", express.static(path.join(__dirname, "../custom/images")));
app.use("/css", express.static(path.join(__dirname, "../custom/css"), { extensions: ["css"] }));
app.use(express.static(path.join(__dirname, "../static")));

app.use(passport.initialize());
app.use(locals.isHTML);
app.use(locals.config);

// template engine / serve html

app.set("view engine", "hbs");
app.set("views", [
  path.join(__dirname, "../custom/views"),
  path.join(__dirname, "views"),
]);
const templatesReady = utils.registerHandlebarsHelpers();
i18n.register(hbs);
csp.register(hbs);
i18n.assets(app, env.SITE_NAME);
app.post("/language", i18n.change);

// if is custom domain, redirect to the set homepage
app.use(asyncHandler(links.redirectCustomDomainHomepage));

// render html pages
app.use("/", routes.render);

// handle api requests
app.use("/api/v2", routes.api);
app.use("/api", routes.api);

// finally, redirect the short link to the target
app.get("/:id(*)", asyncHandler(links.redirect));

// 404 pages that don't exist
app.get("*", renders.notFound);

// handle errors coming from above routes
app.use(helpers.error);
  
templatesReady.then(() => management.validateDatabase()).then(() => require("./oidc-roles").initialize()).then(() => metrics.start()).then(() => {
  app.listen(env.PORT, () => {
    console.log(`> Ready on http://localhost:${env.PORT}`);
  });
}).catch(() => {
  console.error("Application initialization failed. Check templates, management origin, private metrics configuration and, when configured, the protected local OIDC recovery administrator.");
  process.exit(1);
});
