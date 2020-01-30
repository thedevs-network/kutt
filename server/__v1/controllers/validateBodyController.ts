import { differenceInMinutes, subHours, subDays, isAfter } from "date-fns";
import { validationResult } from "express-validator";
import { body } from "express-validator";
import { RequestHandler } from "express";
import { promisify } from "util";
import urlRegex from "url-regex";
import axios from "axios";
import dns from "dns";
import URL from "url";

import { addProtocol, CustomError } from "../../utils";
import { addCooldown, banUser } from "../db/user";
import { getUserLinksCount } from "../db/link";
import { getDomain } from "../db/domain";
import { getHost } from "../db/host";
import { getIP } from "../db/ip";
import env from "../../env";

const dnsLookup = promisify(dns.lookup);

export const validationCriterias = [
  body("email")
    .exists()
    .withMessage("Email must be provided.")
    .isEmail()
    .withMessage("Email is not valid.")
    .trim(),
  body("password", "Password must be at least 8 chars long.")
    .exists()
    .withMessage("Password must be provided.")
    .isLength({ min: 8 })
];

export const validateBody = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorsObj = errors.mapped();
    const emailError = errorsObj.email && errorsObj.email.msg;
    const passwordError = errorsObj.password && errorsObj.password.msg;
    return res.status(400).json({ error: emailError || passwordError });
  }
  return next();
};

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

export const validateUrl: RequestHandler = async (req, res, next) => {
  // Validate URL existence
  if (!req.body.target)
    return res.status(400).json({ error: "No target has been provided." });

  // validate URL length
  if (req.body.target.length > 2040) {
    return res.status(400).json({ error: "Maximum URL length is 2040." });
  }

  // Validate URL
  const isValidUrl = urlRegex({ exact: true, strict: false }).test(
    req.body.target
  );
  if (!isValidUrl && !/^\w+:\/\//.test(req.body.target))
    return res.status(400).json({ error: "URL is not valid." });

  // If target is the URL shortener itself
  const { host } = URL.parse(addProtocol(req.body.target));
  if (host === env.DEFAULT_DOMAIN) {
    return res
      .status(400)
      .json({ error: `${env.DEFAULT_DOMAIN} URLs are not allowed.` });
  }

  // Validate password length
  if (req.body.password && req.body.password.length > 64) {
    return res.status(400).json({ error: "Maximum password length is 64." });
  }

  // Custom URL validations
  if (req.user && req.body.customurl) {
    // Validate custom URL
    if (!/^[a-zA-Z0-9-_]+$/g.test(req.body.customurl.trim())) {
      return res.status(400).json({ error: "Custom URL is not valid." });
    }

    // Prevent from using preserved URLs
    if (preservedUrls.some(url => url === req.body.customurl)) {
      return res
        .status(400)
        .json({ error: "You can't use this custom URL name." });
    }

    // Validate custom URL length
    if (req.body.customurl.length > 64) {
      return res
        .status(400)
        .json({ error: "Maximum custom URL length is 64." });
    }
  }

  return next();
};

export const cooldownCheck = async (user: User) => {
  if (user && user.cooldowns) {
    if (user.cooldowns.length > 4) {
      await banUser(user.id);
      throw new Error("Too much malware requests. You are banned.");
    }
    const hasCooldownNow = user.cooldowns.some(cooldown =>
      isAfter(subHours(new Date(), 12), new Date(cooldown))
    );
    if (hasCooldownNow) {
      throw new Error("Cooldown because of a malware URL. Wait 12h");
    }
  }
};

export const ipCooldownCheck: RequestHandler = async (req, res, next) => {
  const cooldownConfig = env.NON_USER_COOLDOWN;
  if (req.user || !cooldownConfig) return next();
  const ip = await getIP(req.realIP);
  if (ip) {
    const timeToWait =
      cooldownConfig - differenceInMinutes(new Date(), new Date(ip.created_at));
    return res.status(400).json({
      error:
        `Non-logged in users are limited. Wait ${timeToWait} ` +
        "minutes or log in."
    });
  }
  next();
};

export const malwareCheck = async (user: User, target: string) => {
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
  if (isMalware.data && isMalware.data.matches) {
    if (user) {
      await addCooldown(user.id);
    }
    throw new CustomError(
      user ? "Malware detected! Cooldown for 12h." : "Malware detected!"
    );
  }
};

export const urlCountsCheck = async (user: User) => {
  const count = await getUserLinksCount({
    user_id: user.id,
    date: subDays(new Date(), 1)
  });
  if (count > env.USER_LIMIT_PER_DAY) {
    throw new CustomError(
      `You have reached your daily limit (${env.USER_LIMIT_PER_DAY}). Please wait 24h.`
    );
  }
};

export const checkBannedDomain = async (domain: string) => {
  const bannedDomain = await getDomain({ address: domain, banned: true });
  if (bannedDomain) {
    throw new CustomError("URL is containing malware/scam.");
  }
};

export const checkBannedHost = async (domain: string) => {
  let isHostBanned;
  try {
    const dnsRes = await dnsLookup(domain);
    isHostBanned = await getHost({
      address: dnsRes && dnsRes.address,
      banned: true
    });
  } catch (error) {
    isHostBanned = null;
  }
  if (isHostBanned) {
    throw new CustomError("URL is containing malware/scam.");
  }
};
