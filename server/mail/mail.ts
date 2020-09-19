import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

import { resetMailText, verifyMailText, changeEmailText } from "./text";
import { CustomError } from "../utils";
import env from "../env";

const mailConfig = {
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_SECURE,
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASSWORD
  }
};

const transporter = nodemailer.createTransport(mailConfig);

export default transporter;

// Read email templates
const resetEmailTemplatePath = path.join(__dirname, "template-reset.html");
const verifyEmailTemplatePath = path.join(__dirname, "template-verify.html");
const changeEmailTemplatePath = path.join(
  __dirname,
  "template-change-email.html"
);
const resetEmailTemplate = fs
  .readFileSync(resetEmailTemplatePath, { encoding: "utf-8" })
  .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN)
  .replace(/{{site_name}}/gm, env.SITE_NAME);
const verifyEmailTemplate = fs
  .readFileSync(verifyEmailTemplatePath, { encoding: "utf-8" })
  .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN)
  .replace(/{{site_name}}/gm, env.SITE_NAME);
const changeEmailTemplate = fs
  .readFileSync(changeEmailTemplatePath, { encoding: "utf-8" })
  .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN)
  .replace(/{{site_name}}/gm, env.SITE_NAME);

export const verification = async (user: User) => {
  const mail = await transporter.sendMail({
    from: env.MAIL_FROM || env.MAIL_USER,
    to: user.email,
    subject: "Verify your account",
    text: verifyMailText
      .replace(/{{verification}}/gim, user.verification_token)
      .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN)
      .replace(/{{site_name}}/gm, env.SITE_NAME),
    html: verifyEmailTemplate
      .replace(/{{verification}}/gim, user.verification_token)
      .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN)
      .replace(/{{site_name}}/gm, env.SITE_NAME)
  });

  if (!mail.accepted.length) {
    throw new CustomError("Couldn't send verification email. Try again later.");
  }
};

export const changeEmail = async (user: User) => {
  const mail = await transporter.sendMail({
    from: env.MAIL_FROM || env.MAIL_USER,
    to: user.change_email_address,
    subject: "Verify your new email address",
    text: changeEmailText
      .replace(/{{verification}}/gim, user.change_email_token)
      .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN)
      .replace(/{{site_name}}/gm, env.SITE_NAME),
    html: changeEmailTemplate
      .replace(/{{verification}}/gim, user.change_email_token)
      .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN)
      .replace(/{{site_name}}/gm, env.SITE_NAME)
  });

  if (!mail.accepted.length) {
    throw new CustomError("Couldn't send verification email. Try again later.");
  }
};

export const resetPasswordToken = async (user: User) => {
  const mail = await transporter.sendMail({
    from: env.MAIL_FROM || env.MAIL_USER,
    to: user.email,
    subject: "Reset your password",
    text: resetMailText
      .replace(/{{resetpassword}}/gm, user.reset_password_token)
      .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN),
    html: resetEmailTemplate
      .replace(/{{resetpassword}}/gm, user.reset_password_token)
      .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN)
  });

  if (!mail.accepted.length) {
    throw new CustomError(
      "Couldn't send reset password email. Try again later."
    );
  }
};
