const { Strategy: LocalAPIKeyStrategy } = require("passport-localapikey-update");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const { Strategy: LocalStrategy } = require("passport-local");
const passport = require("passport");
const bcrypt = require("bcryptjs");

const query = require("./queries");
const env = require("./env");
const utils = require("./utils");
const { ROLES } = require("./consts");

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
        return done(null, user);
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

let oidcInitPromise = null;

if (env.OIDC_ENABLED) {
  async function enableOIDC() {
    const requiredKeys = ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_SCOPE", "OIDC_EMAIL_CLAIM"];
    requiredKeys.forEach((key) => {
      if (!env[key]) {
        throw new Error(`Missing required env ${key}`);
      }
    });
    const { Issuer, Strategy: OIDCStrategy, UserinfoResponse } = await import("openid-client");
    const issuer = await Issuer.discover(env.OIDC_ISSUER).catch(function (error) {
        error.info = "Failed connecting to OIDC issuer.";
        throw error;
      });
    const client = new issuer.Client({
      client_id: env.OIDC_CLIENT_ID,
      client_secret: env.OIDC_CLIENT_SECRET,
      redirect_uris: [utils.getSiteURL() + "/login/oidc"],
      response_types: ["code"]
    });
  
    passport.use(
      "oidc",
      new OIDCStrategy(
        {
          client,
          params: {
            scope: env.OIDC_SCOPE,
            prompt: "login"
          },
          passReqToCallback: true
        },
        async (req, tokenset, userinfo, done) => {
          try {
            const email = userinfo[env.OIDC_EMAIL_CLAIM];
            
            // Check if user should be admin based on OIDC claims
            let shouldBeAdmin = false;
            if (env.OIDC_ADMIN_GROUP) {
              const roleClaim = userinfo[env.OIDC_ROLE_CLAIM];
              if (roleClaim) {
                // Handle both array and string claim values
                const roles = Array.isArray(roleClaim) ? roleClaim : [roleClaim];
                shouldBeAdmin = roles.includes(env.OIDC_ADMIN_GROUP);
              }
            }
            
            const desiredRole = shouldBeAdmin ? ROLES.ADMIN : ROLES.USER;
            const existingUser = await query.user.find({ email });
  
            // Existing user - update role if needed
            if (existingUser) {
              // Update role on every login to stay in sync with IdP
              if (existingUser.role !== desiredRole) {
                const updatedUser = await query.user.update({ id: existingUser.id }, { role: desiredRole });
                return done(null, updatedUser);
              }
              return done(null, existingUser);
            }
  
            // New user - create with appropriate role
            // Generate a random password which is not supposed to be used directly.
            const salt = await bcrypt.genSalt(12);
            const password = utils.generateRandomPassword();
            const newUser = await query.user.add({
              email,
              password,
            });
            const updatedUser = await query.user.update(newUser, {
              verified: true,
              verification_token: null,
              verification_expires: null,
              role: desiredRole,
            });
            return done(null, updatedUser);
  
          } catch (err) {
            return done(err);
          }
        }
      )
    );
  }

  oidcInitPromise = enableOIDC();
}

module.exports = { oidcInitPromise };
