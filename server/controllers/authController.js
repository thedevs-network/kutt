const fs = require('fs');
const path = require('path');
const passport = require('passport');
const JWT = require('jsonwebtoken');
const axios = require('axios');
const config = require('../config');
const transporter = require('../mail/mail');
const { resetMailText, verifyMailText } = require('../mail/text');
const {
  createUser,
  changePassword,
  generateApiKey,
  getUser,
  verifyUser,
  requestPasswordReset,
  resetPassword,
} = require('../db/user');

/* Read email template */
const resetEmailTemplatePath = path.join(__dirname, '../mail/template-reset.html');
const verifyEmailTemplatePath = path.join(__dirname, '../mail/template-verify.html');
const resetEmailTemplate = fs
  .readFileSync(resetEmailTemplatePath, { encoding: 'utf-8' })
  .replace(/{{domain}}/gm, config.DEFAULT_DOMAIN);
const verifyEmailTemplate = fs
  .readFileSync(verifyEmailTemplatePath, { encoding: 'utf-8' })
  .replace(/{{domain}}/gm, config.DEFAULT_DOMAIN);

/* Function to generate JWT */
const signToken = user =>
  JWT.sign(
    {
      iss: 'ApiAuth',
      sub: user.email,
      domain: user.domain || '',
      iat: new Date().getTime(),
      exp: new Date().setDate(new Date().getDate() + 7),
    },
    config.JWT_SECRET
  );

/* Passport.js authentication controller */
const authenticate = (type, error, isStrict = true) =>
  function auth(req, res, next) {
    if (req.user) return next();
    return passport.authenticate(type, (err, user) => {
      if (err) return res.status(400);
      if (!user && isStrict) return res.status(401).json({ error });
      req.user = user;
      return next();
    })(req, res, next);
  };

exports.authLocal = authenticate('local', 'Login email and/or password are wrong.');
exports.authJwt = authenticate('jwt', 'Unauthorized.');
exports.authJwtLoose = authenticate('jwt', 'Unauthorized.', false);
exports.authApikey = authenticate('localapikey', 'API key is not correct.', false);

/* reCaptcha controller */
exports.recaptcha = async (req, res, next) => {
  if (!req.user) {
    const isReCaptchaValid = await axios({
      method: 'post',
      url: 'https://www.google.com/recaptcha/api/siteverify',
      headers: {
        'Content-type': 'application/x-www-form-urlencoded',
      },
      params: {
        secret: config.RECAPTCHA_SECRET_KEY,
        response: req.body.reCaptchaToken,
        remoteip: req.realIp,
      },
    });
    if (!isReCaptchaValid.data.success) {
      return res.status(401).json({ error: 'reCAPTCHA is not valid. Try again.' });
    }
  }
  return next();
};

exports.signup = async (req, res) => {
  const { email, password } = req.body;
  if (password.length > 64) {
    return res.status(400).json({ error: 'Maximum password length is 64.' });
  }
  if (email.length > 64) {
    return res.status(400).json({ error: 'Maximum email length is 64.' });
  }
  const user = await getUser({ email });
  if (user && user.verified) return res.status(403).json({ error: 'Email is already in use.' });
  const newUser = await createUser({ email, password });
  const mail = await transporter.sendMail({
    from: config.MAIL_USER,
    to: newUser.email,
    subject: 'Verify your account',
    text: verifyMailText.replace('{{verification}}', newUser.verificationToken),
    html: verifyEmailTemplate.replace('{{verification}}', newUser.verificationToken),
  });
  if (mail.accepted.length) {
    return res.status(201).json({ email, message: 'Verification email has been sent.' });
  }
  return res.status(400).json({ error: "Couldn't send verification email. Try again." });
};

exports.login = ({ user }, res) => {
  const token = signToken(user);
  return res.status(200).json({ token });
};

exports.renew = ({ user }, res) => {
  const token = signToken(user);
  return res.status(200).json({ token });
};

exports.verify = async (req, res, next) => {
  const { verificationToken = '' } = req.params;
  const user = await verifyUser({ verificationToken });
  if (user) {
    const token = signToken(user);
    req.user = { token };
  }
  return next();
};

exports.changePassword = async ({ body: { password }, user }, res) => {
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 chars long.' });
  }
  if (password.length > 64) {
    return res.status(400).json({ error: 'Maximum password length is 64.' });
  }
  const changedUser = await changePassword({ email: user.email, password });
  if (changedUser) {
    return res.status(200).json({ message: 'Your password has been changed successfully.' });
  }
  return res.status(400).json({ error: "Couldn't change the password. Try again later" });
};

exports.generateApiKey = async ({ user }, res) => {
  const { apikey } = await generateApiKey({ email: user.email });
  if (apikey) {
    return res.status(201).json({ apikey });
  }
  return res.status(400).json({ error: 'Sorry, an error occured. Please try again later.' });
};

exports.userSettings = ({ user }, res) =>
  res.status(200).json({ apikey: user.apikey || '', customDomain: user.domain || '' });

exports.requestPasswordReset = async ({ body: { email } }, res) => {
  const user = await requestPasswordReset({ email });
  if (!user) {
    return res.status(400).json({ error: "Couldn't reset password." });
  }
  const mail = await transporter.sendMail({
    from: config.MAIL_USER,
    to: user.email,
    subject: 'Reset your password',
    text: resetMailText
      .replace(/{{resetpassword}}/gm, user.resetPasswordToken)
      .replace(/{{domain}}/gm, config.DEFAULT_DOMAIN),
    html: resetEmailTemplate
      .replace(/{{resetpassword}}/gm, user.resetPasswordToken)
      .replace(/{{domain}}/gm, config.DEFAULT_DOMAIN),
  });
  if (mail.accepted.length) {
    return res.status(200).json({ email, message: 'Reset password email has been sent.' });
  }
  return res.status(400).json({ error: "Couldn't reset password." });
};

exports.resetPassword = async (req, res, next) => {
  const { resetPasswordToken = '' } = req.params;
  const user = await resetPassword({ resetPasswordToken });
  if (user) {
    const token = signToken(user);
    req.user = { token };
  }
  return next();
};
