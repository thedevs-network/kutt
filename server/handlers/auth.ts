import { differenceInMinutes, subMinutes } from "date-fns";
import { Handler } from "express";
import passport from "passport";
import axios from "axios";

import { isAdmin, CustomError } from "../utils";
import knex from "../knex";

const authenticate = (
  type: "jwt" | "local" | "localapikey",
  error: string,
  isStrict = true
) =>
  async function auth(req, res, next) {
    if (req.user) return next();

    return passport.authenticate(type, (err, user) => {
      if (err) {
        throw new CustomError("An error occurred");
      }

      if (!user && isStrict) {
        throw new CustomError(error, 401);
      }

      if (user && isStrict && !user.verified) {
        throw new CustomError(
          "Your email address is not verified. " +
            "Click on signup to get the verification link again.",
          400
        );
      }

      if (user && user.banned) {
        throw new CustomError("Your are banned from using this website.", 403);
      }

      if (user) {
        req.user = {
          ...user,
          admin: isAdmin(user.email)
        };
        return next();
      }
      return next();
    })(req, res, next);
  };

export const local = authenticate("local", "Login credentials are wrong.");
export const jwt = authenticate("jwt", "Unauthorized.");
export const jwtLoose = authenticate("jwt", "Unauthorized.", false);
export const apikey = authenticate(
  "localapikey",
  "API key is not correct.",
  false
);

export const cooldown: Handler = async (req, res, next) => {
  const cooldownConfig = Number(process.env.NON_USER_COOLDOWN);
  if (req.user || !cooldownConfig) return next();

  const ip = await knex<IP>("ips")
    .where({ ip: req.realIP.toLowerCase() })
    .andWhere(
      "created_at",
      ">",
      subMinutes(new Date(), cooldownConfig).toISOString()
    )
    .first();

  if (ip) {
    const timeToWait =
      cooldownConfig - differenceInMinutes(new Date(), new Date(ip.created_at));
    throw new CustomError(
      `Non-logged in users are limited. Wait ${timeToWait} minutes or log in.`,
      400
    );
  }
  next();
};

export const recaptcha: Handler = async (req, res, next) => {
  if (process.env.NODE_ENV !== "production") return next();
  if (!req.user) return next();

  const isReCaptchaValid = await axios({
    method: "post",
    url: "https://www.google.com/recaptcha/api/siteverify",
    headers: {
      "Content-type": "application/x-www-form-urlencoded"
    },
    params: {
      secret: process.env.RECAPTCHA_SECRET_KEY,
      response: req.body.reCaptchaToken,
      remoteip: req.realIP
    }
  });

  if (!isReCaptchaValid.data.success) {
    throw new CustomError("reCAPTCHA is not valid. Try again.", 401);
  }

  return next();
};
