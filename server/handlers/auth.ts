import { differenceInMinutes, addMinutes, subMinutes } from "date-fns";
import { Handler } from "express";
import passport from "passport";
import bcrypt from "bcryptjs";
import nanoid from "nanoid";
import uuid from "uuid/v4";
import axios from "axios";

import { CustomError } from "../utils";
import * as utils from "../utils";
import * as mail from "../mail";
import query from "../queries";
import knex from "../knex";
import env from "../env";

const authenticate = (
  type: "jwt" | "local" | "localapikey",
  error: string,
  isStrict = true
) =>
  async function auth(req, res, next) {
    if (req.user) return next();

    passport.authenticate(type, (err, user) => {
      if (err) return next(err);

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
          admin: utils.isAdmin(user.email)
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
  const cooldownConfig = env.NON_USER_COOLDOWN;
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
  if (env.isDev || req.user) return next();

  const isReCaptchaValid = await axios({
    method: "post",
    url: "https://www.google.com/recaptcha/api/siteverify",
    headers: {
      "Content-type": "application/x-www-form-urlencoded"
    },
    params: {
      secret: env.RECAPTCHA_SECRET_KEY,
      response: req.body.reCaptchaToken,
      remoteip: req.realIP
    }
  });

  if (!isReCaptchaValid.data.success) {
    throw new CustomError("reCAPTCHA is not valid. Try again.", 401);
  }

  return next();
};

export const admin: Handler = async (req, res, next) => {
  if (req.user.admin) return next();
  throw new CustomError("Unauthorized", 401);
};

export const signup: Handler = async (req, res) => {
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(req.body.password, salt);

  const user = await query.user.add(
    { email: req.body.email, password },
    req.user
  );

  await mail.verification(user);

  return res.status(201).send({ message: "Verification email has been sent." });
};

export const token: Handler = async (req, res) => {
  const token = utils.signToken(req.user);
  return res.status(200).send({ token });
};

export const verify: Handler = async (req, res, next) => {
  if (!req.params.verificationToken) return next();

  const [user] = await query.user.update(
    {
      verification_token: req.params.verificationToken,
      verification_expires: [">", new Date().toISOString()]
    },
    {
      verified: true,
      verification_token: null,
      verification_expires: null
    }
  );

  if (user) {
    const token = utils.signToken(user);
    req.token = token;
  }

  return next();
};

export const changePassword: Handler = async (req, res) => {
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(req.body.password, salt);

  const [user] = await query.user.update({ id: req.user.id }, { password });

  if (!user) {
    throw new CustomError("Couldn't change the password. Try again later.");
  }

  return res
    .status(200)
    .send({ message: "Your password has been changed successfully." });
};

export const generateApiKey = async (req, res) => {
  const apikey = nanoid(40);

  const [user] = await query.user.update({ id: req.user.id }, { apikey });

  if (!user) {
    throw new CustomError("Couldn't generate API key. Please try again later.");
  }

  return res.status(201).send({ apikey });
};

export const resetPasswordRequest = async (req, res) => {
  const [user] = await query.user.update(
    { email: req.body.email },
    {
      reset_password_token: uuid(),
      reset_password_expires: addMinutes(new Date(), 30).toISOString()
    }
  );

  if (user) {
    await mail.resetPasswordToken(user);
  }

  return res.status(200).json({
    error: "If email address exists, a reset password email has been sent."
  });
};

export const resetPassword = async (req, res, next) => {
  const { resetPasswordToken } = req.params;

  if (resetPasswordToken) {
    const [user] = await query.user.update(
      {
        reset_password_token: resetPasswordToken,
        reset_password_expires: [">", new Date().toISOString()]
      },
      { reset_password_expires: null, reset_password_token: null }
    );

    if (user) {
      const token = utils.signToken(user as UserJoined);
      req.token = token;
    }
  }
  return next();
};
