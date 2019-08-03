import './configToEnv';

import dotenv from 'dotenv';
dotenv.config();

import nextApp from 'next';
import express, { Request, Response } from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import morgan from 'morgan';
import Raven from 'raven';
import cookieParser from 'cookie-parser';
import passport from 'passport';
import cors from 'cors';

import {
  validateBody,
  validationCriterias,
  validateUrl,
  ipCooldownCheck,
} from './controllers/validateBodyController';
import * as auth from './controllers/authController';
import * as link from './controllers/linkController';

import './cron';
import './passport';

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true });

if (process.env.RAVEN_DSN) {
  Raven.config(process.env.RAVEN_DSN).install();
}

const catchErrors = fn => (req, res, next) =>
  fn(req, res, next).catch(err => {
    res
      .status(500)
      .json({ error: 'Sorry an error ocurred. Please try again later.' });
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

  if (process.env.NODE_ENV !== 'production') {
    server.use(morgan('dev'));
  }

  server.use(helmet());
  server.use(cookieParser());
  server.use(express.json());
  server.use(express.urlencoded({ extended: true }));
  server.use(passport.initialize());
  server.use(express.static('static'));

  server.use((req, _res, next) => {
    req.realIP =
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      '';
    return next();
  });

  server.use(link.customDomainRedirection);

  /* View routes */
  server.get(
    '/reset-password/:resetPasswordToken?',
    catchErrors(auth.resetUserPassword),
    (req, res) => app.render(req, res, '/reset-password', req.user)
  );
  server.get(
    '/verify/:verificationToken?',
    catchErrors(auth.verify),
    (req, res) => app.render(req, res, '/verify', req.user)
  );

  /* User and authentication */
  server.post(
    '/api/auth/signup',
    validationCriterias,
    validateBody,
    catchErrors(auth.signup)
  );
  server.post(
    '/api/auth/login',
    validationCriterias,
    validateBody,
    auth.authLocal,
    auth.login
  );
  server.post('/api/auth/renew', auth.authJwt, auth.renew);
  server.post(
    '/api/auth/changepassword',
    auth.authJwt,
    catchErrors(auth.changeUserPassword)
  );
  server.post(
    '/api/auth/generateapikey',
    auth.authJwt,
    catchErrors(auth.generateUserApiKey)
  );
  server.post(
    '/api/auth/resetpassword',
    catchErrors(auth.requestUserPasswordReset)
  );
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
    catchErrors(link.shortener)
  );
  server.post(
    '/api/url/deleteurl',
    auth.authApikey,
    auth.authJwt,
    catchErrors(link.deleteUserLink)
  );
  server.get(
    '/api/url/geturls',
    auth.authApikey,
    auth.authJwt,
    catchErrors(link.getUserLinks)
  );
  server.post(
    '/api/url/customdomain',
    auth.authJwt,
    catchErrors(link.setCustomDomain)
  );
  server.delete(
    '/api/url/customdomain',
    auth.authJwt,
    catchErrors(link.deleteCustomDomain)
  );
  server.get(
    '/api/url/stats',
    auth.authApikey,
    auth.authJwt,
    catchErrors(link.getLinkStats)
  );
  server.post('/api/url/requesturl', catchErrors(link.goToLink));
  server.post('/api/url/report', catchErrors(link.reportLink));
  server.post(
    '/api/url/admin/ban',
    auth.authApikey,
    auth.authJwt,
    auth.authAdmin,
    catchErrors(link.ban)
  );
  server.get(
    '/:id',
    catchErrors(link.goToLink),
    (req: Request, res: Response) => {
      switch (req.pageType) {
        case 'password':
          return app.render(req, res, '/url-password', {
            protectedLink: req.protectedLink,
          });
        case 'info':
        default:
          return app.render(req, res, '/url-info', {
            linkTarget: req.linkTarget,
          });
      }
    }
  );

  server.get('*', (req, res) => handle(req, res));

  server.listen(port, err => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${port}`);
  });
});
