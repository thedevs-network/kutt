const ms = require('ms');
const { differenceInDays, differenceInHours, differenceInMonths } = require('date-fns');

exports.addProtocol = url => {
  const hasProtocol = /^\w+:\/\//.test(url);
  return hasProtocol ? url : `http://${url}`;
};

exports.generateShortUrl = (id, domain, useHttps) => {
  const protocol = useHttps || !domain ? 'https://' : 'http://';
  return `${protocol}${domain || process.env.DEFAULT_DOMAIN}/${id}`;
};

exports.isAdmin = email =>
  process.env.ADMIN_EMAILS.split(',')
    .map(e => e.trim())
    .includes(email);

exports.getStatsLimit = url =>
  url.user.statsLimit || Number(process.env.DEFAULT_MAX_STATS_PER_LINK) || 10000000;

exports.getStatsCacheTime = total => {
  switch (true) {
    case total <= 5000:
      return ms('5 minutes') / 1000;

    case total > 5000 && total < 20000:
      return ms('10 minutes') / 1000;

    case total < 40000:
      return ms('15 minutes') / 1000;

    case total > 40000:
      return ms('30 minutes') / 1000;

    default:
      return ms('5 minutes') / 1000;
  }
};

exports.statsObjectToArray = item => {
  const objToArr = key =>
    Array.from(Object.keys(item[key]))
      .map(name => ({
        name,
        value: item[key][name],
      }))
      .sort((a, b) => b.value - a.value);

  return {
    browser: objToArr('browser'),
    os: objToArr('os'),
    country: objToArr('country'),
    referrer: objToArr('referrer'),
  };
};

exports.getDifferenceFunction = type => {
  switch (type) {
    case 'lastDay':
      return differenceInHours;

    case 'lastWeek':
      return differenceInDays;

    case 'lastMonth':
      return differenceInDays;

    case 'allTime':
      return differenceInMonths;

    default:
      return null;
  }
};

const getUTCDate = (dateString = Date.now()) => {
  const date = new Date(dateString);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
};

exports.getUTCDate = getUTCDate;
