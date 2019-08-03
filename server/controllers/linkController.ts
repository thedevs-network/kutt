import { Handler } from 'express';
import { promisify } from 'util';
import urlRegex from 'url-regex';
import dns from 'dns';
import URL from 'url';
import generate from 'nanoid/generate';
import useragent from 'useragent';
import geoip from 'geoip-lite';
import bcrypt from 'bcryptjs';
import ua from 'universal-analytics';
import isbot from 'isbot';

import { addIP } from '../db/ip';
import {
  addLinkCount,
  createShortLink,
  createVisit,
  deleteLink,
  findLink,
  getUserLinksCount,
  getStats,
  getLinks,
  banLink,
} from '../db/link';
import {
  checkBannedDomain,
  checkBannedHost,
  cooldownCheck,
  malwareCheck,
  preservedUrls,
  urlCountsCheck,
} from './validateBodyController';
import { getDomain, setDomain, deleteDomain } from '../db/domain';
import transporter from '../mail/mail';
import * as redis from '../redis';
import {
  addProtocol,
  getStatsLimit,
  generateShortLink,
  getStatsCacheTime,
} from '../utils';
import { IDomain } from '../models/domain';

const dnsLookup = promisify(dns.lookup);

const generateId = async () => {
  const id = generate(
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890',
    6
  );
  const link = await findLink({ id });
  if (!link) return id;
  return generateId();
};

export const shortener: Handler = async (req, res) => {
  try {
    const targetDomain = URL.parse(req.body.target).hostname;

    const queries = await Promise.all([
      process.env.GOOGLE_SAFE_BROWSING_KEY && cooldownCheck(req.user),
      process.env.GOOGLE_SAFE_BROWSING_KEY &&
        malwareCheck(req.user, req.body.target),
      req.user && urlCountsCheck(req.user._id),
      req.user &&
        req.body.reuse &&
        findLink({ target: addProtocol(req.body.target), user: req.user._id }),
      req.user &&
        req.body.customurl &&
        findLink(
          {
            id: req.body.customurl,
            domain: req.user.domain && req.user.domain._id,
          },
          { forceDomainCheck: true }
        ),
      (!req.user || !req.body.customurl) && generateId(),
      checkBannedDomain(targetDomain),
      checkBannedHost(targetDomain),
    ]);

    // if "reuse" is true, try to return
    // the existent URL without creating one
    if (queries[3]) {
      const { domain: d, user: u, ...link } = queries[3];
      const data = {
        ...link,
        password: !!link.password,
        reuse: true,
        shortLink: generateShortLink(link.id, req.user.domain),
      };
      return res.json(data);
    }

    // Check if custom link already exists
    if (queries[4]) {
      throw new Error('Custom URL is already in use.');
    }

    // Create new link
    const id = (req.user && req.body.customurl) || queries[5];
    const target = addProtocol(req.body.target);
    const link = await createShortLink({
      ...req.body,
      id,
      target,
      user: req.user,
    });
    if (!req.user && Number(process.env.NON_USER_COOLDOWN)) {
      addIP(req.realIP);
    }

    return res.json(link);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const browsersList = ['IE', 'Firefox', 'Chrome', 'Opera', 'Safari', 'Edge'];
const osList = ['Windows', 'Mac Os', 'Linux', 'Android', 'iOS'];
const filterInBrowser = agent => item =>
  agent.family.toLowerCase().includes(item.toLocaleLowerCase());
const filterInOs = agent => item =>
  agent.os.family.toLowerCase().includes(item.toLocaleLowerCase());

export const goToLink: Handler = async (req, res, next) => {
  const { host } = req.headers;
  const reqestedId = req.params.id || req.body.id;
  const id = reqestedId.replace('+', '');
  const customDomain = host !== process.env.DEFAULT_DOMAIN && host;
  const agent = useragent.parse(req.headers['user-agent']);
  const [browser = 'Other'] = browsersList.filter(filterInBrowser(agent));
  const [os = 'Other'] = osList.filter(filterInOs(agent));
  const referrer =
    req.header('Referer') && URL.parse(req.header('Referer')).hostname;
  const location = geoip.lookup(req.realIP);
  const country = location && location.country;
  const isBot = isbot(req.headers['user-agent']);

  const domain = await (customDomain && getDomain({ name: customDomain }));

  const link = await findLink({ id, domain: domain && domain._id });

  if (!link) {
    if (host !== process.env.DEFAULT_DOMAIN) {
      if (!domain || !domain.homepage) return next();
      return res.redirect(301, domain.homepage);
    }
    return next();
  }

  if (link.banned) {
    return res.redirect('/banned');
  }

  const doesRequestInfo = /.*\+$/gi.test(reqestedId);
  if (doesRequestInfo && !link.password) {
    req.linkTarget = link.target;
    req.pageType = 'info';
    return next();
  }

  if (link.password && !req.body.password) {
    req.protectedLink = id;
    req.pageType = 'password';
    return next();
  }

  if (link.password) {
    const isMatch = await bcrypt.compare(req.body.password, link.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is not correct' });
    }
    if (link.user && !isBot) {
      addLinkCount(link.id, customDomain);
      createVisit({
        browser: browser.toLowerCase(),
        country: country || 'Unknown',
        domain: customDomain,
        id: link.id,
        os: os.toLowerCase().replace(/\s/gi, ''),
        referrer: referrer.replace(/\./gi, '[dot]') || 'Direct',
        limit: getStatsLimit(),
      });
    }
    return res.status(200).json({ target: link.target });
  }
  if (link.user && !isBot) {
    addLinkCount(link.id, customDomain);
    createVisit({
      browser,
      country: country || 'Unknown',
      domain: customDomain,
      id: link.id,
      os,
      referrer: referrer || 'Direct',
      limit: getStatsLimit(),
    });
  }

  if (process.env.GOOGLE_ANALYTICS_UNIVERSAL && !isBot) {
    const visitor = ua(process.env.GOOGLE_ANALYTICS_UNIVERSAL);
    visitor
      .pageview({
        dp: `/${id}`,
        ua: req.headers['user-agent'],
        uip: req.realIP,
        aip: 1,
      })
      .send();
  }

  return res.redirect(link.target);
};

export const getUserLinks: Handler = async (req, res) => {
  // TODO: Use aggregation
  const [countAll, list] = await Promise.all([
    getUserLinksCount({ user: req.user }),
    getLinks(req.user, req.query),
  ]);
  return res.json({ list, countAll });
};

export const setCustomDomain: Handler = async (req, res) => {
  const parsed = URL.parse(req.body.customDomain);
  const customDomain = parsed.hostname || parsed.href;
  if (!customDomain)
    return res.status(400).json({ error: 'Domain is not valid.' });
  if (customDomain.length > 40) {
    return res
      .status(400)
      .json({ error: 'Maximum custom domain length is 40.' });
  }
  if (customDomain === process.env.DEFAULT_DOMAIN) {
    return res.status(400).json({ error: "You can't use default domain." });
  }
  const isValidHomepage =
    !req.body.homepage ||
    urlRegex({ exact: true, strict: false }).test(req.body.homepage);
  if (!isValidHomepage)
    return res.status(400).json({ error: 'Homepage is not valid.' });
  const homepage =
    req.body.homepage &&
    (URL.parse(req.body.homepage).protocol
      ? req.body.homepage
      : `http://${req.body.homepage}`);
  const matchedDomain = await getDomain({ name: customDomain });
  if (
    matchedDomain &&
    matchedDomain.user.toString() !== req.user._id.toString()
  ) {
    return res.status(400).json({
      error: 'Domain is already taken. Contact us for multiple users.',
    });
  }
  const userCustomDomain = await setDomain({
    user: req.user,
    name: customDomain,
    homepage,
  });
  if (userCustomDomain) {
    return res.status(201).json({
      customDomain: userCustomDomain.name,
      homepage: userCustomDomain.homepage,
    });
  }
  return res.status(400).json({ error: "Couldn't set custom domain." });
};

export const deleteCustomDomain: Handler = async (req, res) => {
  const response = await deleteDomain(req.user);
  if (response)
    return res.status(200).json({ message: 'Domain deleted successfully' });
  return res.status(400).json({ error: "Couldn't delete custom domain." });
};

export const customDomainRedirection: Handler = async (req, res, next) => {
  const { headers, path } = req;
  if (
    headers.host !== process.env.DEFAULT_DOMAIN &&
    (path === '/' ||
      preservedUrls
        .filter(l => l !== 'url-password')
        .some(item => item === path.replace('/', '')))
  ) {
    const domain = await getDomain({ name: headers.host });
    return res.redirect(
      301,
      (domain && domain.homepage) ||
        `https://${process.env.DEFAULT_DOMAIN + path}`
    );
  }
  return next();
};

export const deleteUserLink: Handler = async (req, res) => {
  if (!req.body.id)
    return res.status(400).json({ error: 'No id has been provided.' });
  const customDomain =
    req.body.domain !== process.env.DEFAULT_DOMAIN
      ? await getDomain({ name: req.body.domain })
      : ({} as IDomain);
  const link = await findLink(
    {
      id: req.body.id,
      domain: customDomain._id,
      user: req.user && req.user._id,
    },
    { forceDomainCheck: true }
  );
  if (!link) {
    return res.status(400).json({ error: "Couldn't find the short link." });
  }
  const response = await deleteLink({
    id: req.body,
    domain: customDomain._id,
    user: req.user,
  });

  if (response) {
    return res.status(200).json({ message: 'Short link deleted successfully' });
  }

  return res.status(400).json({ error: "Couldn't delete the short link." });
};

export const getLinkStats: Handler = async (req, res) => {
  if (!req.query.id)
    return res.status(400).json({ error: 'No id has been provided.' });
  const customDomain =
    req.query.domain !== process.env.DEFAULT_DOMAIN
      ? await getDomain({ name: req.query.domain })
      : ({} as IDomain);
  const redisKey = req.query.id + (customDomain.name || '') + req.user.email;
  const cached = await redis.get(redisKey);
  if (cached) return res.status(200).json(JSON.parse(cached));
  const link = await findLink(
    {
      id: req.query.id,
      domain: customDomain._id,
      user: req.user && req.user._id,
    },
    { forceDomainCheck: true }
  );
  if (!link)
    return res.status(400).json({ error: "Couldn't find the short link." });

  const stats = await getStats({
    id: req.query.id,
    domain: customDomain._id,
    user: req.user,
  });

  if (!stats) {
    return res
      .status(400)
      .json({ error: 'Could not get the short link stats.' });
  }

  const cacheTime = getStatsCacheTime(stats.total);
  redis.set(redisKey, JSON.stringify(stats), 'EX', cacheTime);
  return res.status(200).json(stats);
};

export const reportLink: Handler = async (req, res) => {
  // TODO: Change from url to link in front-end
  if (!req.body.link)
    return res.status(400).json({ error: 'No URL has been provided.' });

  const { hostname } = URL.parse(req.body.link);
  if (hostname !== process.env.DEFAULT_DOMAIN) {
    return res.status(400).json({
      error: `You can only report a ${process.env.DEFAULT_DOMAIN} link`,
    });
  }

  const mail = await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: process.env.REPORT_MAIL,
    subject: '[REPORT]',
    text: req.body.url,
    html: req.body.url,
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
    return res.status(400).json({ error: 'No id has been provided.' });

  const link = await findLink({ id: req.body.id }, { forceDomainCheck: true });

  if (!link) return res.status(400).json({ error: "Couldn't find the link." });

  if (link.banned) {
    return res.status(200).json({ message: 'Link was banned already' });
  }

  const domain = URL.parse(link.target).hostname;

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
    adminId: req.user,
    domain,
    host,
    id: req.body.id,
    banUser: !!req.body.user,
  });

  return res.status(200).json({ message: 'Link has been banned successfully' });
};
