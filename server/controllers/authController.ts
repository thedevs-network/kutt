import { Handler } from "express";
import fs from "fs";
import path from "path";
import passport from "passport";
import JWT from "jsonwebtoken";
import axios from "axios";
import { addDays } from "date-fns";

import { isAdmin } from "../utils";
import transporter from "../mail/mail";
import { resetMailText, verifyMailText } from "../mail/text";
import {
  createUser,
  changePassword,
  generateApiKey,
  getUser,
  verifyUser,
  requestPasswordReset,
  resetPassword
} from "../db/user";

/* Read email template */
const resetEmailTemplatePath = path.join(
  __dirname,
  "../mail/template-reset.html"
);
const verifyEmailTemplatePath = path.join(
  __dirname,
  "../mail/template-verify.html"
);
const resetEmailTemplate = fs
  .readFileSync(resetEmailTemplatePath, { encoding: "utf-8" })
  .replace(/{{domain}}/gm, process.env.DEFAULT_DOMAIN);
const verifyEmailTemplate = fs
  .readFileSync(verifyEmailTemplatePath, { encoding: "utf-8" })
  .replace(/{{domain}}/gm, process.env.DEFAULT_DOMAIN);

/* Function to generate JWT */
const signToken = (user: UserJoined) =>
  JWT.sign(
    {
      iss: "ApiAuth",
      sub: user.email,
      domain: user.domain || "",
      admin: isAdmin(user.email),
      iat: parseInt((new Date().getTime() / 1000).toFixed(0)),
      exp: parseInt((addDays(new Date(), 7).getTime() / 1000).toFixed(0))
    } as Record<string, any>,
    process.env.JWT_SECRET
  );

/* Passport.js authentication controller */
const authenticate = (
  type: "jwt" | "local" | "localapikey",
  error: string,
  isStrict = true
) =>
  function auth(req, res, next) {
    if (req.user) return next();
    return passport.authenticate(type, (err, user) => {
      if (err) return res.status(400);
      if (!user && isStrict) return res.status(401).json({ error });
      if (user && isStrict && !user.verified) {
        return res.status(400).json({
          error:
            "Your email address is not verified. " +
            "Click on signup to get the verification link again."
        });
      }
      if (user && user.banned) {
        return res
          .status(403)
          .json({ error: "Your are banned from using this website." });
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

export const authLocal = authenticate("local", "Login credentials are wrong.");
export const authJwt = authenticate("jwt", "Unauthorized.");
export const authJwtLoose = authenticate("jwt", "Unauthorized.", false);
export const authApikey = authenticate(
  "localapikey",
  "API key is not correct.",
  false
);

/* reCaptcha controller */
export const recaptcha: Handler = async (req, res, next) => {
  if (process.env.NODE_ENV === "production" && !req.user) {
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
      return res
        .status(401)
        .json({ error: "reCAPTCHA is not valid. Try again." });
    }
  }
  return next();
};

export const authAdmin: Handler = async (req, res, next) => {
  if (!req.user.admin) {
    return res.status(401).json({ error: "Unauthorized." });
  }
  return next();
};

export const signup: Handler = async (req, res) => {
  const { email, password } = req.body;

  if (password.length > 64) {
    return res.status(400).json({ error: "Maximum password length is 64." });
  }

  if (email.length > 255) {
    return res.status(400).json({ error: "Maximum email length is 255." });
  }
  const user = await getUser(email);

  if (user && user.verified) {
    return res.status(403).json({ error: "Email is already in use." });
  }

  const newUser = await createUser(email, password, user);

  const mail = await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to: newUser.email,
    subject: "Verify your account",
    text: verifyMailText.replace(
      /{{verification}}/gim,
      newUser.verification_token
    ),
    html: verifyEmailTemplate.replace(
      /{{verification}}/gim,
      newUser.verification_token
    )
  });

  if (mail.accepted.length) {
    return res
      .status(201)
      .json({ email, message: "Verification email has been sent." });
  }

  return res
    .status(400)
    .json({ error: "Couldn't send verification email. Try again." });
};

export const login: Handler = (req, res) => {
  const token = signToken(req.user);
  return res.status(200).json({ token });
};

export const renew: Handler = (req, res) => {
  const token = signToken(req.user);
  return res.status(200).json({ token });
};

export const verify: Handler = async (req, _res, next) => {
  const { verificationToken } = req.params;
  if (!verificationToken) return next();

  const user = await verifyUser(req.params.verificationToken);
  if (user) {
    const token = signToken(user);
    req.token = token;
  }

  return next();
};

export const changeUserPassword: Handler = async (req, res) => {
  if (req.body.password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 chars long." });
  }

  if (req.body.password.length > 64) {
    return res.status(400).json({ error: "Maximum password length is 64." });
  }

  const changedUser = await changePassword(req.user.id, req.body.password);

  if (changedUser) {
    return res
      .status(200)
      .json({ message: "Your password has been changed successfully." });
  }

  return res
    .status(400)
    .json({ error: "Couldn't change the password. Try again later" });
};

export const generateUserApiKey = async (req, res) => {
  const apikey = await generateApiKey(req.user.id);

  if (apikey) {
    return res.status(201).json({ apikey });
  }

  return res
    .status(400)
    .json({ error: "Sorry, an error occured. Please try again later." });
};

export const userSettings: Handler = (req, res) =>
  res.status(200).json({
    apikey: req.user.apikey || "",
    customDomain: req.user.domain || "",
    homepage: req.user.homepage || ""
  });

export const requestUserPasswordReset: Handler = async (req, res) => {
  const user = await requestPasswordReset(req.body.email);

  if (!user) {
    return res.status(400).json({ error: "Couldn't reset password." });
  }

  const mail = await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: user.email,
    subject: "Reset your password",
    text: resetMailText
      .replace(/{{resetpassword}}/gm, user.reset_password_token)
      .replace(/{{domain}}/gm, process.env.DEFAULT_DOMAIN),
    html: resetEmailTemplate
      .replace(/{{resetpassword}}/gm, user.reset_password_token)
      .replace(/{{domain}}/gm, process.env.DEFAULT_DOMAIN)
  });

  if (mail.accepted.length) {
    return res.status(200).json({
      email: user.email,
      message: "Reset password email has been sent."
    });
  }

  return res.status(400).json({ error: "Couldn't reset password." });
};

export const resetUserPassword: Handler = async (req, _res, next) => {
  const { resetPasswordToken } = req.params;
  if (resetPasswordToken) {
    const user: UserJoined = await resetPassword(resetPasswordToken);
    if (user) {
      const token = signToken(user as UserJoined);
      req.token = token;
    }
  }
  return next();
};
