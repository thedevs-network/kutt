const env = require("./env");

const cookieParser = require("cookie-parser");
const passport = require("passport");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const hbs = require("hbs");

const helpers = require("./handlers/helpers.handler");
const asyncHandler = require("./utils/asyncHandler");
const locals = require("./handlers/locals.handler");
const links = require("./handlers/links.handler");
const { stream } = require("./config/winston");
const routes = require("./routes");
const utils = require("./utils");

require("./cron");
require("./passport");

// create express app
const app = express();

// TODO: comments
app.set("trust proxy", true);

if (env.isDev) {
  app.use(morgan("combined", { stream }));
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("static"));

app.use(passport.initialize());
// app.use(helpers.ip);
app.use(locals.isHTML);
app.use(locals.addConfigLocals);

// template engine / serve html
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
utils.registerHandlebarsHelpers();

app.use("/", routes.render);

// if is custom domain, redirect to the set homepage
app.use(asyncHandler(links.redirectCustomDomainHomepage));

app.use("/api/v2", routes.api);
app.use("/api", routes.api);

// finally, redirect the short link to the target
app.get("/:id", asyncHandler(links.redirect));

// Error handler
app.use(helpers.error);
  
app.listen(env.PORT, () => {
  console.log(`> Ready on http://localhost:${env.PORT}`);
});
