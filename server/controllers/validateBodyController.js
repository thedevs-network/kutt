const axios = require('axios');
const urlRegex = require('url-regex');
const validator = require('express-validator/check');
const { subHours } = require('date-fns/');
const { validationResult } = require('express-validator/check');
const { addCooldown, banUser, getCooldowns } = require('../db/user');
const config = require('../config');

exports.validationCriterias = [
  validator
    .body('email')
    .exists()
    .withMessage('Email must be provided.')
    .isEmail()
    .withMessage('Email is not valid.')
    .trim()
    .normalizeEmail(),
  validator
    .body('password', 'Password must be at least 8 chars long.')
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

const preservedUrls = [
  'login',
  'logout',
  'signup',
  'reset-password',
  'resetpassword',
  'url-password',
  'settings',
  'stats',
  'verify',
  'api',
  '404',
  'static',
  'images',
];

exports.preservedUrls = preservedUrls;

exports.validateUrl = async ({ body, user }, res, next) => {
  // Validate URL existence
  if (!body.target) return res.status(400).json({ error: 'No target has been provided.' });

  // validate URL length
  if (body.target.length > 1024) {
    return res.status(400).json({ error: 'Maximum URL length is 1024.' });
  }

  // Validate URL
  const isValidUrl = urlRegex({ exact: true, strict: false }).test(body.target);
  if (!isValidUrl) return res.status(400).json({ error: 'URL is not valid.' });

  // Validate password length
  if (body.password && body.password.length > 64) {
    return res.status(400).json({ error: 'Maximum password length is 64.' });
  }

  // Custom URL validations
  if (user && body.customurl) {
    // Validate custom URL
    if (!/^[a-zA-Z0-9-_]+$/g.test(body.customurl.trim())) {
      return res.status(400).json({ error: 'Custom URL is not valid.' });
    }

    // Prevent from using preserved URLs
    if (preservedUrls.some(url => url === body.customurl)) {
      return res.status(400).json({ error: "You can't use this custom URL name." });
    }

    // Validate custom URL length
    if (body.customurl.length > 64) {
      return res.status(400).json({ error: 'Maximum custom URL length is 64.' });
    }
  }

  return next();
};

exports.cooldownCheck = async ({ user }, res, next) => {
  if (user) {
    const { cooldowns } = await getCooldowns(user);
    if (cooldowns.length > 4) {
      await banUser(user);
      return res.status(400).json({ error: 'Too much malware requests. You are now banned.' });
    }
    const hasCooldownNow = cooldowns.some(cooldown => cooldown > subHours(new Date(), 12).toJSON());
    if (hasCooldownNow) {
      return res.status(400).json({ error: 'Cooldown because of a malware URL. Wait 12h' });
    }
  }
  return next();
};

exports.malwareCheck = async ({ body, user }, res, next) => {
  const isMalware = await axios.post(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${
      config.GOOGLE_SAFE_BROWSING_KEY
    }`,
    {
      client: {
        clientId: config.DEFAULT_DOMAIN.toLowerCase().replace('.', ''),
        clientVersion: '1.0.0',
      },
      threatInfo: {
        threatTypes: [
          'THREAT_TYPE_UNSPECIFIED',
          'MALWARE',
          'SOCIAL_ENGINEERING',
          'UNWANTED_SOFTWARE',
          'POTENTIALLY_HARMFUL_APPLICATION',
        ],
        platformTypes: ['ANY_PLATFORM', 'PLATFORM_TYPE_UNSPECIFIED'],
        threatEntryTypes: ['EXECUTABLE', 'URL', 'THREAT_ENTRY_TYPE_UNSPECIFIED'],
        threatEntries: [{ url: body.target }],
      },
    }
  );
  if (isMalware.data && isMalware.data.matches) {
    if (user) {
      await addCooldown(user);
    }
    return res
      .status(400)
      .json({ error: user ? 'Malware detected! Cooldown for 12h.' : 'Malware detected!' });
  }
  return next();
};
