const URL = require('url');

exports.addProtocol = url => {
  const hasProtocol = /^https?/.test(URL.parse(url).protocol);
  return hasProtocol ? url : `http://${url}`;
};
