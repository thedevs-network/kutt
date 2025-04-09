const env = require("./env");

const cookieParser = require("cookie-parser");
const passport = require("passport");
const express = require("express");
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

if (env.NODE_APP_INSTANCE === 0) {
  require("./cron");
}

require("./passport");

const app = express();

if (env.TRUST_PROXY) {
  app.set("trust proxy", true);
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      sandbox: ["allow-forms", "allow-scripts", "allow-same-origin"],
      reportUri: "/api/report-violation",
      workerSrc: ["'self'", "blob:"],
      childSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      manifestSrc: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/images", express.static("custom/images"));
app.use("/css", express.static("custom/css", { extensions: ["css"] }));
app.use(express.static("static"));

app.use(passport.initialize());
app.use(locals.isHTML);
app.use(locals.config);

app.set("view engine", "hbs");
app.set("views", [
  path.join(__dirname, "../custom/views"),
  path.join(__dirname, "views"),
]);
utils.registerHandlebarsHelpers();

app.use(asyncHandler(links.redirectCustomDomainHomepage));

app.use("/", routes.render);

app.use("/api/v2", routes.api);
app.use("/api", routes.api);

app.get("/:id", asyncHandler(links.redirect));

app.get("*", renders.notFound);

app.use(helpers.error);
  
app.listen(env.PORT, () => {
  console.log(`> Ready on http://localhost:${env.PORT}`);
});
