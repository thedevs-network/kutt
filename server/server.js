const env = require("./env");

const cookieParser = require("cookie-parser");
const passport = require("passport");
const express = require("express");
const helmet = require("helmet");
const path = require("node:path");
const hbs = require("hbs");

const helpers = require("./handlers/helpers.handler");
const renders = require("./handlers/renders.handler");
const asyncHandler = require("./utils/asyncHandler");
const locals = require("./handlers/locals.handler");
const links = require("./handlers/links.handler");
const routes = require("./routes");
const utils = require("./utils");
const i18n = require("i18n");

// run the cron jobs
// the app might be running in cluster mode (multiple instances) so run the cron job only on one cluster (the first one)
// NODE_APP_INSTANCE variable is added by pm2 automatically, if you're using something else to cluster your app, then make sure to set this variable
if (env.NODE_APP_INSTANCE === 0) {
  require("./cron");
}

// intialize passport authentication library
require("./passport");

// create express app
const app = express();

// this tells the express app that it's running behind a proxy server
// and thus it should get the IP address from the proxy server
if (env.TRUST_PROXY) {
  app.set("trust proxy", true);
}

i18n.configure({
  locales: ["en", "zh_CN","zh_TW"],
  defaultLocale: "en",
  directory: path.join(__dirname, "locales"),
  objectNotation: true,
});
app.use(i18n.init);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// serve static
app.use("/images", express.static("custom/images"));
app.use("/css", express.static("custom/css", { extensions: ["css"] }));
app.use(express.static("static"));

app.use(passport.initialize());
app.use(locals.isHTML);
app.use(locals.config);

// template engine / serve html

app.set("view engine", "hbs");
app.set("views", [
  path.join(__dirname, "../custom/views"),
  path.join(__dirname, "views"),
]);
utils.registerHandlebarsHelpers();

const localeMapping = {
  zh_CN: { code: "zh_CN", name: "简体中文" },
  zh_TW: { code: "zh_TW", name: "繁體中文" },
  en: { code: "en", name: "English" },
  en_US: { code: "en_US", name: "English (US)" },
  en_GB: { code: "en_GB", name: "English (UK)" },
  fr: { code: "fr", name: "Français" },
  fr_FR: { code: "fr_FR", name: "Français (France)" },
  de: { code: "de", name: "Deutsch" },
  de_DE: { code: "de_DE", name: "Deutsch (Deutschland)" },
  es: { code: "es", name: "Español" },
  es_ES: { code: "es_ES", name: "Español (España)" },
  ja: { code: "ja", name: "日本語" },
  ja_JP: { code: "ja_JP", name: "日本語 (日本)" },
  ko: { code: "ko", name: "한국어" },
  ko_KR: { code: "ko_KR", name: "한국어 (대한민국)" },
  ru: { code: "ru", name: "Русский" },
  ru_RU: { code: "ru_RU", name: "Русский (Россия)" },
  it: { code: "it", name: "Italiano" },
  it_IT: { code: "it_IT", name: "Italiano (Italia)" },
  pt: { code: "pt", name: "Português" },
  pt_BR: { code: "pt_BR", name: "Português (Brasil)" },
  ar: { code: "ar", name: "العربية" },
  ar_SA: { code: "ar_SA", name: "العربية (السعودية)" },
  hi: { code: "hi", name: "हिन्दी" },
  hi_IN: { code: "hi_IN", name: "हिन्दी (भारत)" },
};
app.use((req, res, next) => {
  var filterPaths = ["/images", "/css", "/js", "/api"];
  if (filterPaths.some((path) => req.path.includes(path))) {
    return next();
  }

  const langFromCookie = req.cookies.lang;
  const lang = req.query.lang || langFromCookie;
  if (lang && Object.keys(localeMapping).includes(lang)) {
    i18n.setLocale(lang);
    res.locals.currentLocale = lang;
    res.cookie("lang", lang, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
    });
  } else {
    res.locals.currentLocale = i18n.getLocale();
  }
  res.locals.formattedLocales = i18n
    .getLocales()
    .map((locale) => localeMapping[locale] || { code: locale, name: locale });
  next();
});

// if is custom domain, redirect to the set homepage
app.use(asyncHandler(links.redirectCustomDomainHomepage));

// render html pages
app.use("/", routes.render);

// handle api requests
app.use("/api/v2", routes.api);
app.use("/api", routes.api);

// finally, redirect the short link to the target
app.get("/:id", asyncHandler(links.redirect));

// 404 pages that don't exist
app.get("*", renders.notFound);

// handle errors coming from above routes
app.use(helpers.error);

app.listen(env.PORT, () => {
  console.log(`> Ready on http://localhost:${env.PORT}`);
});
