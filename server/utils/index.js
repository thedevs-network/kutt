const URL = require('url');
const ms = require('ms');
const config = require('../config');

exports.addProtocol = url => {
  const hasProtocol = /^https?/.test(URL.parse(url).protocol);
  return hasProtocol ? url : `http://${url}`;
};

exports.generateShortUrl = (id, domain) =>
  `http${!domain ? 's' : ''}://${domain || config.DEFAULT_DOMAIN}/${id}`;

exports.isAdmin = email => config.ADMIN_EMAILS.includes(email);

exports.getStatsCacheTime = total => {
  switch (true) {
    case total > 5000 && total < 20000:
      return ms('1 hour') / 1000;

    case total < 40000:
      return ms('3 hours') / 1000;

    case total > 40000:
      return ms('6 hours') / 1000;

    default:
      return ms('15 minutes') / 1000;
  }
};
