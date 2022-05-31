import { Strategy as LocalAPIKeyStrategy } from "passport-localapikey-update";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as LocalStrategy } from "passport-local";
import passport from "passport";
import bcrypt from "bcryptjs";

import query from "./queries";
import env from "./env";

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromHeader("authorization"),
  secretOrKey: env.JWT_SECRET
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await query.user.find({ email: payload.sub });
      if (!user) return done(null, false);
      return done(null, user);
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
