const { differenceInDays, differenceInHours, differenceInMonths, differenceInMilliseconds, addDays, subHours, subDays, subMonths, subYears } = require("date-fns");
const nanoid = require("nanoid/generate");
const JWT = require("jsonwebtoken");
const path = require("path");
const hbs = require("hbs");
const ms = require("ms");
const knexUtils = require('./knex')

const env = require("../env");

class CustomError extends Error {
  constructor(message, statusCode, data) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode ?? 500;
    this.data = data;
  }
}

const urlRegex = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i;

function isAdmin(email) {
  return env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim())
    .includes(email)
}

function signToken(user) {
  return JWT.sign(
      {
        iss: "ApiAuth",
        sub: user.email,
        domain: user.domain || "",
        iat: parseInt((new Date().getTime() / 1000).toFixed(0)),
        exp: parseInt((addDays(new Date(), 7).getTime() / 1000).toFixed(0))
      },
      env.JWT_SECRET
    )
}

function setToken(res, token) {
  res.cookie("token", token, {
    maxAge: 1000 * 60 * 60 * 24 * 7, // expire after seven days
    httpOnly: true,
    secure: env.isProd
  });
}

function deleteCurrentToken(res) {
  res.clearCookie("token", { httpOnly: true, secure: env.isProd });
}

async function generateId(query, domain_id) {
  const address = nanoid(
    "abcdefghkmnpqrstuvwxyzABCDEFGHKLMNPQRSTUVWXYZ23456789",
    env.LINK_LENGTH
  );
  const link = await query.link.find({ address, domain_id });
  if (!link) return address;
  return generateId(domain_id);
}

function addProtocol(url) {
  const hasProtocol = /^(\w+:|\/\/)/.test(url);
  return hasProtocol ? url : "http://" + url;
}

function getShortURL(address, domain) {
  const protocol = (env.CUSTOM_DOMAIN_USE_HTTPS || !domain) && !env.isDev ? "https://" : "http://";
  const link = `${domain || env.DEFAULT_DOMAIN}/${address}`;
  const url = `${protocol}${link}`;
  return { link, url };
}

const getRedisKey = {
  // TODO: remove user id and make domain id required
  link: (address, domain_id, user_id) => `${address}-${domain_id || ""}-${user_id || ""}`,
  domain: (address) => `d-${address}`,
  host: (address) => `h-${address}`,
  user: (emailOrKey) => `u-${emailOrKey}`
};

function getStatsLimit() {
  return env.DEFAULT_MAX_STATS_PER_LINK || 100000000;
};

function getStatsCacheTime(total) {
  return (total > 50000 ? ms("5 minutes") : ms("1 minutes")) / 1000
};

function statsObjectToArray(obj) {
  const objToArr = (key) =>
    Array.from(Object.keys(obj[key]))
      .map((name) => ({
        name,
        value: obj[key][name]
      }))
      .sort((a, b) => b.value - a.value);
  
  return {
    browser: objToArr("browser"),
    os: objToArr("os"),
    country: objToArr("country"),
    referrer: objToArr("referrer")
  };
}

function getDifferenceFunction(type) {
  if (type === "lastDay") return differenceInHours;
  if (type === "lastWeek") return differenceInDays;
  if (type === "lastMonth") return differenceInDays;
  if (type === "lastYear") return differenceInMonths;
  throw new Error("Unknown type.");
}

function getUTCDate(dateString) {
  const date = new Date(dateString || Date.now());
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours()
  );
}

function getStatsPeriods(now) {
  return [
    ["lastDay", subHours(now, 24)],
    ["lastWeek", subDays(now, 7)],
    ["lastMonth", subDays(now, 30)],
    ["lastYear", subMonths(now, 12)],
  ]
}

const preservedURLs = [
  "login",
  "logout",
  "404",
  "settings",
  "stats",
  "signup",
  "banned",
  "report",
  "reset-password",
  "resetpassword",
  "verify-email",
  "verifyemail",
  "verify",
  "terms",
  "confirm-link-delete",
  "confirm-link-ban",
  "add-domain-form",
  "confirm-domain-delete",
  "get-report-email",
  "link",
  "url-password",
  "url-info",
  "api",
  "static",
  "images",
  "privacy",
  "protected",
  "css",
  "fonts",
  "libs",
  "pricing"
];

function getInitStats() {
  return Object.create({
    browser: {
      chrome: 0,
      edge: 0,
      firefox: 0,
      ie: 0,
      opera: 0,
      other: 0,
      safari: 0
    },
    os: {
      android: 0,
      ios: 0,
      linux: 0,
      macos: 0,
      other: 0,
      windows: 0
    },
    country: {},
    referrer: {}
  });
}

// format date to relative date
const MINUTE = 60,
      HOUR = MINUTE * 60,
      DAY = HOUR * 24,
      WEEK = DAY * 7,
      MONTH = DAY * 30,
      YEAR = DAY * 365;
function getTimeAgo(date) {
  const secondsAgo = Math.round((Date.now() - Number(date)) / 1000);

  if (secondsAgo < MINUTE) {
    return `${secondsAgo} second${secondsAgo !== 1 ? "s" : ""} ago`;
  }

  let divisor;
  let unit = "";

  if (secondsAgo < HOUR) {
    [divisor, unit] = [MINUTE, "minute"];
  } else if (secondsAgo < DAY) {
    [divisor, unit] = [HOUR, "hour"];
  } else if (secondsAgo < WEEK) {
    [divisor, unit] = [DAY, "day"];
  } else if (secondsAgo < MONTH) {
    [divisor, unit] = [WEEK, "week"];
  } else if (secondsAgo < YEAR) {
    [divisor, unit] = [MONTH, "month"];
  } else {
    [divisor, unit] = [YEAR, "year"];
  }

  const count = Math.floor(secondsAgo / divisor);
  return `${count} ${unit}${count > 1 ? "s" : ""} ago`;
}


const sanitize = {
  domain: domain => ({
    ...domain,
    id: domain.uuid,
    uuid: undefined,
    user_id: undefined,
    banned_by_id: undefined
  }),
  link: link => ({
    ...link,
    banned_by_id: undefined,
    domain_id: undefined,
    user_id: undefined,
    uuid: undefined,
    id: link.uuid,
    relative_created_at: getTimeAgo(link.created_at),
    relative_expire_in: link.expire_in && ms(differenceInMilliseconds(new Date(link.expire_in), new Date()), { long: true }),
    password: !!link.password,
    link: getShortURL(link.address, link.domain)
  })
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function removeWww(host) {
  return host.replace("www.", "");
};

function registerHandlebarsHelpers() {
  hbs.registerHelper("ifEquals", function(arg1, arg2, options) {
    return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
  });

  hbs.registerHelper("json", function(context) {
    return JSON.stringify(context);
  });
  
  const blocks = {};

  hbs.registerHelper("extend", function(name, context) {
      let block = blocks[name];
      if (!block) {
          block = blocks[name] = [];
      }
      block.push(context.fn(this));
  });

  hbs.registerHelper("block", function(name) {
      const val = (blocks[name] || []).join('\n');
      blocks[name] = [];
      return val;
  });
  hbs.registerPartials(path.join(__dirname, "../views/partials"), function (err) {});
}

module.exports = {
  addProtocol,
  CustomError,
  deleteCurrentToken,
  generateId,
  getDifferenceFunction,
  getInitStats,
  getRedisKey,
  getShortURL,
  getStatsCacheTime,
  getStatsLimit,
  getStatsPeriods,
  getUTCDate,
  isAdmin,
  preservedURLs,
  registerHandlebarsHelpers,
  removeWww,
  sanitize,
  setToken,
  signToken,
  sleep,
  statsObjectToArray,
  urlRegex,
  ...knexUtils,
}