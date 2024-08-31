const env = require("./env");

// import asyncHandler from "express-async-handler";
// import passport from "passport";
const cookieParser = require("cookie-parser");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");
const hbs = require("hbs");

const helpers = require("./handlers/helpers.handler");
// import * as links from "./handlers/links";
// import * as auth from "./handlers/auth";
const routes = require("./routes");
const renders = require("./renders");
const utils = require("./utils");
const { stream } = require("./config/winston")

// import "./cron";
require("./passport");

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

// app.use(passport.initialize());
// app.use(helpers.ip);
app.use(helpers.isHTML);
app.use(helpers.addConfigLocals);

// template engine / serve html
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
utils.registerHandlebarsHelpers();

app.use("/", renders);

// app.use(asyncHandler(links.redirectCustomDomain));

app.use("/api/v2", routes);
app.use("/api", routes);

  // server.get(
  //   "/reset-password/:resetPasswordToken?",
  //   asyncHandler(auth.resetPassword),
  //   (req, res) => app.render(req, res, "/reset-password", { token: req.token })
  // );

  // server.get(
  //   "/verify-email/:changeEmailToken",
  //   asyncHandler(auth.changeEmail),
  //   (req, res) => app.render(req, res, "/verify-email", { token: req.token })
  // );

  // server.get(
  //   "/verify/:verificationToken?",
  //   asyncHandler(auth.verify),
  //   (req, res) => app.render(req, res, "/verify", { token: req.token })
  // );

  // server.get("/:id", asyncHandler(links.redirect(app)));

// Error handler
app.use(helpers.error);

  // Handler everything else by Next.js
  // server.get("*", (req, res) => handle(req, res));
  
app.listen(env.PORT, () => {
  console.log(`> Ready on http://localhost:${env.PORT}`);
});
