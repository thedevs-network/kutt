const { promisify } = require('util');
const urlRegex = require('url-regex');
const dns = require('dns');
const URL = require('url');
const generate = require('nanoid/generate');
const useragent = require('useragent');
const geoip = require('geoip-lite');
const bcrypt = require('bcryptjs');
const ua = require('universal-analytics');
const isbot = require('isbot');
const { addIPCooldown } = require('../db/user');
const {
  addUrlCount,
  createShortUrl,
  createVisit,
  deleteCustomDomain,
  deleteUrl,
  findUrl,
  getCountUrls,
  getCustomDomain,
  getStats,
  getUrls,
  setCustomDomain,
  banUrl,
} = require('../db/url');
const {
  checkBannedDomain,
  checkBannedHost,
  cooldownCheck,
  malwareCheck,
  preservedUrls,
  urlCountsCheck,
} = require('./validateBodyController');
const transporter = require('../mail/mail');
const redis = require('../redis');
const { addProtocol, getStatsLimit, generateShortUrl, getStatsCacheTime } = require('../utils');

const dnsLookup = promisify(dns.lookup);

const generateId = async () => {
  const id = generate('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890', 6);
  const urls = await findUrl({ id });
  if (!urls.length) return id;
  return generateId();
};

exports.urlShortener = async ({ body, realIp, user }, res) => {
  try {
    const domain = URL.parse(body.target).hostname;

    const queries = await Promise.all([
      process.env.GOOGLE_SAFE_BROWSING_KEY && cooldownCheck(user),
      process.env.GOOGLE_SAFE_BROWSING_KEY && malwareCheck(user, body.target),
      user && urlCountsCheck(user.email),
      user && body.reuse && findUrl({ target: addProtocol(body.target) }),
      user && body.customurl && findUrl({ id: body.customurl || '' }),
      (!user || !body.customurl) && generateId(),
      checkBannedDomain(domain),
      checkBannedHost(domain),
    ]);

    // if "reuse" is true, try to return
    // the existent URL without creating one
    if (user && body.reuse) {
      const urls = queries[3];
      if (urls.length) {
        urls.sort((a, b) => a.createdAt > b.createdAt);
        const { domain: d, user: u, ...url } = urls[urls.length - 1];
        const data = {
          ...url,
          password: !!url.password,
          reuse: true,
          shortUrl: generateShortUrl(url.id, user.domain, user.useHttps),
        };
        return res.json(data);
      }
    }

    // Check if custom URL already exists
    if (user && body.customurl) {
      const urls = queries[4];
      if (urls.length) {
        const urlWithNoDomain = !user.domain && urls.some(url => !url.domain);
        const urlWithDmoain = user.domain && urls.some(url => url.domain === user.domain);
        if (urlWithNoDomain || urlWithDmoain) {
          throw new Error('Custom URL is already in use.');
        }
      }
    }

    // Create new URL
    const id = (user && body.customurl) || queries[5];
    const target = addProtocol(body.target);
    const url = await createShortUrl({ ...body, id, target, user });
    if (!user && Number(process.env.NON_USER_COOLDOWN)) {
      addIPCooldown(realIp);
    }

    return res.json(url);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
};

const browsersList = ['IE', 'Firefox', 'Chrome', 'Opera', 'Safari', 'Edge'];
const osList = ['Windows', 'Mac Os X', 'Linux', 'Chrome OS', 'Android', 'iOS'];
const filterInBrowser = agent => item =>
  agent.family.toLowerCase().includes(item.toLocaleLowerCase());
const filterInOs = agent => item =>
  agent.os.family.toLowerCase().includes(item.toLocaleLowerCase());

exports.goToUrl = async (req, res, next) => {
  const { host } = req.headers;
  const reqestedId = req.params.id || req.body.id;
  const id = reqestedId.replace('+', '');
  const domain = host !== process.env.DEFAULT_DOMAIN && host;
  const agent = useragent.parse(req.headers['user-agent']);
  const [browser = 'Other'] = browsersList.filter(filterInBrowser(agent));
  const [os = 'Other'] = osList.filter(filterInOs(agent));
  const referrer = req.header('Referer') && URL.parse(req.header('Referer')).hostname;
  const location = geoip.lookup(req.realIp);
  const country = location && location.country;
  const isBot = isbot(req.headers['user-agent']);

  let url;

  const cachedUrl = await redis.get(id + (domain || ''));

  if (cachedUrl) {
    url = JSON.parse(cachedUrl);
  } else {
    const urls = await findUrl({ id, domain });
    url =
      urls && urls.length && urls.find(item => (domain ? item.domain === domain : !item.domain));
  }

  if (!url) {
    if (host !== process.env.DEFAULT_DOMAIN) {
      const { homepage } = await getCustomDomain({ customDomain: domain });
      if (!homepage) return next();
      return res.redirect(301, homepage);
    }
    return next();
  }

  redis.set(id + (domain || ''), JSON.stringify(url), 'EX', 60 * 60 * 1);

  if (url.banned) {
    return res.redirect('/banned');
  }

  const doesRequestInfo = /.*\+$/gi.test(reqestedId);
  if (doesRequestInfo && !url.password) {
    req.urlTarget = url.target;
    req.pageType = 'info';
    return next();
  }

  if (url.password && !req.body.password) {
    req.protectedUrl = id;
    req.pageType = 'password';
    return next();
  }

  if (url.password) {
    const isMatch = await bcrypt.compare(req.body.password, url.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is not correct' });
    }
    if (url.user && !isBot) {
      addUrlCount(url.id, domain);
      createVisit({
        browser,
        country: country || 'Unknown',
        domain,
        id: url.id,
        os,
        referrer: referrer || 'Direct',
        limit: getStatsLimit(url),
      });
    }
    return res.status(200).json({ target: url.target });
  }
  if (url.user && !isBot) {
    addUrlCount(url.id, domain);
    createVisit({
      browser,
      country: country || 'Unknown',
      domain,
      id: url.id,
      os,
      referrer: referrer || 'Direct',
      limit: getStatsLimit(url),
    });
  }

  if (process.env.GOOGLE_ANALYTICS_UNIVERSAL && !isBot) {
    const visitor = ua(process.env.GOOGLE_ANALYTICS_UNIVERSAL);
    visitor
      .pageview({
        dp: `/${id}`,
        ua: req.headers['user-agent'],
        uip: req.realIp,
        aip: 1,
      })
      .send();
  }

  return res.redirect(url.target);
};

exports.getUrls = async ({ query, user }, res) => {
  const { countAll } = await getCountUrls({ user });
  const urlsList = await getUrls({ options: query, user });
  const isCountMissing = urlsList.list.some(url => typeof url.count === 'undefined');
  const { list } = isCountMissing
    ? await getUrls({ options: query, user, setCount: true })
    : urlsList;
  return res.json({ list, countAll });
};

exports.setCustomDomain = async ({ body, user }, res) => {
  const parsed = URL.parse(body.customDomain);
  const customDomain = parsed.hostname || parsed.href;
  if (!customDomain) return res.status(400).json({ error: 'Domain is not valid.' });
  if (customDomain.length > 40) {
    return res.status(400).json({ error: 'Maximum custom domain length is 40.' });
  }
  if (customDomain === process.env.DEFAULT_DOMAIN) {
    return res.status(400).json({ error: "You can't use default domain." });
  }
  const isValidHomepage =
    !body.homepage || urlRegex({ exact: true, strict: false }).test(body.homepage);
  if (!isValidHomepage) return res.status(400).json({ error: 'Homepage is not valid.' });
  const homepage =
    body.homepage &&
    (URL.parse(body.homepage).protocol ? body.homepage : `http://${body.homepage}`);
  const { email } = await getCustomDomain({ customDomain });
  if (email && email !== user.email) {
    return res
      .status(400)
      .json({ error: 'Domain is already taken. Contact us for multiple users.' });
  }
  const userCustomDomain = await setCustomDomain({
    user,
    customDomain,
    homepage,
    useHttps: body.useHttps,
  });
  if (userCustomDomain)
    return res.status(201).json({
      customDomain: userCustomDomain.name,
      homepage: userCustomDomain.homepage,
      useHttps: userCustomDomain.useHttps,
    });
  return res.status(400).json({ error: "Couldn't set custom domain." });
};

exports.deleteCustomDomain = async ({ user }, res) => {
  const response = await deleteCustomDomain({ user });
  if (response) return res.status(200).json({ message: 'Domain deleted successfully' });
  return res.status(400).json({ error: "Couldn't delete custom domain." });
};

exports.customDomainRedirection = async (req, res, next) => {
  const { headers, path } = req;
  if (
    headers.host !== process.env.DEFAULT_DOMAIN &&
    (path === '/' ||
      preservedUrls.filter(u => u !== 'url-password').some(item => item === path.replace('/', '')))
  ) {
    const { homepage } = await getCustomDomain({ customDomain: headers.host });
    return res.redirect(301, homepage || `https://${process.env.DEFAULT_DOMAIN + path}`);
  }
  return next();
};

exports.deleteUrl = async ({ body: { id, domain }, user }, res) => {
  if (!id) return res.status(400).json({ error: 'No id has been provided.' });
  const customDomain = domain !== process.env.DEFAULT_DOMAIN && domain;
  const urls = await findUrl({ id, domain: customDomain });
  if (!urls && !urls.length) return res.status(400).json({ error: "Couldn't find the short URL." });
  redis.del(id + (customDomain || ''));
  const response = await deleteUrl({ id, domain: customDomain, user });
  if (response) return res.status(200).json({ message: 'Short URL deleted successfully' });
  return res.status(400).json({ error: "Couldn't delete short URL." });
};

exports.getStats = async ({ query: { id, domain }, user }, res) => {
  if (!id) return res.status(400).json({ error: 'No id has been provided.' });
  const customDomain = domain !== process.env.DEFAULT_DOMAIN && domain;
  const redisKey = id + (customDomain || '') + user.email;
  const cached = await redis.get(redisKey);
  if (cached) return res.status(200).json(JSON.parse(cached));
  const urls = await findUrl({ id, domain: customDomain });
  if (!urls && !urls.length) return res.status(400).json({ error: "Couldn't find the short URL." });
  const [url] = urls;
  const stats = await getStats({ id, domain: customDomain, user });
  if (!stats) return res.status(400).json({ error: 'Could not get the short URL stats.' });
  stats.shortUrl = `http${!domain ? 's' : ''}://${
    domain ? url.domain : process.env.DEFAULT_DOMAIN
  }/${url.id}`;
  stats.target = url.target;
  const cacheTime = getStatsCacheTime(stats.total);
  redis.set(redisKey, JSON.stringify(stats), 'EX', cacheTime);
  return res.status(200).json(stats);
};

exports.reportUrl = async ({ body: { url } }, res) => {
  if (!url) return res.status(400).json({ error: 'No URL has been provided.' });

  const isValidUrl = urlRegex({ exact: true, strict: false }).test(url);
  if (!isValidUrl) return res.status(400).json({ error: 'URL is not valid.' });

  const mail = await transporter.sendMail({
    from: process.env.MAIL_USER,
    to: process.env.REPORT_MAIL,
    subject: '[REPORT]',
    text: url,
    html: url,
  });
  if (mail.accepted.length) {
    return res.status(200).json({ message: "Thanks for the report, we'll take actions shortly." });
  }
  return res.status(400).json({ error: "Couldn't submit the report. Try again later." });
};

exports.ban = async ({ body, user }, res) => {
  if (!body.id) return res.status(400).json({ error: 'No id has been provided.' });

  const urls = await findUrl({ id: body.id });
  const [url] = urls.filter(item => !item.domain);

  if (!url) return res.status(400).json({ error: "Couldn't find the URL." });

  if (url.banned) return res.status(200).json({ message: 'URL was banned already' });

  redis.del(body.id);

  const domain = URL.parse(url.target).hostname;

  let host;
  if (body.host) {
    try {
      const dnsRes = await dnsLookup(domain);
      host = dnsRes && dnsRes.address;
    } catch (error) {
      host = null;
    }
  }

  await banUrl({
    adminEmail: user.email,
    domain: body.domain && domain,
    host,
    id: body.id,
    user: body.user,
  });

  return res.status(200).json({ message: 'URL has been banned successfully' });
};
