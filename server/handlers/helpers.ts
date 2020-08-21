import { Handler, ErrorRequestHandler } from "express";
import { validationResult } from "express-validator";
import * as Sentry from "@sentry/node";
import signale from "signale";

import { CustomError } from "../utils";
import env from "../env";

export const ip: Handler = (req, res, next) => {
  req.realIP =
    (req.headers["x-real-ip"] as string) || req.connection.remoteAddress || "";
  return next();
};

export const error: ErrorRequestHandler = (error, req, res, next) => {
  if (env.isDev) {
    signale.fatal(error);
  }

  if (error instanceof CustomError) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }

  if (env.SENTRY_PRIVATE_DSN) {
    Sentry.captureException(error);
  }

  return res.status(500).json({ error: "An error occurred." });
};

export const verify = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array()[0].msg;
    throw new CustomError(message, 400);
  }
  return next();
};

export const query: Handler = (req, res, next) => {
  const { limit, skip, all } = req.query;
  const { admin } = req.user || {};

  req.query.limit = parseInt(limit) || 10;
  req.query.skip = parseInt(skip) || 0;

  if (req.query.limit > 50) {
    req.query.limit = 50;
  }

  req.query.all = admin ? all === "true" : false;

  next();
};
