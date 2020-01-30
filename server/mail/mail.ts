import nodemailer from "nodemailer";
import path from "path";
import fs from "fs";

import { resetMailText, verifyMailText } from "./text";
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
const resetEmailTemplate = fs
  .readFileSync(resetEmailTemplatePath, { encoding: "utf-8" })
  .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN);
const verifyEmailTemplate = fs
  .readFileSync(verifyEmailTemplatePath, { encoding: "utf-8" })
  .replace(/{{domain}}/gm, env.DEFAULT_DOMAIN);

export const verification = async (user: User) => {
  const mail = await transporter.sendMail({
    from: env.MAIL_FROM || env.MAIL_USER,
    to: user.email,
    subject: "Verify your account",
    text: verifyMailText.replace(
      /{{verification}}/gim,
      user.verification_token
    ),
    html: verifyEmailTemplate.replace(
      /{{verification}}/gim,
      user.verification_token
    )
  });

  if (!mail.accepted.length) {
    throw new CustomError("Couldn't send verification email. Try again later.");
  }
};

export const resetPasswordToken = async (user: User) => {
  const mail = await transporter.sendMail({
    from: env.MAIL_USER,
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
