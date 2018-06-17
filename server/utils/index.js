const URL = require('url');
const config = require('../config');

exports.addProtocol = url => {
  const hasProtocol = /^https?/.test(URL.parse(url).protocol);
  return hasProtocol ? url : `http://${url}`;
};

exports.generateShortUrl = (id, domain) =>
  `http${!domain ? 's' : ''}://${domain || config.DEFAULT_DOMAIN}/${id}`;
