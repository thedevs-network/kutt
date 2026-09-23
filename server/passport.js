const i18n = require("./i18n");
const { Strategy: LocalAPIKeyStrategy } = require("passport-localapikey-update");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const { Strategy: LocalStrategy } = require("passport-local");
const passport = require("passport");
const bcrypt = require("bcryptjs");

const query = require("./queries");
const env = require("./env");
const utils = require("./utils")

const jwtOptions = {
  jwtFromRequest: req => req.cookies?.token,
  secretOrKey: env.JWT_SECRET
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      // 'sub' used to be the email address
      // this check makes sure to invalidate old JWTs where the sub is still the email address
      if (typeof payload.sub === "string" || !payload.sub) {
        return done(null, false);
      }
      // Authorization must not use the fifteen-minute user cache after revocation.
      const user = await require("./oidc-roles").fresh(await require("./knex")("users").where({ id: payload.sub }).first());
      if (!user) return done(null, false);
      if (!await require("./oidc-security").validSession(user, payload)) return done(null, false);
      return done(null, user, payload);
    } catch (err) {
      return done(err);
    }
  })
);

if (!env.DISALLOW_LOGIN_FORM) {
  const localOptions = {
    usernameField: "email"
  };
  
  passport.use(
    new LocalStrategy(localOptions, async (email, password, done) => {
      try {
        const user = await query.user.find({ email });
        if (!user) {
          return done(null, false);
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
          return done(null, false);
        }
        const current = await require("./oidc-roles").fresh(await require("./knex")("users").where({ id: user.id }).first());
        if (!current || current.password !== user.password || Number(current.auth_version) !== Number(user.auth_version)) return done(null, false);
        return done(null, current);
      } catch (err) {
        return done(err);
      }
    })
  );
}


const localAPIKeyOptions = {
  apiKeyField: "apikey",
  apiKeyHeader: "x-api-key"
};

passport.use(
  new LocalAPIKeyStrategy(localAPIKeyOptions, async (apikey, done) => {
    try {
      // Like browser sessions, API authentication must see current revocation state.
      const user = await require("./oidc-roles").fresh(await require("./knex")("users").where({ apikey }).first());
      if (!user || user.apikey !== apikey) {
        return done(null, false);
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Lazy discovery lets the app recover from a temporary provider outage without
// restarting, while login fails closed and public short links remain usable.
async function prepareOIDC(req, res, next) {
  try {
    const client = await require("./oidc-client").client();
    const { Strategy } = require("openid-client");
    passport.use("oidc", new Strategy({ client, usePKCE: "S256", passReqToCallback: true,
      params: { scope: env.OIDC_SCOPE, ...(env.OIDC_PROMPT ? { prompt: env.OIDC_PROMPT } : {}) }
    }, async (request, tokenset, userinfo, done) => {
      try {
        const claims = tokenset.claims();
        const result = await require("./oidc-security").identity(client.issuer.issuer, claims, userinfo, tokenset.id_token);
        done(null, result.user, { oi: result.id, os: claims.sid || null, oa: Date.now() });
      } catch (error) { done(error); }
    }));
    next();
  } catch (error) {
    require("./oidc-client").failure(error.message);
    res.status(503).set("Cache-Control", "no-store");
    next(new utils.CustomError(i18n.t("messages.oidc_provider_unavailable_try_signing_in_again_shortly"), 503));
  }
}

module.exports = { prepareOIDC };
