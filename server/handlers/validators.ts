import { body, param } from "express-validator";
import { isAfter, subDays, subHours } from "date-fns";
import urlRegex from "url-regex";
import { promisify } from "util";
import bcrypt from "bcryptjs";
import axios from "axios";
import dns from "dns";
import URL from "url";

import { CustomError, addProtocol } from "../utils";
import query from "../queries";
import knex from "../knex";
import env from "../env";

const dnsLookup = promisify(dns.lookup);

export const preservedUrls = [
  "login",
  "logout",
  "signup",
  "reset-password",
  "resetpassword",
  "url-password",
  "url-info",
  "settings",
  "stats",
  "verify",
  "api",
  "404",
  "static",
  "images",
  "banned",
  "terms",
  "privacy",
  "protected",
  "report",
  "pricing"
];

export const checkUser = (value, { req }) => !!req.user;

export const createLink = [
  body("target")
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage("Target is missing.")
    .isString()
    .trim()
    .isLength({ min: 1, max: 2040 })
    .withMessage("Maximum URL length is 2040.")
    .customSanitizer(addProtocol)
    .custom(
      value =>
        urlRegex({ exact: true, strict: false }).test(value) ||
        /^(?!https?)(\w+):\/\//.test(value)
    )
    .withMessage("URL is not valid.")
    .custom(value => URL.parse(value).host !== env.DEFAULT_DOMAIN)
    .withMessage(`${env.DEFAULT_DOMAIN} URLs are not allowed.`),
  body("password")
    .optional()
    .custom(checkUser)
    .withMessage("Only users can use this field.")
    .isString()
    .isLength({ min: 3, max: 64 })
    .withMessage("Password length must be between 3 and 64."),
  body("customurl")
    .optional()
    .custom(checkUser)
    .withMessage("Only users can use this field.")
    .isString()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage("Custom URL length must be between 1 and 64.")
    .custom(value => /^[a-zA-Z0-9-_]+$/g.test(value))
    .withMessage("Custom URL is not valid")
    .custom(value => !preservedUrls.some(url => url.toLowerCase() === value))
    .withMessage("You can't use this custom URL."),
  body("reuse")
    .optional()
    .custom(checkUser)
    .withMessage("Only users can use this field.")
    .isBoolean()
    .withMessage("Reuse must be boolean."),
  body("domain")
    .optional()
    .custom(checkUser)
    .withMessage("Only users can use this field.")
    .isString()
    .withMessage("Domain should be string.")
    .customSanitizer(value => value.toLowerCase())
    .custom(async (address, { req }) => {
      const domain = await query.domain.find({
        address,
        user_id: req.user.id
      });
      req.body.domain = domain || null;

      if (!domain) return Promise.reject();
    })
    .withMessage("You can't use this domain.")
];

export const redirectProtected = [
  body("password", "Password is invalid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isString()
    .isLength({ min: 3, max: 64 })
    .withMessage("Password length must be between 3 and 64."),
  param("id", "ID is invalid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 36, max: 36 })
];

export const addDomain = [
  body("address", "Domain is not valid")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 3, max: 64 })
    .withMessage("Domain length must be between 3 and 64.")
    .trim()
    .customSanitizer(value => {
      const parsed = URL.parse(value);
      return parsed.hostname || parsed.href;
    })
    .custom(value => urlRegex({ exact: true, strict: false }).test(value))
    .custom(value => value !== env.DEFAULT_DOMAIN)
    .withMessage("You can't use the default domain.")
    .custom(async (value, { req }) => {
      const domains = await query.domain.get({ user_id: req.user.id });
      if (domains.length !== 0) return Promise.reject();
    })
    .withMessage("You already own a domain. Contact support if you need more.")
    .custom(async value => {
      const domain = await query.domain.find({ address: value });
      if (domain?.user_id || domain?.banned) return Promise.reject();
    })
    .withMessage("You can't add this domain."),
  body("homepage")
    .optional({ checkFalsy: true, nullable: true })
    .customSanitizer(addProtocol)
    .custom(value => urlRegex({ exact: true, strict: false }).test(value))
    .withMessage("Homepage is not valid.")
];

export const removeDomain = [
  param("id", "ID is invalid.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 })
];

export const deleteLink = [
  param("id", "ID is invalid.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 })
];

export const reportLink = [
  body("link", "No link has been provided.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .customSanitizer(addProtocol)
    .custom(value => URL.parse(value).hostname === env.DEFAULT_DOMAIN)
    .withMessage(`You can only report a ${env.DEFAULT_DOMAIN} link.`)
];

export const banLink = [
  param("id", "ID is invalid.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 }),
  body("host", '"host" should be a boolean.')
    .optional({
      nullable: true
    })
    .isBoolean(),
  body("user", '"user" should be a boolean.')
    .optional({
      nullable: true
    })
    .isBoolean(),
  body("userlinks", '"userlinks" should be a boolean.')
    .optional({
      nullable: true
    })
    .isBoolean(),
  body("domain", '"domain" should be a boolean.')
    .optional({
      nullable: true
    })
    .isBoolean()
];

export const getStats = [
  param("id", "ID is invalid.")
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 })
];

export const signup = [
  body("password", "Password is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage("Password length must be between 8 and 64."),
  body("email", "Email is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isEmail()
    .isLength({ min: 0, max: 255 })
    .withMessage("Email length must be max 255.")
    .custom(async (value, { req }) => {
      const user = await query.user.find({ email: value });

      if (user) {
        req.user = user;
      }

      if (user?.verified) return Promise.reject();
    })
    .withMessage("You can't use this email address.")
];

export const login = [
  body("password", "Password is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage("Password length must be between 8 and 64."),
  body("email", "Email is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isEmail()
    .isLength({ min: 0, max: 255 })
    .withMessage("Email length must be max 255.")
];

export const changePassword = [
  body("password", "Password is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage("Password length must be between 8 and 64.")
];

export const resetPasswordRequest = [
  body("email", "Email is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isEmail()
    .isLength({ min: 0, max: 255 })
    .withMessage("Email length must be max 255.")
];

export const deleteUser = [
  body("password", "Password is not valid.")
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .custom(async (password, { req }) => {
      const isMatch = await bcrypt.compare(password, req.user.password);
      if (!isMatch) return Promise.reject();
    })
];

export const cooldown = (user: User) => {
  if (!env.GOOGLE_SAFE_BROWSING_KEY || !user || !user.cooldowns) return;

  // If has active cooldown then throw error
  const hasCooldownNow = user.cooldowns.some(cooldown =>
    isAfter(subHours(new Date(), 12), new Date(cooldown))
  );

  if (hasCooldownNow) {
    throw new CustomError("Cooldown because of a malware URL. Wait 12h");
  }
};

export const malware = async (user: User, target: string) => {
  if (!env.GOOGLE_SAFE_BROWSING_KEY) return;

  const isMalware = await axios.post(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${env.GOOGLE_SAFE_BROWSING_KEY}`,
    {
      client: {
        clientId: env.DEFAULT_DOMAIN.toLowerCase().replace(".", ""),
        clientVersion: "1.0.0"
      },
      threatInfo: {
        threatTypes: [
          "THREAT_TYPE_UNSPECIFIED",
          "MALWARE",
          "SOCIAL_ENGINEERING",
          "UNWANTED_SOFTWARE",
          "POTENTIALLY_HARMFUL_APPLICATION"
        ],
        platformTypes: ["ANY_PLATFORM", "PLATFORM_TYPE_UNSPECIFIED"],
        threatEntryTypes: [
          "EXECUTABLE",
          "URL",
          "THREAT_ENTRY_TYPE_UNSPECIFIED"
        ],
        threatEntries: [{ url: target }]
      }
    }
  );
  if (!isMalware.data || !isMalware.data.matches) return;

  if (user) {
    const [updatedUser] = await query.user.update(
      { id: user.id },
      {
        cooldowns: knex.raw("array_append(cooldowns, ?)", [
          new Date().toISOString()
        ]) as any
      }
    );

    // Ban if too many cooldowns
    if (updatedUser.cooldowns.length > 2) {
      await query.user.update({ id: user.id }, { banned: true });
      throw new CustomError("Too much malware requests. You are now banned.");
    }
  }

  throw new CustomError(
    user ? "Malware detected! Cooldown for 12h." : "Malware detected!"
  );
};

export const linksCount = async (user?: User) => {
  if (!user) return;

  const count = await query.link.total({
    user_id: user.id,
    created_at: [">", subDays(new Date(), 1).toISOString()]
  });

  if (count > env.USER_LIMIT_PER_DAY) {
    throw new CustomError(
      `You have reached your daily limit (${env.USER_LIMIT_PER_DAY}). Please wait 24h.`
    );
  }
};

export const bannedDomain = async (domain: string) => {
  const isBanned = await query.domain.find({
    address: domain,
    banned: true
  });

  if (isBanned) {
    throw new CustomError("URL is containing malware/scam.", 400);
  }
};

export const bannedHost = async (domain: string) => {
  let isBanned;

  try {
    const dnsRes = await dnsLookup(domain);

    if (!dnsRes || !dnsRes.address) return;

    isBanned = await query.host.find({
      address: dnsRes.address,
      banned: true
    });
  } catch (error) {
    isBanned = null;
  }

  if (isBanned) {
    throw new CustomError("URL is containing malware/scam.", 400);
  }
};
