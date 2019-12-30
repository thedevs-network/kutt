import winston from 'winston';
import expressWinston from 'express-winston';

const format = winston.format.combine(
  winston.format.colorize(),
  winston.format.simple(),
);

const transports = [
  new winston.transports.Console({
    format,
  }),
];

export const logger = winston.createLogger({
  level: process.env.PRODUCTION ? 'info' : 'debug',
  format: winston.format.json(),
  defaultMeta: { service: 'kutt' },
  transports,
});

export const loggerMiddleware = () =>
  expressWinston.logger({
    transports,
    format,
    meta: false,
    expressFormat: true,
  });

export const errorLoggerMiddleware = () =>
  expressWinston.errorLogger({
    transports,
    format,
  });
