import nodemailer from "nodemailer";

const mailConfig = {
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD
  }
};

const transporter = nodemailer.createTransport(mailConfig);

export default transporter;
