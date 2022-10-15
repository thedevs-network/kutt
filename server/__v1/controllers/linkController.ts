import bcrypt from "bcryptjs";
import dns from "dns";
import { Handler } from "express";
import isbot from "isbot";
import generate from "nanoid/generate";
import ua from "universal-analytics";
import URL from "url";
import urlRegex from "url-regex";
import { promisify } from "util";
import { deleteDomain, getDomain, setDomain } from "../db/domain";
import { addIP } from "../db/ip";
import env from "../../env";
import {
  banLink,
  createShortLink,
  deleteLink,
  findLink,
  getLinks,
  getStats,
  getUserLinksCount
} from "../db/link";
import transporter from "../../mail/mail";
import * as redis from "../../redis";
import {
  addProtocol,
  generateShortLink,
  getStatsCacheTime,
  removeWww
} from "../../utils";
import {
  checkBannedDomain,
  checkBannedHost,
  cooldownCheck,
  malwareCheck,
  preservedUrls,
  urlCountsCheck
} from "./validateBodyController";
import queue from "../../queues";

const dnsLookup = promisify(dns.lookup);

const generateId = async () => {
  const address = generate(
    "abcdefghkmnpqrstuvwxyzABCDEFGHKLMNPQRSTUVWXYZ23456789",
    env.LINK_LENGTH
  );
  const link = await findLink({ address });
  if (!link) return address;
  return generateId();
};

export const shortener: Handler = async (req, res) => {
  try {
    const target = addProtocol(req.body.target);
    const targetDomain = removeWww(URL.parse(target).hostname);

    const queries = await Promise.all([
      env.GOOGLE_SAFE_BROWSING_KEY && cooldownCheck(req.user),
      env.GOOGLE_SAFE_BROWSING_KEY && malwareCheck(req.user, req.body.target),
      req.user && urlCountsCheck(req.user),
      req.user &&
        req.body.reuse &&
        findLink({
          target,
          user_id: req.user.id
        }),
      req.user &&
        req.body.customurl &&
        findLink({
          address: req.body.customurl,
          domain_id: req.user.domain_id || null
        }),
      (!req.user || !req.body.customurl) && generateId(),
      checkBannedDomain(targetDomain),
      checkBannedHost(targetDomain)
    ]);

    // if "reuse" is true, try to return
    // the existent URL without creating one
    if (queries[3]) {
      const { domain_id: d, user_id: u, ...link } = queries[3];
      const shortLink = generateShortLink(link.address, req.user.domain);
      const data = {
        ...link,
        id: link.address,
        password: !!link.password,
        reuse: true,
        shortLink,
        shortUrl: shortLink
      };
      return res.json(data);
    }

    // Check if custom link already exists
    if (queries[4]) {
      throw new Error("Custom URL is already in use.");
    }

    // Create new link
    const address = (req.user && req.body.customurl) || queries[5];
    const link = await createShortLink(
      {
        ...req.body,
        address,
        target
      },
      req.user
    );
    if (!req.user && env.NON_USER_COOLDOWN) {
      addIP(req.realIP);
    }

    return res.json({ ...link, id: link.address });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

export const goToLink: Handler = async (req, res, next) => {
  const host = removeWww(req.headers.host);
  const reqestedId = req.params.id || req.body.id;
  const address = reqestedId.replace("+", "");
  const customDomain = host !== env.DEFAULT_DOMAIN && host;
  const isBot = isbot(req.headers["user-agent"]);

  let domain;
  if (customDomain) {
    domain = await getDomain({ address: customDomain });
  }

  const link = await findLink({ address, domain_id: domain && domain.id });

  if (!link) {
    if (host !== env.DEFAULT_DOMAIN) {
      if (!domain || !domain.homepage) return next();
      return res.redirect(301, domain.homepage);
    }
    return next();
  }

  if (link.banned) {
    return res.redirect("/banned");
  }

  const doesRequestInfo = /.*\+$/gi.test(reqestedId);
  if (doesRequestInfo && !link.password) {
    req.linkTarget = link.target;
    req.pageType = "info";
    return next();
  }

  if (link.password && !req.body.password) {
    req.protectedLink = address;
    req.pageType = "password";
    return next();
  }

  if (link.password) {
    const isMatch = await bcrypt.compare(req.body.password, link.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Password is not correct" });
    }
    if (link.user_id && !isBot) {
      queue.visit.add({
        headers: req.headers,
        realIP: req.realIP,
        referrer: req.get("Referrer"),
        link,
        customDomain
      });
    }
    return res.status(200).json({ target: link.target });
  }

  if (link.user_id && !isBot) {
    queue.visit.add({
      headers: req.headers,
      realIP: req.realIP,
      referrer: req.get("Referrer"),
      link,
      customDomain
    });
  }

  if (env.GOOGLE_ANALYTICS_UNIVERSAL && !isBot) {
    const visitor = ua(env.GOOGLE_ANALYTICS_UNIVERSAL);
    visitor
      .pageview({
        dp: `/${address}`,
        ua: req.headers["user-agent"],
        uip: req.realIP,
        aip: 1
      })
      .send();
  }

  return res.redirect(link.target);
};

export const getUserLinks: Handler = async (req, res) => {
  const [countAll, list] = await Promise.all([
    getUserLinksCount({ user_id: req.user.id }),
    getLinks(req.user.id, req.query)
  ]);
  return res.json({ list, countAll: parseInt(countAll) });
};

export const setCustomDomain: Handler = async (req, res) => {
  const parsed = URL.parse(req.body.customDomain);
  const customDomain = removeWww(parsed.hostname || parsed.href);
  if (!customDomain)
    return res.status(400).json({ error: "Domain is not valid." });
  if (customDomain.length > 40) {
    return res
      .status(400)
      .json({ error: "Maximum custom domain length is 40." });
  }
  if (customDomain === env.DEFAULT_DOMAIN) {
    return res.status(400).json({ error: "You can't use default domain." });
  }
  const isValidHomepage =
    !req.body.homepage ||
    urlRegex({ exact: true, strict: false }).test(req.body.homepage);
  if (!isValidHomepage)
    return res.status(400).json({ error: "Homepage is not valid." });
  const homepage =
    req.body.homepage &&
    (URL.parse(req.body.homepage).protocol
      ? req.body.homepage
      : `http://${req.body.homepage}`);
  const matchedDomain = await getDomain({ address: customDomain });
  if (
    matchedDomain &&
    matchedDomain.user_id &&
    matchedDomain.user_id !== req.user.id
  ) {
    return res.status(400).json({
      error: "Domain is already taken. Contact us for multiple users."
    });
  }
  const userCustomDomain = await setDomain(
    {
      address: customDomain,
      homepage
    },
    req.user,
    matchedDomain
  );
  if (userCustomDomain) {
    return res.status(201).json({
      customDomain: userCustomDomain.address,
      homepage: userCustomDomain.homepage
    });
  }
  return res.status(400).json({ error: "Couldn't set custom domain." });
};

export const deleteCustomDomain: Handler = async (req, res) => {
  const response = await deleteDomain(req.user);
  if (response)
    return res.status(200).json({ message: "Domain deleted successfully" });
  return res.status(400).json({ error: "Couldn't delete custom domain." });
};

export const customDomainRedirection: Handler = async (req, res, next) => {
  const { path } = req;
  const host = removeWww(req.headers.host);
  if (
    host !== env.DEFAULT_DOMAIN &&
    (path === "/" ||
      preservedUrls
        .filter(l => l !== "url-password")
        .some(item => item === path.replace("/", "")))
  ) {
    const domain = await getDomain({ address: host });
    return res.redirect(
      301,
      (domain && domain.homepage) || `https://${env.DEFAULT_DOMAIN + path}`
    );
  }
  return next();
};

export const deleteUserLink: Handler = async (req, res) => {
  const { id, domain } = req.body;

  if (!id) {
    return res.status(400).json({ error: "No id has been provided." });
  }

  const response = await deleteLink({
    address: id,
    domain: !domain || domain === env.DEFAULT_DOMAIN ? null : domain,
    user_id: req.user.id
  });

  if (response) {
    return res.status(200).json({ message: "Short link deleted successfully" });
  }

  return res.status(400).json({ error: "Couldn't delete the short link." });
};

export const getLinkStats: Handler = async (req, res) => {
  if (!req.query.id) {
    return res.status(400).json({ error: "No id has been provided." });
  }

  const hostname = removeWww(URL.parse(req.query.domain).hostname);
  const hasCustomDomain = req.query.domain && hostname !== env.DEFAULT_DOMAIN;
  const customDomain = hasCustomDomain
    ? (await getDomain({ address: req.query.domain })) || ({ id: -1 } as Domain)
    : ({} as Domain);

  const redisKey = req.query.id + (customDomain.address || "") + req.user.email;
  const cached = await redis.get(redisKey);
  if (cached) return res.status(200).json(JSON.parse(cached));

  const link = await findLink({
    address: req.query.id,
    domain_id: hasCustomDomain ? customDomain.id : null,
    user_id: req.user && req.user.id
  });

  if (!link) {
    return res.status(400).json({ error: "Couldn't find the short link." });
  }

  const stats = await getStats(link, customDomain);

  if (!stats) {
    return res
      .status(400)
      .json({ error: "Could not get the short link stats." });
  }

  const cacheTime = getStatsCacheTime(0);
  redis.set(redisKey, JSON.stringify(stats), "EX", cacheTime);
  return res.status(200).json(stats);
};

export const reportLink: Handler = async (req, res) => {
  if (!req.body.link) {
    return res.status(400).json({ error: "No URL has been provided." });
  }

  const hostname = removeWww(URL.parse(req.body.link).hostname);
  if (hostname !== env.DEFAULT_DOMAIN) {
    return res.status(400).json({
      error: `You can only report a ${env.DEFAULT_DOMAIN} link`
    });
  }

  const mail = await transporter.sendMail({
    from: env.MAIL_FROM || env.MAIL_USER,
    to: env.REPORT_MAIL,
    subject: "[REPORT]",
    text: req.body.link,
    html: req.body.link
  });
  if (mail.accepted.length) {
    return res
      .status(200)
      .json({ message: "Thanks for the report, we'll take actions shortly." });
  }
  return res
    .status(400)
    .json({ error: "Couldn't submit the report. Try again later." });
};

export const ban: Handler = async (req, res) => {
  if (!req.body.id)
    return res.status(400).json({ error: "No id has been provided." });

  const link = await findLink({ address: req.body.id, domain_id: null });

  if (!link) return res.status(400).json({ error: "Link does not exist." });

  if (link.banned) {
    return res.status(200).json({ message: "Link was banned already." });
  }

  const domain = removeWww(URL.parse(link.target).hostname);

  let host;
  if (req.body.host) {
    try {
      const dnsRes = await dnsLookup(domain);
      host = dnsRes && dnsRes.address;
    } catch (error) {
      host = null;
    }
  }

  await banLink({
    adminId: req.user.id,
    domain,
    host,
    address: req.body.id,
    banUser: !!req.body.user
  });

  return res.status(200).json({ message: "Link has been banned successfully" });
};
