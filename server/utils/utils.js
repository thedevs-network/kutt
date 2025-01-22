const { differenceInDays, differenceInHours, differenceInMonths, differenceInMilliseconds, addDays, subHours, subDays, subMonths, subYears, format } = require("date-fns");
const { customAlphabet } = require("nanoid");
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

const urlRegex = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z0-9\u00a1-\uffff][a-z0-9\u00a1-\uffff_-]{0,62})?[a-z0-9\u00a1-\uffff]\.)+(?:[a-z\u00a1-\uffff]{2,}\.?))(?::\d{2,5})?(?:[/?#]\S*)?$/i;

const charsNeedEscapeInRegExp = ".$*+?()[]{}|^-";
const customAlphabetEscaped = env.LINK_CUSTOM_ALPHABET
  .split("").map(c => charsNeedEscapeInRegExp.includes(c) ? "\\" + c : c).join("");
const customAlphabetRegex = new RegExp(`^[${customAlphabetEscaped}_-]+$`);
const customAddressRegex = new RegExp("^[a-zA-Z0-9-_]+$");

function isAdmin(user) {
  return user.role === ROLES.ADMIN;
}

function signToken(user) {
  return JWT.sign(
      {
        iss: "ApiAuth",
        sub: user.id,
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
  const address = nanoid();
  const link = await query.link.find({ address, domain_id });
  if (link) {
    return generateId(query, domain_id)
  };
  return address;
}

function addProtocol(url) {
  const hasProtocol = /^(\w+:|\/\/)/.test(url);
  return hasProtocol ? url : "http://" + url;
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
  throw new Error("Unknown type.");
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
const MINUTE = 60,
      HOUR = MINUTE * 60,
      DAY = HOUR * 24,
      WEEK = DAY * 7,
      MONTH = DAY * 30,
      YEAR = DAY * 365;
function getTimeAgo(dateString) {
  const date = new Date(dateString);
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
    return {
      ...link,
      ...timestamps,
      banned_by_id: undefined,
      domain_id: undefined,
      user_id: undefined,
      uuid: undefined,
      banned: !!link.banned,
      id: link.uuid,
      relative_created_at: getTimeAgo(timestamps.created_at),
      relative_expire_in: link.expire_in && ms(differenceInMilliseconds(parseDatetime(link.expire_in), new Date()), { long: true }),
      password: !!link.password,
      visit_count: link.visit_count.toLocaleString("en-US"),
      link: getShortURL(link.address, link.domain),
    }
  },
  link_admin: link => {
    const timestamps = parseTimestamps(link);
    return {
      ...link,
      ...timestamps,
      domain: link.domain || env.DEFAULT_DOMAIN,
      id: link.uuid,
      relative_created_at: getTimeAgo(timestamps.created_at),
      relative_expire_in: link.expire_in && ms(differenceInMilliseconds(parseDatetime(link.expire_in), new Date()), { long: true }),
      password: !!link.password,
      visit_count: link.visit_count.toLocaleString("en-US"),
      link: getShortURL(link.address, link.domain)
    }
  },
  user_admin: user => {
    const timestamps = parseTimestamps(user);
    return {
      ...user,
      ...timestamps,
      links_count: (user.links_count ?? 0).toLocaleString("en-US"),
      relative_created_at: getTimeAgo(timestamps.created_at),
      relative_updated_at: getTimeAgo(timestamps.updated_at),
    }
  },
  domain_admin: domain => {
    const timestamps = parseTimestamps(domain);
    return {
      ...domain,
      ...timestamps,
      links_count: (domain.links_count ?? 0).toLocaleString("en-US"),
      relative_created_at: getTimeAgo(timestamps.created_at),
      relative_updated_at: getTimeAgo(timestamps.updated_at),
    }
  }
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
      const val = (blocks[name] || []).join("\n");
      blocks[name] = [];
      return val;
  });
  hbs.registerPartials(path.join(__dirname, "../views/partials"), function (err) {});
  const customPartialsPath = path.join(__dirname, "../../custom/views/partials");
  const customPartialsExist = fs.existsSync(customPartialsPath);
  if (customPartialsExist) {
    hbs.registerPartials(customPartialsPath, function (err) {});
  }
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
  getCustomCSSFileNames,
  getDifferenceFunction,
  getInitStats,
  getShortURL,
  getStatsPeriods,
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