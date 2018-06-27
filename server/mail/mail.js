const config = require('../config');
const nodemailer = require('nodemailer');

let mailConfig = {};

if (process.env.NODE_ENV === 'production') {
  mailConfig = {
    host: config.MAIL_HOST,
    port: config.MAIL_PORT,
    secure: config.MAIL_SECURE,
    auth: {
      user: config.MAIL_USER,
      pass: config.MAIL_PASSWORD,
    },
  };
} else {
  mailConfig = {
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'likyqc3fcjtgdnfd@ethereal.email',
      pass: 'fjmhsR8zJQZ3BKQath',
    },
  };
}

const transporter = nodemailer.createTransport(mailConfig);
module.exports = transporter;
