const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const LocalStratergy = require('passport-local').Strategy;
const LocalAPIKeyStrategy = require('passport-localapikey').Strategy;
const bcrypt = require('bcryptjs');
const config = require('./config');
const { getUser } = require('./db/user');

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromHeader('authorization'),
  secretOrKey: config.JWT_SECRET,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await getUser({ email: payload.sub });
      if (!user) return done(null, false);
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

const localOptions = {
  usernameField: 'email',
};

passport.use(
  new LocalStratergy(localOptions, async (email, password, done) => {
    try {
      const user = await getUser({ email });
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
  apiKeyField: 'apikey',
  apiKeyHeader: 'x-api-key',
};

passport.use(
  new LocalAPIKeyStrategy(localAPIKeyOptions, async (apikey, done) => {
    try {
      const user = await getUser({ apikey });
      if (!user) {
        return done(null, false);
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);
