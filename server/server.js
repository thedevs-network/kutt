require('./configToEnv');
require('dotenv').config();
const nextApp = require('next');
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const morgan = require('morgan');
const Raven = require('raven');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const passport = require('passport');
const cors = require('cors');
const {
  validateBody,
  validationCriterias,
  validateUrl,
  ipCooldownCheck,
} = require('./controllers/validateBodyController');
const auth = require('./controllers/authController');
const url = require('./controllers/urlController');
const neo4j = require('./db/neo4j');

require('./cron');
require('./passport');

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });

if (process.env.RAVEN_DSN) {
  Raven.config(process.env.RAVEN_DSN).install();
}

const catchErrors = fn => (req, res, next) =>
  fn(req, res, next).catch(err => {
    res.status(500).json({ error: 'Sorry an error ocurred. Please try again later.' });
    neo4j.close();
    if (process.env.RAVEN_DSN) {
      Raven.captureException(err, {
        user: { email: req.user && req.user.email },
      });
      throw new Error(err);
    } else {
      throw new Error(err);
    }
  });

const port = Number(process.env.PORT) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = nextApp({ dir: './client', dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = express();

  server.set('trust proxy', true);
  server.use(helmet());
  if (process.env.NODE_ENV !== 'production') {
    server.use(morgan('dev'));
  }
  server.use(cookieParser());
  server.use(bodyParser.json());
  server.use(bodyParser.urlencoded({ extended: true }));
  server.use(passport.initialize());
  server.use(express.static('static'));

  server.use((req, res, next) => {
    req.realIp = req.headers['x-real-ip'] || req.connection.remoteAddress || '';
    return next();
  });

  server.use(url.customDomainRedirection);

  /* View routes */
  server.get('/', (req, res) => app.render(req, res, '/'));
  server.get('/login', (req, res) => app.render(req, res, '/login'));
  server.get('/logout', (req, res) => app.render(req, res, '/logout'));
  server.get('/settings', (req, res) => app.render(req, res, '/settings'));
  server.get('/stats', (req, res) => app.render(req, res, '/stats', req.query));
  server.get('/terms', (req, res) => app.render(req, res, '/terms'));
  server.get('/report', (req, res) => app.render(req, res, '/report'));
  server.get('/banned', (req, res) => app.render(req, res, '/banned'));
  server.get('/offline', (req, res) => app.render(req, res, '/offline'));
  server.get('/reset-password/:resetPasswordToken?', catchErrors(auth.resetPassword), (req, res) =>
    app.render(req, res, '/reset-password', req.user)
  );
  server.get('/verify/:verificationToken?', catchErrors(auth.verify), (req, res) =>
    app.render(req, res, '/verify', req.user)
  );

  /* User and authentication */
  server.post('/api/auth/signup', validationCriterias, validateBody, catchErrors(auth.signup));
  server.post('/api/auth/login', validationCriterias, validateBody, auth.authLocal, auth.login);
  server.post('/api/auth/renew', auth.authJwt, auth.renew);
  server.post('/api/auth/changepassword', auth.authJwt, catchErrors(auth.changePassword));
  server.post('/api/auth/generateapikey', auth.authJwt, catchErrors(auth.generateApiKey));
  server.post('/api/auth/resetpassword', catchErrors(auth.requestPasswordReset));
  server.get('/api/auth/usersettings', auth.authJwt, auth.userSettings);

  /* URL shortener */
  server.post(
    '/api/url/submit',
    cors(),
    auth.authApikey,
    auth.authJwtLoose,
    catchErrors(auth.recaptcha),
    catchErrors(validateUrl),
    catchErrors(ipCooldownCheck),
    catchErrors(url.urlShortener)
  );
  server.post('/api/url/deleteurl', auth.authApikey, auth.authJwt, catchErrors(url.deleteUrl));
  server.get('/api/url/geturls', auth.authApikey, auth.authJwt, catchErrors(url.getUrls));
  server.post('/api/url/customdomain', auth.authJwt, catchErrors(url.setCustomDomain));
  server.delete('/api/url/customdomain', auth.authJwt, catchErrors(url.deleteCustomDomain));
  server.get('/api/url/stats', auth.authApikey, auth.authJwt, catchErrors(url.getStats));
  server.post('/api/url/requesturl', catchErrors(url.goToUrl));
  server.post('/api/url/report', catchErrors(url.reportUrl));
  server.post(
    '/api/url/admin/ban',
    auth.authApikey,
    auth.authJwt,
    auth.authAdmin,
    catchErrors(url.ban)
  );
  server.get('/:id', catchErrors(url.goToUrl), (req, res) => {
    switch (req.pageType) {
      case 'password':
        return app.render(req, res, '/url-password', req.protectedUrl);
      case 'info':
      default:
        return app.render(req, res, '/url-info', req.urlTarget);
    }
  });

  server.get('*', (req, res) => handle(req, res));

  server.listen(port, err => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`); // eslint-disable-line no-console
  });
});
