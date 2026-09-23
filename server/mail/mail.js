const nodemailer = require("nodemailer");
const { CustomError } = require("../utils");
const env = require("../env");
const i18n = require("../i18n");
const { render } = require("./render");

const transporter = nodemailer.createTransport({
  host: env.MAIL_HOST, port: env.MAIL_PORT, secure: env.MAIL_SECURE,
  auth: env.MAIL_USER ? { user: env.MAIL_USER, pass: env.MAIL_PASSWORD } : undefined
});

async function send(kind, to, token) {
  if (!env.MAIL_ENABLED) throw new Error("Email is not enabled.");
  const management = require("../management-origin").configured();
  const content = render(kind, { domain: management?.host || env.DEFAULT_DOMAIN, origin: management?.origin, site_name: env.SITE_NAME, token });
  const mail = await transporter.sendMail({ from: env.MAIL_FROM || env.MAIL_USER, to, ...content });
  if (!mail.accepted.length) throw new CustomError(i18n.t(kind === "reset" ?
    "messages.couldn_t_send_reset_password_email_try_again_later" : "messages.couldn_t_send_verification_email_try_again_later"));
}
const verification = user => send("verify", user.email, user.verification_token);
const changeEmail = user => send("change-email", user.change_email_address, user.change_email_token);
const resetPasswordToken = user => send("reset", user.email, user.reset_password_token);
async function sendReportEmail(link) {
  if (!env.MAIL_ENABLED) throw new Error("Email is not enabled.");
  const mail = await transporter.sendMail({ from: env.MAIL_FROM || env.MAIL_USER,
    to: env.REPORT_EMAIL, subject: i18n.t("mail.report_subject"), text: link });
  if (!mail.accepted.length) throw new CustomError(i18n.t("messages.couldn_t_submit_the_report_try_again_later"));
}
module.exports = { verification, changeEmail, resetPasswordToken, sendReportEmail };
