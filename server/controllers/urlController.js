const urlRegex = require('url-regex');
const URL = require('url');
const useragent = require('useragent');
const geoip = require('geoip-lite');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const {
  createShortUrl,
  createVisit,
  findUrl,
  getStats,
  getUrls,
  getCustomDomain,
  setCustomDomain,
  deleteCustomDomain,
  deleteUrl,
} = require('../db/url');
const config = require('../config');

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

exports.urlShortener = async ({ body, user }, res) => {
  if (!body.target) return res.status(400).json({ error: 'No target has been provided.' });
  if (body.target.length > 1024) {
    return res.status(400).json({ error: 'Maximum URL length is 1024.' });
  }
  const isValidUrl = urlRegex({ exact: true, strict: false }).test(body.target);
  if (!isValidUrl) return res.status(400).json({ error: 'URL is not valid.' });
  const hasProtocol = /^https?/.test(URL.parse(body.target).protocol);
  const target = hasProtocol ? body.target : `http://${body.target}`;
  if (body.password && body.password.length > 64) {
    return res.status(400).json({ error: 'Maximum password length is 64.' });
  }
  if (user && body.customurl) {
    if (!/^[a-zA-Z1-9-_]+$/g.test(body.customurl.trim())) {
      return res.status(400).json({ error: 'Custom URL is not valid.' });
    }
    if (preservedUrls.some(url => url === body.customurl)) {
      return res.status(400).json({ error: "You can't use this custom URL name." });
    }
    if (body.customurl.length > 64) {
      return res.status(400).json({ error: 'Maximum custom URL length is 64.' });
    }
    const urls = await findUrl({ id: body.customurl || '' });
    if (urls.length) {
      const urlWithNoDomain = !user.domain && urls.some(url => !url.domain);
      const urlWithDmoain = user.domain && urls.some(url => url.domain === user.domain);
      if (urlWithNoDomain || urlWithDmoain) {
        return res.status(400).json({ error: 'Custom URL is already in use.' });
      }
    }
  }
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
        threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING'],
        platformTypes: ['WINDOWS'],
        threatEntryTypes: ['URL'],
        threatEntries: [{ url: body.target }],
      },
    }
  );
  if (isMalware.data && isMalware.data.matches) {
    return res.status(400).json({ error: 'Malware detected!' });
  }
  const url = await createShortUrl({ ...body, target, user });
  return res.json(url);
};

const browsersList = ['IE', 'Firefox', 'Chrome', 'Opera', 'Safari', 'Edge'];
const osList = ['Windows', 'Mac Os X', 'Linux', 'Chrome OS', 'Android', 'iOS'];
const filterInBrowser = agent => item =>
  agent.family.toLowerCase().includes(item.toLocaleLowerCase());
const filterInOs = agent => item =>
  agent.os.family.toLowerCase().includes(item.toLocaleLowerCase());

exports.goToUrl = async (req, res, next) => {
  const { host } = req.headers;
  const id = req.params.id || req.body.id;
  const domain = host !== config.DEFAULT_DOMAIN && host;
  const agent = useragent.parse(req.headers['user-agent']);
  const [browser = 'Other'] = browsersList.filter(filterInBrowser(agent));
  const [os = 'Other'] = osList.filter(filterInOs(agent));
  const referrer = req.header('Referer') && URL.parse(req.header('Referer')).hostname;
  const location = geoip.lookup(req.realIp);
  const country = location && location.country;
  const urls = await findUrl({ id, domain });
  if (!urls && !urls.length) return next();
  const [url] = urls;
  if (url.password && !req.body.password) {
    req.protectedUrl = id;
    return next();
  }
  if (url.password) {
    const isMatch = await bcrypt.compare(req.body.password, url.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Password is not correct' });
    }
    if (url.user) {
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
  if (url.user) {
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

exports.getUrls = async ({ body, user }, res) => {
  const urlsList = await getUrls({ options: body, user });
  return res.json(urlsList);
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

exports.getStats = async ({ body: { id, domain }, user }, res) => {
  if (!id) return res.status(400).json({ error: 'No id has been provided.' });
  const customDomain = domain !== config.DEFAULT_DOMAIN && domain;
  const stats = await getStats({ id, domain: customDomain, user });
  if (!stats) return res.status(400).json({ error: 'Could not get the short URL stats.' });
  return res.status(200).json(stats);
};
