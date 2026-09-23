const i18n = require("../i18n");
const { differenceInDays, differenceInHours, differenceInMonths, differenceInMilliseconds, addDays, subHours, subDays, subMonths, subYears, format } = require("date-fns");
const { customAlphabet } = require("nanoid");
const crypto = require("node:crypto");
const JWT = require("jsonwebtoken");
const path = require("node:path");
const fs = require("node:fs");
const hbs = require("hbs");
const ms = require("ms");

const { ROLES } = require("../consts");
const knexUtils = require("./knex");
const knex = require("../knex");
const env = require("../env");

const nanoid = customAlphabet(env.LINK_CUSTOM_ALPHABET, env.LINK_LENGTH);

class CustomError extends Error {
  constructor(message, statusCode, data) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode ?? 500;
    this.data = data;
  }
}

// Userinfo is a single non-space run; overlapping repetitions caused quadratic backtracking.
const urlRegex = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i;

const charsNeedEscapeInRegExp = ".$*+?()[]{}|^-";
const customAlphabetEscaped = env.LINK_CUSTOM_ALPHABET
  .split("").map(c => charsNeedEscapeInRegExp.includes(c) ? "\\" + c : c).join("");
const customAlphabetRegex = new RegExp(`^[${customAlphabetEscaped}_-]+$`);
const customAddressRegex = new RegExp("^[a-zA-Z0-9-_]+$");

function isAdmin(user) {
  return user.role === ROLES.ADMIN;
}

function signToken(user, context = {}) {
  const now = Math.floor(Date.now() / 1000);
  const oidc = context.oi ? { oi: context.oi, os: context.os || null, oa: context.oa } : {};
  return JWT.sign(
      {
        iss: "ApiAuth",
        sub: user.id,
        av: Number(user.auth_version || 0),
        ...oidc,
        iat: now,
        exp: context.oi ? Math.min(now + 7 * 86400, Math.floor(context.oa / 1000) + env.OIDC_SESSION_MAX_SECONDS) : now + 7 * 86400
      },
      env.JWT_SECRET
    )
}

function setToken(res, token) {
  res.cookie("token", token, {
    maxAge: 1000 * 60 * 60 * 24 * 7, // expire after seven days
    httpOnly: true,
    secure: require("../management-origin").secureCookie(),
    sameSite: "Lax",
    path: "/"
  });
}

function deleteCurrentToken(res) {
  res.clearCookie("token", { httpOnly: true, secure: require("../management-origin").secureCookie(), sameSite: "Lax", path: "/" });
}

function generateRandomPassword() {
  // 24-64 characters.
  const length = Math.floor(Math.random() * 41 ) + 24;
  return [...crypto.randomBytes(length)].map(byte => String.fromCharCode((byte % 93) + 33)).join("");
}

async function generateId(query, domain_id) {
  // Custom alphabets may generate unsafe dot segments or reserved root names.
  for (let attempt = 0; attempt < 100; attempt++) {
    const address = nanoid();
    if (!require("../link-alias").valid(address)) continue;
    if (!await require("../link-history").reserved(address, domain_id)) return address;
  }
  throw new CustomError(i18n.t("aliases.generation_failed"), 503);
}

function addProtocol(url) {
  const hasProtocol = /^(\w+:|\/\/)/.test(url);
  return hasProtocol ? url : "http://" + url;
}

function getSiteURL() {
  return require("../management-origin").origin();
}

function getShortURL(address, domain) {
  const protocol = (env.CUSTOM_DOMAIN_USE_HTTPS || !domain) && !env.isDev ? "https://" : "http://";
  const link = `${domain || env.DEFAULT_DOMAIN}/${address}`;
  const url = `${protocol}${link}`;
  return { address, link, url };
}

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
  throw new Error(i18n.t("messages.unknown_type"));
}

function parseDatetime(date) {
  // because postgres and mysql return date, sqlite returns formatted iso 8601 string in utc
  return date instanceof Date ? date : new Date(date + "Z");
}

function parseTimestamps(item) {
  return {
    created_at: parseDatetime(item.created_at),
    updated_at: parseDatetime(item.updated_at),
  }
}

function dateToUTC(date) {
  const dateUTC = date instanceof Date ? date.toISOString() : new Date(date).toISOString();

  // format the utc date in 'YYYY-MM-DD hh:mm:ss' for SQLite
  if (knex.isSQLite) {
    return dateUTC.substring(0, 10) + " " + dateUTC.substring(11, 19);
  }
  
  // mysql doesn't save time in utc, so format the date in local timezone instead
  if (knex.isMySQL) {
    return format(new Date(date), "yyyy-MM-dd HH:mm:ss");
  }
  
  // return unformatted utc string for postgres
  return dateUTC;
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
  "language",
  "locales",
  "login",
  "logout",
  "create-admin",
  "404",
  "settings",
  "admin",
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
  "confirm-user-delete",
  "confirm-user-ban",
  "create-user",
  "confirm-domain-delete-admin",
  "confirm-domain-ban",
  "add-domain-form",
  "confirm-domain-delete",
  "get-report-email",
  "get-support-email",
  "link",
  "admin",
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

function parseBooleanQuery(query) {
  if (query === "true" || query === true) return true;
  if (query === "false" || query === false) return false;
  return undefined;
}

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
function getTimeAgo(dateString) {
  return i18n.ago(dateString);
}


const sanitize = {
  domain: domain => ({
    ...domain,
    ...parseTimestamps(domain),
    id: domain.uuid,
    banned: !!domain.banned,
    homepage: domain.homepage || env.DEFAULT_DOMAIN,
    uuid: undefined,
    user_id: undefined,
    banned_by_id: undefined
  }),
  link: link => {
    const timestamps = parseTimestamps(link);
    return {
      ...link,
      ...timestamps,
      ...require("../link-lifecycle").describe(link),
      banned_by_id: undefined,
      domain_id: undefined,
      user_id: undefined,
      uuid: undefined,
      banned: !!link.banned,
      id: link.uuid,
      password: !!link.password,
      link: getShortURL(link.address, link.domain).url,
    }
  },
  link_html: link => {
    const timestamps = parseTimestamps(link);
    const remaining = link.expire_in && differenceInMilliseconds(parseDatetime(link.expire_in), new Date());
    const relativeExpiry = link.expire_in && ms(remaining, { long: true });
    return {
      ...link,
      ...timestamps,
      ...require("../link-lifecycle").describe(link),
      banned_by_id: undefined,
      domain_id: undefined,
      user_id: undefined,
      uuid: undefined,
      banned: !!link.banned,
      id: link.uuid,
      relative_created_at: getTimeAgo(timestamps.created_at),
      relative_expire_in: relativeExpiry,
      relative_expire_label: link.expire_in && i18n.duration(remaining),
      expiry_snapshot: require("../link-expiry-edit").snapshot(link, relativeExpiry),
      password: !!link.password,
      visit_count: i18n.number(link.visit_count),
      link: getShortURL(link.address, link.domain),
    }
  },
  link_admin: link => {
    const timestamps = parseTimestamps(link);
    const remaining = link.expire_in && differenceInMilliseconds(parseDatetime(link.expire_in), new Date());
    const relativeExpiry = link.expire_in && ms(remaining, { long: true });
    return {
      ...link,
      ...timestamps,
      ...require("../link-lifecycle").describe(link),
      domain: link.domain || env.DEFAULT_DOMAIN,
      id: link.uuid,
      relative_created_at: getTimeAgo(timestamps.created_at),
      relative_expire_in: relativeExpiry,
      relative_expire_label: link.expire_in && i18n.duration(remaining),
      expiry_snapshot: require("../link-expiry-edit").snapshot(link, relativeExpiry),
      password: !!link.password,
      visit_count: i18n.number(link.visit_count),
      link: getShortURL(link.address, link.domain)
    }
  },
  user_admin: user => {
    const timestamps = parseTimestamps(user);
    return {
      ...user,
      ...timestamps,
      links_count: i18n.number(user.links_count ?? 0),
      relative_created_at: getTimeAgo(timestamps.created_at),
      relative_updated_at: getTimeAgo(timestamps.updated_at),
    }
  },
  domain_admin: domain => {
    const timestamps = parseTimestamps(domain);
    return {
      ...domain,
      ...timestamps,
      links_count: i18n.number(domain.links_count ?? 0),
      relative_created_at: getTimeAgo(timestamps.created_at),
      relative_updated_at: getTimeAgo(timestamps.updated_at),
    }
  }
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function removeWww(host) {
  return host?.replace(/^www\./, "");
};

/**
 * @param { ReturnType<import("express-useragent").default["parse"]> } agent
 * @returns {string}
 */
function getUseragentBrowser(agent) {
  if (agent.isIE) 
    return "ie";
  else if (agent.isFirefox)
    return "firefox";
  else if (agent.isChrome)
    return "chrome";
  else if (agent.isOpera)
    return "opera";
  else if (agent.isEdge)
    return "edge";
  else if (agent.isSafari)
    return "safari";
  else
    return "other";
}

/**
 * @param { ReturnType<import("express-useragent").default["parse"]> } agent
 * @returns {string}
 */
function getUseragentOS(agent) {
  if (agent.isWindows)
    return "windows";
  else if (agent.isMac && agent.isDesktop)
    return "macos";
  else if (agent.isiPhone || agent.isiPad || agent.isiPod)
    return "ios";
  else if (agent.isMac && agent.isMobile)
    return "ios";
  else if (agent.isAndroid)
    return "android";
  else if (agent.isLinux)
    return "linux";
  else
    return "other";
}

function registerHandlebarsHelpers() {
  hbs.registerHelper("hasNextPage", function(total, limit, skip) {
    return Number(total) > Number(skip || 0) + Number(limit || 10);
  });
  hbs.registerHelper("ifEquals", function(arg1, arg2, options) {
    return (arg1 === arg2) ? options.fn(this) : options.inverse(this);
  });

  hbs.registerHelper("json", function(context) {
    return JSON.stringify(context);
  });
  
  const renderBlocks = options => i18n.blocks() || (options.data.root._i18nBlocks ||= {});

  hbs.registerHelper("extend", function(name, context) {
      const blocks = renderBlocks(context);
      let block = blocks[name];
      if (!block) {
          block = blocks[name] = [];
      }
      block.push(context.fn(this));
  });

  hbs.registerHelper("block", function(name, options) {
      const blocks = renderBlocks(options);
      const val = (blocks[name] || []).join("\n");
      blocks[name] = [];
      return val;
  });
  return require("../template-partials")(hbs, path.join(__dirname, "../views/partials"), path.join(__dirname, "../../custom/views/partials"));
}

// grab custom styles file name from the custom/css folder
const custom_css_file_names = [];
const customCSSPath = path.join(__dirname, "../../custom/css");
const customCSSExists = fs.existsSync(customCSSPath);
if (customCSSExists) {
  fs.readdir(customCSSPath, function(error, files) {
    if (error) {
      console.warn("Could not read the custom CSS folder:", error);
    } else {
      files.forEach(function(file_name) {
        custom_css_file_names.push(file_name);
      });
    }
  })
}

function getCustomCSSFileNames() {
  return custom_css_file_names;
}

module.exports = {
  addProtocol,
  customAddressRegex,
  customAlphabetRegex,
  CustomError,
  dateToUTC,
  deleteCurrentToken,
  generateId,
  generateRandomPassword,
  getCustomCSSFileNames,
  getDifferenceFunction,
  getInitStats,
  getShortURL,
  getSiteURL,
  getStatsPeriods,
  getUseragentBrowser,
  getUseragentOS,
  isAdmin,
  parseBooleanQuery,
  parseDatetime,
  parseTimestamps,
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
