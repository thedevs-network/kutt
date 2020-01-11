import "./configToEnv";

import dotenv from "dotenv";
dotenv.config();

import nextApp from "next";
import express, { Request, Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import Raven from "raven";
import cookieParser from "cookie-parser";
import passport from "passport";
import cors from "cors";

import {
  validateBody,
  validationCriterias,
  validateUrl,
  ipCooldownCheck
} from "./controllers/validateBodyController";
import * as auth from "./controllers/authController";
import * as link from "./controllers/linkController";
import { initializeDb } from "./knex";
import routes from "./routes";

import "./cron";
import "./passport";
import { CustomError } from "./utils";

if (process.env.RAVEN_DSN) {
  Raven.config(process.env.RAVEN_DSN).install();
}

const catchErrors = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = nextApp({ dir: "./client", dev });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  await initializeDb();

  const server = express();

  server.set("trust proxy", true);

  if (process.env.NODE_ENV !== "production") {
    server.use(morgan("dev"));
  }

  server.use(helmet());
  server.use(cookieParser());
  server.use(express.json());
  server.use(express.urlencoded({ extended: true }));
  server.use(passport.initialize());
  server.use(express.static("static"));

  server.use((req, _res, next) => {
    req.realIP =
      (req.headers["x-real-ip"] as string) ||
      req.connection.remoteAddress ||
      "";
    return next();
  });

  server.use(link.customDomainRedirection);

  server.use(routes);

  server.get("/", (req, res) => app.render(req, res, "/"));
  server.get("/login", (req, res) => app.render(req, res, "/login"));
  server.get("/logout", (req, res) => app.render(req, res, "/logout"));
  server.get("/settings", (req, res) => app.render(req, res, "/settings"));
  server.get("/stats", (req, res) => app.render(req, res, "/stats", req.query));
  server.get("/terms", (req, res) => app.render(req, res, "/terms"));
  server.get("/report", (req, res) => app.render(req, res, "/report"));
  server.get("/banned", (req, res) => app.render(req, res, "/banned"));

  /* View routes */
  server.get(
    "/reset-password/:resetPasswordToken?",
    catchErrors(auth.resetUserPassword),
    (req, res) => app.render(req, res, "/reset-password", { token: req.token })
  );
  server.get(
    "/verify/:verificationToken?",
    catchErrors(auth.verify),
    (req, res) => app.render(req, res, "/verify", { token: req.token })
  );

  /* User and authentication */
  server.post(
    "/api/auth/signup",
    validationCriterias,
    catchErrors(validateBody),
    catchErrors(auth.signup)
  );
  server.post(
    "/api/auth/login",
    validationCriterias,
    catchErrors(validateBody),
    catchErrors(auth.authLocal),
    catchErrors(auth.login)
  );
  server.post(
    "/api/auth/renew",
    catchErrors(auth.authJwt),
    catchErrors(auth.renew)
  );
  server.post(
    "/api/auth/changepassword",
    catchErrors(auth.authJwt),
    catchErrors(auth.changeUserPassword)
  );
  server.post(
    "/api/auth/generateapikey",
    catchErrors(auth.authJwt),
    catchErrors(auth.generateUserApiKey)
  );
  server.post(
    "/api/auth/resetpassword",
    catchErrors(auth.requestUserPasswordReset)
  );
  server.get(
    "/api/auth/usersettings",
    catchErrors(auth.authJwt),
    catchErrors(auth.userSettings)
  );

  /* URL shortener */
  server.post(
    "/api/url/submit",
    cors(),
    catchErrors(auth.authApikey),
    catchErrors(auth.authJwtLoose),
    catchErrors(auth.recaptcha),
    catchErrors(validateUrl),
    catchErrors(ipCooldownCheck),
    catchErrors(link.shortener)
  );
  server.post(
    "/api/url/deleteurl",
    catchErrors(auth.authApikey),
    catchErrors(auth.authJwt),
    catchErrors(link.deleteUserLink)
  );
  server.get(
    "/api/url/geturls",
    catchErrors(auth.authApikey),
    catchErrors(auth.authJwt),
    catchErrors(link.getUserLinks)
  );
  server.post(
    "/api/url/customdomain",
    catchErrors(auth.authJwt),
    catchErrors(link.setCustomDomain)
  );
  server.delete(
    "/api/url/customdomain",
    catchErrors(auth.authJwt),
    catchErrors(link.deleteCustomDomain)
  );
  server.get(
    "/api/url/stats",
    catchErrors(auth.authApikey),
    catchErrors(auth.authJwt),
    catchErrors(link.getLinkStats)
  );
  server.post("/api/url/requesturl", catchErrors(link.goToLink));
  server.post("/api/url/report", catchErrors(link.reportLink));
  server.post(
    "/api/url/admin/ban",
    catchErrors(auth.authApikey),
    catchErrors(auth.authJwt),
    catchErrors(auth.authAdmin),
    catchErrors(link.ban)
  );
  server.get(
    "/:id",
    catchErrors(link.goToLink),
    (req: Request, res: Response) => {
      switch (req.pageType) {
        case "password":
          return app.render(req, res, "/url-password", {
            protectedLink: req.protectedLink
          });
        case "info":
        default:
          return app.render(req, res, "/url-info", {
            linkTarget: req.linkTarget
          });
      }
    }
  );

  server.get("*", (req, res) => handle(req, res));

  server.use((error, req, res, next) => {
    if (error instanceof CustomError) {
      return res.status(error.statusCode || 500).json({ error: error.message });
    }

    if (process.env.RAVEN_DSN) {
      Raven.captureException(error, {
        user: { email: req.user && req.user.email }
      });
    }

    return res.status(500).json({ error: "An error occurred." });
  });

  server.listen(port, err => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
