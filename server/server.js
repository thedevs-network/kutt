const env = require("./env");

const cookieParser = require("cookie-parser");
const passport = require("passport");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const hbs = require("hbs");

const helpers = require("./handlers/helpers.handler");
const renders = require("./handlers/renders.handler");
const asyncHandler = require("./utils/asyncHandler");
const locals = require("./handlers/locals.handler");
const links = require("./handlers/links.handler");
const routes = require("./routes");
const utils = require("./utils");

require("./cron");
require("./passport");

// create express app
const app = express();

// this tells the express app that the app is running behind a proxy server
// and thus it should get the IP address from the proxy server
// IMPORTANT: users might be able to override their IP address and this
// might allow users to bypass the rate limit or lead to incorrect link stats
// read the Kutt documentation to learn how prevent users from changing their real IP address
app.set("trust proxy", true);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("static"));

app.use(passport.initialize());
app.use(locals.isHTML);
app.use(locals.config);

// template engine / serve html
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
utils.registerHandlebarsHelpers();

// render html pages
app.use("/", routes.render);

// if is custom domain, redirect to the set homepage
app.use(asyncHandler(links.redirectCustomDomainHomepage));

// handle api requests
app.use("/api/v2", routes.api);
app.use("/api", routes.api);

// finally, redirect the short link to the target
app.get("/:id", asyncHandler(links.redirect));

// 404 pages that don't exist
app.get("*", renders.notFound);

// handle errors coming from above routes
app.use(helpers.error);
  
app.listen(env.PORT, () => {
  console.log(`> Ready on http://localhost:${env.PORT}`);
});
