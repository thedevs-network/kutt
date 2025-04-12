const { Strategy: LocalAPIKeyStrategy } = require("passport-localapikey-update");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const { Strategy: LocalStrategy } = require("passport-local");
const passport = require("passport");
const bcrypt = require("bcryptjs");
const crypto = require('crypto');

const query = require("./queries");
const env = require("./env");

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
      const user = await query.user.find({ id: payload.sub });
      if (!user) return done(null, false);
      return done(null, user, payload);
    } catch (err) {
      return done(err);
    }
  })
);

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
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

const localAPIKeyOptions = {
  apiKeyField: "apikey",
  apiKeyHeader: "x-api-key"
};

passport.use(
  new LocalAPIKeyStrategy(localAPIKeyOptions, async (apikey, done) => {
    try {
      const user = await query.user.find({ apikey });
      if (!user) {
        return done(null, false);
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

async function enableOIDC() {
  const requiredKeys = ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_SCOPE", "OIDC_EMAIL_CLAIM", "OIDC_APP_URL"];
  requiredKeys.forEach((key) => {
    if (!env[key]) {
      throw new Error(`Missing required env ${key}`);
    }
  });
  const { Issuer, Strategy: OIDCStrategy, UserinfoResponse } = await import("openid-client");
  const issuer = await Issuer.discover(env.OIDC_ISSUER)
  const client = new issuer.Client({
    client_id: env.OIDC_CLIENT_ID,
    client_secret: env.OIDC_CLIENT_SECRET,
    redirect_uris: [`${env.OIDC_APP_URL}/login/oidc`],
    response_types: ["code"]
  });

  passport.use(
    "oidc",
    new OIDCStrategy(
      {
        client: client,
        params: {
          scope: env.OIDC_SCOPE,
          prompt: "login"
        },
        passReqToCallback: true
      },
      async (req, tokenset, userinfo, done) => {
        try {
          const email = userinfo[env.OIDC_EMAIL_CLAIM];
          const existingUser = await query.user.find({ email });

          // Existing user.
          if (existingUser) return done(null, existingUser);

          // New user.
          // Generate a random password which is not supposed to be used directly.
          const salt = await bcrypt.genSalt(12);
          const password = generateRandomPassword();
          const newUser = await query.user.add({
            email,
            password,
          });
          const updatedUsers = await query.user.update(newUser, {
            verified: true,
            verification_token: null,
            verification_expires: null,
          });
          return done(null, updatedUsers[0]);

        } catch (err) {
          return done(err);
        }
      }
    )
  );

}

function generateRandomPassword() {
  // 24-64 characters.
  const length = Math.floor(Math.random()*41)+24;
  return [...crypto.randomBytes(length)].map(byte => String.fromCharCode((byte % 93)+33)).join('');
}

if (env.OIDC_ENABLED) {
  enableOIDC();
}
