const config = require('../config');
const nodemailer = require('nodemailer');

const mailConfig = {
  host: config.MAIL_HOST,
  port: config.MAIL_PORT,
  secure: config.MAIL_SECURE,
  auth: {
    user: config.MAIL_USER,
    pass: config.MAIL_PASSWORD,
  },
};

const transporter = nodemailer.createTransport(mailConfig);
module.exports = transporter;
