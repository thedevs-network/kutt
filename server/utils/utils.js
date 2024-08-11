const ms = require("ms");
const path = require("path");
const nanoid = require("nanoid/generate");
const JWT = require("jsonwebtoken");
const { differenceInDays, differenceInHours, differenceInMonths, addDays } = require("date-fns");
const hbs = require("hbs");

const env = require("../env");

class CustomError extends Error {
  constructor(message, statusCode, data) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode ?? 500;
    this.data = data;
  }
}

const query = require("../queries");

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
        admin: isAdmin(user.email),
        iat: parseInt((new Date().getTime() / 1000).toFixed(0)),
        exp: parseInt((addDays(new Date(), 7).getTime() / 1000).toFixed(0))
      },
      env.JWT_SECRET
    )
}

async function generateId(domain_id) {
  const address = nanoid(
    "abcdefghkmnpqrstuvwxyzABCDEFGHKLMNPQRSTUVWXYZ23456789",
    env.LINK_LENGTH
  );
  const link = await query.link.find({ address, domain_id });
  if (!link) return address;
  return generateId(domain_id);
}

function addProtocol(url) {
  const hasProtocol = /^\w+:\/\//.test(url);
  return hasProtocol ? url : `http://${url}`;
}

function getShortURL(id, domain) {
  const protocol = env.CUSTOM_DOMAIN_USE_HTTPS || !domain ? "https://" : "http://";
  const link = `${domain || env.DEFAULT_DOMAIN}/${id}`;
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
  if (type === "allTime") return differenceInMonths;
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

const STATS_PERIODS = [
  [1, "lastDay"],
  [7, "lastWeek"],
  [30, "lastMonth"]
];

const preservedURLs = [
  "login",
  "logout",
  "signup",
  "reset-password",
  "resetpassword",
  "url-password",
  "url-info",
  "settings",
  "stats",
  "verify",
  "api",
  "404",
  "static",
  "images",
  "banned",
  "terms",
  "privacy",
  "protected",
  "report",
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

function extendHbs() {
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
  generateId,
  getShortURL,
  getDifferenceFunction,
  getInitStats,
  getRedisKey,
  getStatsCacheTime,
  getStatsLimit,
  getUTCDate,
  extendHbs,
  isAdmin,
  preservedURLs,
  removeWww,
  sanitize,
  signToken,
  sleep,
  STATS_PERIODS,
  statsObjectToArray,
}