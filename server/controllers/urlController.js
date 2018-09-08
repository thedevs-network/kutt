const urlRegex = require('url-regex');
const URL = require('url');
const generate = require('nanoid/generate');
const useragent = require('useragent');
const geoip = require('geoip-lite');
const bcrypt = require('bcryptjs');
const subDay = require('date-fns/sub_days');
const {
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
  urlCountFromDate,
} = require('../db/url');

const { addProtocol, generateShortUrl } = require('../utils');
const config = require('../config');

const generateId = async () => {
  const id = generate('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890', 6);
  const urls = await findUrl({ id });
  if (!urls.length) return id;
  return generateId();
};

exports.urlShortener = async ({ body, user }, res) => {
  // Check if user has passed daily limit
  if (user) {
    const { count } = await urlCountFromDate({
      email: user.email,
      date: subDay(new Date(), 1).toJSON(),
    });
    if (count > config.USER_LIMIT_PER_DAY) {
      return res.status(429).json({
        error: `You have reached your daily limit (${config.USER_LIMIT_PER_DAY}). Please wait 24h.`,
      });
    }
  }

  // if "reuse" is true, try to return
  // the existent URL without creating one
  if (user && body.reuse) {
    const urls = await findUrl({ target: addProtocol(body.target) });
    if (urls.length) {
      urls.sort((a, b) => a.createdAt > b.createdAt);
      const { domain: d, user: u, ...url } = urls[urls.length - 1];
      const data = {
        ...url,
        password: !!url.password,
        reuse: true,
        shortUrl: generateShortUrl(url.id, user.domain),
      };
      return res.json(data);
    }
  }

  // Check if custom URL already exists
  if (user && body.customurl) {
    const urls = await findUrl({ id: body.customurl || '' });
    if (urls.length) {
      const urlWithNoDomain = !user.domain && urls.some(url => !url.domain);
      const urlWithDmoain = user.domain && urls.some(url => url.domain === user.domain);
      if (urlWithNoDomain || urlWithDmoain) {
        return res.status(400).json({ error: 'Custom URL is already in use.' });
      }
    }
  }

  // Create new URL
  const id = (user && body.customurl) || (await generateId());
  const target = addProtocol(body.target);
  const url = await createShortUrl({ ...body, id, target, user });

  return res.json(url);
};

const browsersList = ['IE', 'Firefox', 'Chrome', 'Opera', 'Safari', 'Edge'];
const osList = ['Windows', 'Mac Os X', 'Linux', 'Chrome OS', 'Android', 'iOS'];
const botList = ['bot', 'dataminr', 'pinterest', 'yahoo', 'facebook', 'crawl'];
const filterInBrowser = agent => item =>
  agent.family.toLowerCase().includes(item.toLocaleLowerCase());
const filterInOs = agent => item =>
  agent.os.family.toLowerCase().includes(item.toLocaleLowerCase());

exports.goToUrl = async (req, res, next) => {
  const { host } = req.headers;
  const reqestedId = req.params.id || req.body.id;
  const id = reqestedId.replace('+', '');
  const domain = host !== config.DEFAULT_DOMAIN && host;
  const agent = useragent.parse(req.headers['user-agent']);
  const [browser = 'Other'] = browsersList.filter(filterInBrowser(agent));
  const [os = 'Other'] = osList.filter(filterInOs(agent));
  const referrer = req.header('Referer') && URL.parse(req.header('Referer')).hostname;
  const location = geoip.lookup(req.realIp);
  const country = location && location.country;
  const urls = await findUrl({ id, domain });
  const isBot =
    botList.some(bot => agent.source.toLowerCase().includes(bot)) || agent.family === 'Other';
  if (!urls && !urls.length) return next();
  const url = urls.find(item => (domain ? item.domain === domain : !item.domain));
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
      await createVisit({
        browser,
        country: country || 'Unknown',
        domain,
        id: url.id,
        os,
        referrer: referrer || 'Direct',
      });
    }
    return res.status(200).json({ target: url.target });
  }
  if (url.user && !isBot) {
    await createVisit({
      browser,
      country: country || 'Unknown',
      domain,
      id: url.id,
      os,
      referrer: referrer || 'Direct',
    });
  }
  return res.redirect(url.target);
};

exports.getUrls = async ({ query, user }, res) => {
  const { countAll } = await getCountUrls({ user });
  const urlsList = await getUrls({ options: query, user });
  return res.json({ ...urlsList, countAll });
};

exports.setCustomDomain = async ({ body: { customDomain }, user }, res) => {
  if (customDomain.length > 40) {
    return res.status(400).json({ error: 'Maximum custom domain length is 40.' });
  }
  if (customDomain === config.DEFAULT_DOMAIN) {
    return res.status(400).json({ error: "You can't use default domain." });
  }
  const isValidDomain = urlRegex({ exact: true, strict: false }).test(customDomain);
  if (!isValidDomain) return res.status(400).json({ error: 'Domain is not valid.' });
  const isOwned = await getCustomDomain({ customDomain });
  if (isOwned && isOwned.email !== user.email) {
    return res
      .status(400)
      .json({ error: 'Domain is already taken. Contact us for multiple users.' });
  }
  const userCustomDomain = await setCustomDomain({ user, customDomain });
  if (userCustomDomain) return res.status(201).json({ customDomain: userCustomDomain.name });
  return res.status(400).json({ error: "Couldn't set custom domain." });
};

exports.deleteCustomDomain = async ({ user }, res) => {
  const response = await deleteCustomDomain({ user });
  if (response) return res.status(200).json({ message: 'Domain deleted successfully' });
  return res.status(400).json({ error: "Couldn't delete custom domain." });
};

exports.deleteUrl = async ({ body: { id, domain }, user }, res) => {
  if (!id) return res.status(400).json({ error: 'No id has been provided.' });
  const customDomain = domain !== config.DEFAULT_DOMAIN && domain;
  const urls = await findUrl({ id, domain: customDomain });
  if (!urls && !urls.length) return res.status(400).json({ error: "Couldn't find the short URL." });
  const response = await deleteUrl({ id, domain: customDomain, user });
  if (response) return res.status(200).json({ message: 'Sort URL deleted successfully' });
  return res.status(400).json({ error: "Couldn't delete short URL." });
};

exports.getStats = async ({ query: { id, domain }, user }, res) => {
  if (!id) return res.status(400).json({ error: 'No id has been provided.' });
  const customDomain = domain !== config.DEFAULT_DOMAIN && domain;
  const stats = await getStats({ id, domain: customDomain, user });
  if (!stats) return res.status(400).json({ error: 'Could not get the short URL stats.' });
  return res.status(200).json(stats);
};
