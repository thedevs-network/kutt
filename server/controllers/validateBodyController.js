const { body } = require('express-validator/check');
const { validationResult } = require('express-validator/check');

exports.validationCriterias = [
  body('email')
    .exists()
    .withMessage('Email must be provided.')
    .isEmail()
    .withMessage('Email is not valid.')
    .trim()
    .normalizeEmail(),
  body('password', 'Password must be at least 8 chars long.')
    .exists()
    .withMessage('Password must be provided.')
    .isLength({ min: 8 }),
];

exports.validateBody = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorsObj = errors.mapped();
    const emailError = errorsObj.email && errorsObj.email.msg;
    const passwordError = errorsObj.password && errorsObj.password.msg;
    return res.status(400).json({ error: emailError || passwordError });
  }
  return next();
};
