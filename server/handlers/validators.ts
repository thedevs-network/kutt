import { body, validationResult } from "express-validator";
import urlRegex from "url-regex";
import URL from "url";

import { findDomain } from "../queries/domain";
import { CustomError } from "../utils";

export const verify = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const message = errors.array()[0].msg;
    throw new CustomError(message, 400);
  }
  return next();
};

export const preservedUrls = [
  "login",
  "logout",
  "signup",
  "reset-password",
  "resetpassword",
  "url-password",
  "url-info",
  "settings",
  "stats",
  "verify",
  "api",
  "404",
  "static",
  "images",
  "banned",
  "terms",
  "privacy",
  "report",
  "pricing"
];

export const createLink = [
  body("target")
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("Target is missing.")
    .isLength({ min: 1, max: 2040 })
    .withMessage("Maximum URL length is 2040.")
    .custom(
      value =>
        urlRegex({ exact: true, strict: false }).test(value) ||
        /^(?!https?)(\w+):\/\//.test(value)
    )
    .withMessage("URL is not valid.")
    .custom(value => URL.parse(value).host !== process.env.DEFAULT_DOMAIN)
    .withMessage(`${process.env.DEFAULT_DOMAIN} URLs are not allowed.`),
  body("password")
    .optional()
    .isLength({ min: 3, max: 64 })
    .withMessage("Password length must be between 3 and 64."),
  body("customurl")
    .optional()
    .isLength({ min: 1, max: 64 })
    .withMessage("Custom URL length must be between 1 and 64.")
    .custom(value => /^[a-zA-Z0-9-_]+$/g.test(value))
    .withMessage("Custom URL is not valid")
    .custom(value => preservedUrls.some(url => url.toLowerCase() === value))
    .withMessage("You can't use this custom URL."),
  body("reuse")
    .optional()
    .isBoolean()
    .withMessage("Reuse must be boolean."),
  body("domain")
    .optional()
    .isString()
    .withMessage("Domain should be string.")
    .custom(async (address, { req }) => {
      const domain = await findDomain({
        address,
        userId: req.user && req.user.id
      });
      req.body.domain = domain || null;

      if (domain) return true;

      throw new CustomError("You can't use this domain.", 400);
    })
];
