import appRoot from "app-root-path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

const { combine, colorize, printf, timestamp } = winston.format;

const logFormat = printf(info => {
  return `[${info.timestamp}] ${info.level}: ${info.message}`;
});

const rawFormat = printf(info => {
  return `[${info.timestamp}] ${info.level}: ${info.message}`;
});

// define the custom settings for each transport (file, console)
const options = {
  file: {
    level: "info",
    filename: `${appRoot}/logs/%DATE%_app.log`,
    datePattern: "YYYY-MM-DD",
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: "30d", // monthly rotation
    colorize: false
  },
  errorFile: {
    level: "error",
    name: "file.error",
    filename: `${appRoot}/logs/%DATE%_error.log`,
    datePattern: "YYYY-MM-DD",
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: "30d", // monthly rotation
    colorize: true
  },
  console: {
    level: "debug",
    handleExceptions: true,
    json: false,
    format: combine(colorize(), rawFormat)
  }
};

// instantiate a new Winston Logger with the settings defined above
export const logger = winston.createLogger({
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
  transports: [
    new DailyRotateFile(options.file),
    new DailyRotateFile(options.errorFile),
    new winston.transports.Console(options.console)
  ],
  exitOnError: false // do not exit on handled exceptions
});

// create a stream object with a 'write' function that will be used by `morgan`
export const stream = {
  write: message => {
    logger.info(message);
  }
};

winston.addColors({
  debug: "white",
  error: "red",
  info: "green",
  warn: "yellow"
});
