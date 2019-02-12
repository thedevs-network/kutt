const { promisify } = require('util');
const dns = require('dns');
const axios = require('axios');
const urlRegex = require('url-regex');
const validator = require('express-validator/check');
const { subHours } = require('date-fns/');
const { validationResult } = require('express-validator/check');
const { addCooldown, banUser } = require('../db/user');
const { getBannedDomain, getBannedHost, urlCountFromDate } = require('../db/url');
const config = require('../config');
const subDay = require('date-fns/sub_days');

const dnsLookup = promisify(dns.lookup);

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
  'url-info',
  'settings',
  'stats',
  'verify',
  'api',
  '404',
  'static',
  'images',
  'banned',
  'terms',
  'privacy',
  'report',
];

exports.preservedUrls = preservedUrls;

exports.validateUrl = async ({ body, user }, res, next) => {
  // Validate URL existence
  if (!body.target) return res.status(400).json({ error: 'No target has been provided.' });

  // validate URL length
  if (body.target.length > 3000) {
    return res.status(400).json({ error: 'Maximum URL length is 3000.' });
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

exports.cooldownCheck = async user => {
  if (user && user.cooldowns) {
    if (user.cooldowns.length > 4) {
      await banUser(user);
      throw new Error('Too much malware requests. You are now banned.');
    }
    const hasCooldownNow = user.cooldowns.some(
      cooldown => cooldown > subHours(new Date(), 12).toJSON()
    );
    if (hasCooldownNow) {
      throw new Error('Cooldown because of a malware URL. Wait 12h');
    }
  }
};

exports.malwareCheck = async (user, target) => {
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
        threatEntries: [{ url: target }],
      },
    }
  );
  if (isMalware.data && isMalware.data.matches) {
    if (user) {
      await addCooldown(user);
    }
    throw new Error(user ? 'Malware detected! Cooldown for 12h.' : 'Malware detected!');
  }
};

exports.urlCountsCheck = async email => {
  const { count } = await urlCountFromDate({
    email,
    date: subDay(new Date(), 1).toJSON(),
  });
  if (count > config.USER_LIMIT_PER_DAY) {
    throw new Error(
      `You have reached your daily limit (${config.USER_LIMIT_PER_DAY}). Please wait 24h.`
    );
  }
};

exports.checkBannedDomain = async domain => {
  const isDomainBanned = await getBannedDomain(domain);
  if (isDomainBanned) {
    throw new Error('URL is containing malware/scam.');
  }
};

exports.checkBannedHost = async domain => {
  let isHostBanned;
  try {
    const dnsRes = await dnsLookup(domain);
    isHostBanned = await getBannedHost(dnsRes && dnsRes.address);
  } catch (error) {
    isHostBanned = null;
  }
  if (isHostBanned) {
    throw new Error('URL is containing malware/scam.');
  }
};
